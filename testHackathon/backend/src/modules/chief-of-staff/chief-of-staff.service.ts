import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ChiefOfStaffService {
  constructor(private prisma: PrismaService) {}

  async getDailyBrief(lang: string = 'en') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todayMeetings,
      pendingDecisions,
      criticalAlerts,
      overdueFollowUps,
      trustSnapshot,
    ] = await Promise.all([
      this.getTodayMeetings(today, tomorrow, lang),
      this.getPendingDecisions(lang),
      this.getCriticalAlerts(lang),
      this.getOverdueFollowUps(lang),
      this.getTrustSnapshot(),
    ]);

    const priorityItems = [
      ...criticalAlerts.map((a) => ({ ...a, category: 'ALERT' })),
      ...overdueFollowUps.slice(0, 3).map((f) => ({ ...f, category: 'FOLLOW_UP' })),
      ...pendingDecisions.slice(0, 3).map((d) => ({ ...d, category: 'DECISION' })),
    ];

    return {
      date: today.toISOString().split('T')[0],
      greeting: this.generateGreeting(lang),
      snapshot: {
        meetingsToday: todayMeetings.length,
        criticalAlerts: criticalAlerts.length,
        pendingDecisions: pendingDecisions.length,
        overdueFollowUps: overdueFollowUps.length,
        trustPulse: trustSnapshot.score,
        trustTrend: trustSnapshot.trend,
      },
      priorityItems: priorityItems.slice(0, 5),
      schedule: todayMeetings,
      upcomingDeadlines: await this.getUpcomingDeadlines(lang),
    };
  }

  async getMeetingPrep(meetingId: string, lang: string = 'en') {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: {
          include: { entity: true },
        },
        agendaItems: {
          orderBy: { orderNumber: 'asc' },
        },
        decisions: true,
        followUps: true,
      },
    });

    if (!meeting) return null;

    // Get context for agenda items
    const agendaContext = await Promise.all(
      meeting.agendaItems.map(async (item) => {
        // Try to find related initiatives, policies, or issues
        const context = await this.getAgendaItemContext(item, lang);
        return {
          id: item.id,
          orderNumber: item.orderNumber,
          title: lang === 'ar' ? item.titleAr : item.titleEn,
          description: lang === 'ar' ? item.descriptionAr : item.descriptionEn,
          presenter: item.presenter,
          duration: item.duration,
          context,
          suggestedTalkingPoints: this.generateTalkingPoints(item, context, lang),
        };
      }),
    );

    // Get participant profiles
    const participantProfiles = meeting.participants.map((p) => ({
      name: p.name,
      role: p.role,
      entity: p.entity
        ? {
            id: p.entity.id,
            name: lang === 'ar' ? p.entity.nameAr : p.entity.nameEn,
            type: p.entity.type,
          }
        : null,
      isRequired: p.isRequired,
    }));

    return {
      meeting: {
        id: meeting.id,
        title: lang === 'ar' ? meeting.titleAr : meeting.titleEn,
        type: meeting.meetingType,
        scheduledAt: meeting.scheduledAt,
        duration: meeting.duration,
        location: meeting.location,
      },
      briefingNotes: lang === 'ar' ? meeting.briefingNotesAr : meeting.briefingNotesEn,
      participants: participantProfiles,
      agenda: agendaContext,
      keyObjectives: this.generateMeetingObjectives(meeting, lang),
      previousDecisions: await this.getPreviousRelatedDecisions(meeting, lang),
    };
  }

  async getDecisionMemo(meetingId: string, lang: string = 'en') {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        decisions: true,
        followUps: true,
        participants: {
          include: { entity: true },
        },
      },
    });

    if (!meeting) return null;

    return {
      meeting: {
        id: meeting.id,
        title: lang === 'ar' ? meeting.titleAr : meeting.titleEn,
        date: meeting.scheduledAt,
        attendees: meeting.participants.filter((p) => p.attendance === 'ATTENDED').length,
      },
      decisions: meeting.decisions.map((d) => ({
        id: d.id,
        title: lang === 'ar' ? d.titleAr : d.titleEn,
        description: lang === 'ar' ? d.descriptionAr : d.descriptionEn,
        type: d.decisionType,
        priority: d.priority,
        owner: d.owner,
        deadline: d.deadline,
        status: d.status,
      })),
      followUps: meeting.followUps.map((f) => ({
        id: f.id,
        title: lang === 'ar' ? f.titleAr : f.titleEn,
        description: lang === 'ar' ? f.descriptionAr : f.descriptionEn,
        owner: f.owner,
        deadline: f.deadline,
        priority: f.priority,
        status: f.status,
      })),
      summary: {
        totalDecisions: meeting.decisions.length,
        totalFollowUps: meeting.followUps.length,
        nextReviewDate: this.calculateNextReview(meeting.followUps),
      },
    };
  }

  async getFollowUpTracker(lang: string = 'en', filters?: { status?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;

    const followUps = await this.prisma.followUp.findMany({
      where,
      include: {
        meeting: true,
      },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
    });

    const grouped = {
      overdue: [] as any[],
      dueThisWeek: [] as any[],
      upcoming: [] as any[],
      completed: [] as any[],
    };

    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    followUps.forEach((f) => {
      const item = {
        id: f.id,
        title: lang === 'ar' ? f.titleAr : f.titleEn,
        description: lang === 'ar' ? f.descriptionAr : f.descriptionEn,
        meeting: {
          id: f.meeting.id,
          title: lang === 'ar' ? f.meeting.titleAr : f.meeting.titleEn,
          date: f.meeting.scheduledAt,
        },
        owner: f.owner,
        deadline: f.deadline,
        priority: f.priority,
        status: f.status,
        daysUntilDeadline: f.deadline
          ? Math.ceil((f.deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      };

      if (f.status === 'COMPLETED') {
        grouped.completed.push(item);
      } else if (f.deadline && f.deadline < today) {
        grouped.overdue.push(item);
      } else if (f.deadline && f.deadline <= nextWeek) {
        grouped.dueThisWeek.push(item);
      } else {
        grouped.upcoming.push(item);
      }
    });

    return {
      summary: {
        total: followUps.length,
        overdue: grouped.overdue.length,
        dueThisWeek: grouped.dueThisWeek.length,
        upcoming: grouped.upcoming.length,
        completed: grouped.completed.length,
        completionRate: Math.round(
          (grouped.completed.length / followUps.length) * 100,
        ),
      },
      grouped,
    };
  }

  async getWeeklyPriorities(lang: string = 'en') {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const [meetings, decisions, followUps, alerts] = await Promise.all([
      this.prisma.meeting.findMany({
        where: {
          scheduledAt: { gte: today, lte: nextWeek },
          status: 'SCHEDULED',
        },
        include: {
          agendaItems: true,
        },
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.decision.findMany({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          deadline: { lte: nextWeek },
        },
        include: { meeting: true },
        orderBy: { deadline: 'asc' },
      }),
      this.prisma.followUp.findMany({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          deadline: { lte: nextWeek },
        },
        include: { meeting: true },
        orderBy: { deadline: 'asc' },
      }),
      this.prisma.alert.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { severity: 'desc' },
      }),
    ]);

    return {
      week: {
        start: today.toISOString().split('T')[0],
        end: nextWeek.toISOString().split('T')[0],
      },
      overview: {
        meetingsCount: meetings.length,
        decisionsCount: decisions.length,
        followUpsCount: followUps.length,
        activeAlerts: alerts.length,
      },
      meetings: meetings.map((m) => ({
        id: m.id,
        title: lang === 'ar' ? m.titleAr : m.titleEn,
        scheduledAt: m.scheduledAt,
        type: m.meetingType,
        agendaItemsCount: m.agendaItems.length,
      })),
      criticalDecisions: decisions
        .filter((d) => d.priority === 'HIGH' || d.priority === 'CRITICAL')
        .map((d) => ({
          id: d.id,
          title: lang === 'ar' ? d.titleAr : d.titleEn,
          deadline: d.deadline,
          owner: d.owner,
        })),
      keyFollowUps: followUps
        .filter((f) => f.priority === 'HIGH' || f.priority === 'CRITICAL')
        .map((f) => ({
          id: f.id,
          title: lang === 'ar' ? f.titleAr : f.titleEn,
          deadline: f.deadline,
          owner: f.owner,
        })),
      activeAlerts: alerts.slice(0, 5).map((a) => ({
        id: a.id,
        title: lang === 'ar' ? a.titleAr : a.titleEn,
        type: a.type,
        severity: a.severity,
      })),
    };
  }

  private async getTodayMeetings(start: Date, end: Date, lang: string) {
    const meetings = await this.prisma.meeting.findMany({
      where: {
        scheduledAt: { gte: start, lt: end },
      },
      include: {
        agendaItems: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return meetings.map((m) => ({
      id: m.id,
      title: lang === 'ar' ? m.titleAr : m.titleEn,
      time: m.scheduledAt,
      duration: m.duration,
      type: m.meetingType,
      location: m.location,
      agendaCount: m.agendaItems.length,
      hasBriefing: !!(m.briefingNotesEn || m.briefingNotesAr),
    }));
  }

  private async getPendingDecisions(lang: string) {
    const decisions = await this.prisma.decision.findMany({
      where: { status: 'PENDING' },
      include: { meeting: true },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
      take: 10,
    });

    return decisions.map((d) => ({
      id: d.id,
      title: lang === 'ar' ? d.titleAr : d.titleEn,
      meeting: lang === 'ar' ? d.meeting.titleAr : d.meeting.titleEn,
      priority: d.priority,
      deadline: d.deadline,
      owner: d.owner,
    }));
  }

  private async getCriticalAlerts(lang: string) {
    const alerts = await this.prisma.alert.findMany({
      where: {
        status: 'ACTIVE',
        severity: { in: ['HIGH', 'CRITICAL'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return alerts.map((a) => ({
      id: a.id,
      title: lang === 'ar' ? a.titleAr : a.titleEn,
      type: a.type,
      severity: a.severity,
      source: a.source,
    }));
  }

  private async getOverdueFollowUps(lang: string) {
    const today = new Date();
    const followUps = await this.prisma.followUp.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        deadline: { lt: today },
      },
      include: { meeting: true },
      orderBy: { deadline: 'asc' },
    });

    return followUps.map((f) => ({
      id: f.id,
      title: lang === 'ar' ? f.titleAr : f.titleEn,
      meeting: lang === 'ar' ? f.meeting.titleAr : f.meeting.titleEn,
      owner: f.owner,
      deadline: f.deadline,
      daysOverdue: Math.floor(
        (today.getTime() - f.deadline!.getTime()) / (1000 * 60 * 60 * 24),
      ),
    }));
  }

  private async getTrustSnapshot() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const feedback = await this.prisma.feedback.findMany({
      where: { receivedAt: { gte: thirtyDaysAgo } },
    });

    if (feedback.length === 0) return { score: 50, trend: 'STABLE' };

    const positive = feedback.filter((f) => f.sentiment === 'POSITIVE').length;
    const negative = feedback.filter((f) => f.sentiment === 'NEGATIVE').length;
    const score = Math.round(((positive - negative) / feedback.length + 1) * 50);

    return {
      score: Math.max(0, Math.min(100, score)),
      trend: score > 60 ? 'IMPROVING' : score < 40 ? 'DECLINING' : 'STABLE',
    };
  }

  private async getUpcomingDeadlines(lang: string) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const [decisions, followUps] = await Promise.all([
      this.prisma.decision.findMany({
        where: {
          status: { not: 'COMPLETED' },
          deadline: { lte: nextWeek },
        },
        orderBy: { deadline: 'asc' },
        take: 5,
      }),
      this.prisma.followUp.findMany({
        where: {
          status: { not: 'COMPLETED' },
          deadline: { lte: nextWeek },
        },
        orderBy: { deadline: 'asc' },
        take: 5,
      }),
    ]);

    return [
      ...decisions.map((d) => ({
        type: 'DECISION',
        title: lang === 'ar' ? d.titleAr : d.titleEn,
        deadline: d.deadline,
        owner: d.owner,
      })),
      ...followUps.map((f) => ({
        type: 'FOLLOW_UP',
        title: lang === 'ar' ? f.titleAr : f.titleEn,
        deadline: f.deadline,
        owner: f.owner,
      })),
    ].sort((a, b) => (a.deadline?.getTime() || 0) - (b.deadline?.getTime() || 0));
  }

  private async getAgendaItemContext(item: any, lang: string) {
    // This would normally search across initiatives, policies, services
    // For demo, return placeholder
    return {
      relatedInitiatives: [],
      relatedPolicies: [],
      recentDevelopments: [],
    };
  }

  private generateTalkingPoints(item: any, context: any, lang: string): string[] {
    const isArabic = lang === 'ar';
    // Generate contextual talking points
    return isArabic
      ? [
          'مراجعة الحالة الراهنة',
          'تحديد الخطوات التالية',
          'مناقشة أي معوقات',
        ]
      : [
          'Review current status',
          'Identify next steps',
          'Discuss any blockers',
        ];
  }

  private generateMeetingObjectives(meeting: any, lang: string): string[] {
    const isArabic = lang === 'ar';
    const objectives: string[] = [];

    if (meeting.meetingType === 'STEERING_COMMITTEE') {
      objectives.push(isArabic ? 'مراجعة تقدم المبادرات' : 'Review initiative progress');
      objectives.push(isArabic ? 'اتخاذ قرارات بشأن المعوقات' : 'Decide on blockers');
    } else if (meeting.meetingType === 'MINISTERIAL_REVIEW') {
      objectives.push(isArabic ? 'تقديم تحديث شامل' : 'Provide comprehensive update');
      objectives.push(isArabic ? 'الحصول على توجيهات وزارية' : 'Obtain ministerial guidance');
    }

    return objectives;
  }

  private async getPreviousRelatedDecisions(meeting: any, lang: string) {
    // Would normally fetch previous decisions related to meeting topics
    return [];
  }

  private calculateNextReview(followUps: any[]): Date {
    const pendingFollowUps = followUps.filter((f) => f.status !== 'COMPLETED');
    if (pendingFollowUps.length === 0) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;
    }

    const earliestDeadline = pendingFollowUps
      .filter((f) => f.deadline)
      .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())[0]?.deadline;

    return earliestDeadline || new Date();
  }

  private generateGreeting(lang: string): string {
    const hour = new Date().getHours();
    if (lang === 'ar') {
      if (hour < 12) return 'صباح الخير';
      if (hour < 17) return 'مساء الخير';
      return 'مساء الخير';
    }
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
}
