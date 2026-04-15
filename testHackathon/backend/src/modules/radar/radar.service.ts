import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface RadarItem {
  id: string;
  type: string;
  title: string;
  source: string;
  urgency: number;
  impact: number;
  visibility: number;
  escalation: number;
  score: number;
  status: string;
  details: any;
  recommendedAction: string;
}

@Injectable()
export class RadarService {
  constructor(private prisma: PrismaService) {}

  async getExecutiveRadar(lang: string = 'en'): Promise<RadarItem[]> {
    const radarItems: RadarItem[] = [];

    // Gather signals from all sources
    const [
      delayedInitiatives,
      activeBlockers,
      lowReadinessEntities,
      highPriorityPolicies,
      negativeFeedbackSurge,
      upcomingDecisions,
    ] = await Promise.all([
      this.getDelayedInitiatives(lang),
      this.getActiveBlockers(lang),
      this.getLowReadinessEntities(lang),
      this.getHighPriorityPolicies(lang),
      this.getNegativeFeedbackSurge(lang),
      this.getUpcomingDecisions(lang),
    ]);

    radarItems.push(...delayedInitiatives);
    radarItems.push(...activeBlockers);
    radarItems.push(...lowReadinessEntities);
    radarItems.push(...highPriorityPolicies);
    radarItems.push(...negativeFeedbackSurge);
    radarItems.push(...upcomingDecisions);

    // Sort by score and take top 10
    return radarItems
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  async getMorningBrief(lang: string = 'en') {
    const [radar, upcomingMeetings, pendingFollowUps, trustPulse] = await Promise.all([
      this.getExecutiveRadar(lang),
      this.getUpcomingMeetingsToday(lang),
      this.getPendingFollowUps(lang),
      this.getTrustPulse(),
    ]);

    const criticalItems = radar.filter((r) => r.score >= 80);
    const warningItems = radar.filter((r) => r.score >= 60 && r.score < 80);

    return {
      date: new Date().toISOString().split('T')[0],
      summary: {
        criticalCount: criticalItems.length,
        warningCount: warningItems.length,
        meetingsToday: upcomingMeetings.length,
        pendingFollowUps: pendingFollowUps.length,
        trustPulse,
      },
      criticalItems,
      warningItems,
      upcomingMeetings,
      pendingFollowUps: pendingFollowUps.slice(0, 5),
    };
  }

  async getEarlyWarnings(lang: string = 'en') {
    const warnings: any[] = [];

    // Check initiative progress vs expected
    const initiatives = await this.prisma.initiative.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'ON_TRACK'] },
        targetDate: { not: null },
      },
      include: { entity: true },
    });

    initiatives.forEach((init) => {
      if (!init.startDate || !init.targetDate) return;
      
      const totalDuration = init.targetDate.getTime() - init.startDate.getTime();
      const elapsed = Date.now() - init.startDate.getTime();
      const expectedProgress = Math.min(100, Math.round((elapsed / totalDuration) * 100));
      
      if (init.progress < expectedProgress * 0.8) {
        warnings.push({
          id: init.id,
          type: 'SLIPPAGE',
          title: lang === 'ar' ? init.titleAr : init.titleEn,
          entity: lang === 'ar' ? init.entity.nameAr : init.entity.nameEn,
          currentProgress: init.progress,
          expectedProgress,
          gap: expectedProgress - init.progress,
          severity: expectedProgress - init.progress > 30 ? 'HIGH' : 'MEDIUM',
        });
      }
    });

    return warnings.sort((a, b) => b.gap - a.gap);
  }

  async getMomentumSnapshot() {
    const initiatives = await this.prisma.initiative.findMany();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Calculate momentum indicators
    const onTrack = initiatives.filter((i) => i.status === 'ON_TRACK').length;
    const atRisk = initiatives.filter((i) => i.status === 'AT_RISK').length;
    const delayed = initiatives.filter((i) => i.status === 'DELAYED').length;
    const completed = initiatives.filter((i) => i.status === 'COMPLETED').length;

    const avgProgress = Math.round(
      initiatives.reduce((sum, i) => sum + i.progress, 0) / initiatives.length,
    );

    // Coordination health
    const coordination = await this.prisma.dependency.findMany({
      include: { blockers: true },
    });
    const blockedDeps = coordination.filter((d) => d.status === 'BLOCKED').length;

    // Trust pulse
    const recentFeedback = await this.prisma.feedback.findMany({
      where: { receivedAt: { gte: thirtyDaysAgo } },
    });
    const negativeFeedback = recentFeedback.filter((f) => f.sentiment === 'NEGATIVE').length;
    const trustScore = recentFeedback.length > 0
      ? Math.round(100 - (negativeFeedback / recentFeedback.length) * 100)
      : 50;

    return {
      initiativeMomentum: {
        total: initiatives.length,
        onTrack,
        atRisk,
        delayed,
        completed,
        avgProgress,
        healthScore: Math.round((onTrack / initiatives.length) * 100),
      },
      coordinationHealth: {
        totalDependencies: coordination.length,
        blocked: blockedDeps,
        healthScore: Math.round(100 - (blockedDeps / coordination.length) * 100),
      },
      citizenTrust: {
        score: trustScore,
        recentFeedbackCount: recentFeedback.length,
        negativeFeedbackCount: negativeFeedback,
      },
    };
  }

  private async getDelayedInitiatives(lang: string): Promise<RadarItem[]> {
    const initiatives = await this.prisma.initiative.findMany({
      where: { status: { in: ['AT_RISK', 'DELAYED'] } },
      include: { entity: true },
      orderBy: { riskLevel: 'desc' },
    });

    return initiatives.map((init) => ({
      id: init.id,
      type: 'INITIATIVE',
      title: lang === 'ar' ? init.titleAr : init.titleEn,
      source: lang === 'ar' ? init.entity.nameAr : init.entity.nameEn,
      urgency: init.status === 'DELAYED' ? 90 : 70,
      impact: init.priority === 'CRITICAL' ? 100 : init.priority === 'HIGH' ? 80 : 60,
      visibility: 70,
      escalation: init.riskLevel === 'CRITICAL' ? 100 : 60,
      score: 0,
      status: init.status,
      details: {
        progress: init.progress,
        targetDate: init.targetDate,
        riskLevel: init.riskLevel,
      },
      recommendedAction: init.status === 'DELAYED'
        ? (lang === 'ar' ? 'يتطلب تدخل وزاري عاجل' : 'Requires urgent ministerial intervention')
        : (lang === 'ar' ? 'مراجعة خطة التعافي' : 'Review recovery plan'),
    })).map((item) => ({
      ...item,
      score: Math.round(item.urgency * 0.3 + item.impact * 0.3 + item.visibility * 0.2 + item.escalation * 0.2),
    }));
  }

  private async getActiveBlockers(lang: string): Promise<RadarItem[]> {
    const blockers = await this.prisma.blocker.findMany({
      where: { status: { in: ['OPEN', 'ESCALATED'] } },
      include: {
        dependency: {
          include: {
            fromEntity: true,
            toEntity: true,
          },
        },
      },
      orderBy: { escalationLevel: 'desc' },
    });

    return blockers.map((blocker) => ({
      id: blocker.id,
      type: 'BLOCKER',
      title: lang === 'ar' ? blocker.titleAr : blocker.titleEn,
      source: `${lang === 'ar' ? blocker.dependency.fromEntity.nameAr : blocker.dependency.fromEntity.nameEn} → ${lang === 'ar' ? blocker.dependency.toEntity.nameAr : blocker.dependency.toEntity.nameEn}`,
      urgency: blocker.escalationLevel === 'MINISTERIAL' ? 100 : blocker.escalationLevel === 'SECRETARY_GENERAL' ? 80 : 60,
      impact: 75,
      visibility: 60,
      escalation: blocker.escalationLevel === 'MINISTERIAL' ? 100 : 50,
      score: 0,
      status: blocker.status,
      details: {
        escalationLevel: blocker.escalationLevel,
        reportedDate: blocker.reportedDate,
        daysOpen: Math.floor((Date.now() - blocker.reportedDate.getTime()) / (1000 * 60 * 60 * 24)),
      },
      recommendedAction: blocker.escalationLevel === 'MINISTERIAL'
        ? (lang === 'ar' ? 'اجتماع عاجل مع الأطراف المعنية' : 'Urgent meeting with stakeholders')
        : (lang === 'ar' ? 'متابعة على مستوى الأمين العام' : 'Follow up at Secretary General level'),
    })).map((item) => ({
      ...item,
      score: Math.round(item.urgency * 0.3 + item.impact * 0.3 + item.visibility * 0.2 + item.escalation * 0.2),
    }));
  }

  private async getLowReadinessEntities(lang: string): Promise<RadarItem[]> {
    const scores = await this.prisma.readinessScore.findMany({
      include: { entity: true },
      orderBy: { assessmentDate: 'desc' },
    });

    // Group by entity and get average
    const entityScores: Record<string, { entity: any; scores: number[] }> = {};
    scores.forEach((s) => {
      if (!entityScores[s.entityId]) {
        entityScores[s.entityId] = { entity: s.entity, scores: [] };
      }
      entityScores[s.entityId].scores.push(s.score);
    });

    const lowReadiness = Object.values(entityScores)
      .map((e) => ({
        entity: e.entity,
        avgScore: Math.round(e.scores.reduce((a, b) => a + b, 0) / e.scores.length),
      }))
      .filter((e) => e.avgScore < 50)
      .sort((a, b) => a.avgScore - b.avgScore);

    return lowReadiness.slice(0, 3).map((e) => ({
      id: e.entity.id,
      type: 'READINESS',
      title: lang === 'ar' 
        ? `جاهزية منخفضة: ${e.entity.nameAr}` 
        : `Low Readiness: ${e.entity.nameEn}`,
      source: lang === 'ar' ? e.entity.nameAr : e.entity.nameEn,
      urgency: 60,
      impact: 70,
      visibility: 50,
      escalation: e.avgScore < 30 ? 80 : 40,
      score: 0,
      status: 'NEEDS_ATTENTION',
      details: {
        avgReadinessScore: e.avgScore,
        entityType: e.entity.type,
      },
      recommendedAction: lang === 'ar'
        ? 'مراجعة خطة بناء القدرات'
        : 'Review capacity building plan',
    })).map((item) => ({
      ...item,
      score: Math.round(item.urgency * 0.3 + item.impact * 0.3 + item.visibility * 0.2 + item.escalation * 0.2),
    }));
  }

  private async getHighPriorityPolicies(lang: string): Promise<RadarItem[]> {
    const policies = await this.prisma.policy.findMany({
      where: {
        status: 'UNDER_REVIEW',
        priority: { in: ['HIGH', 'CRITICAL'] },
      },
      include: { entity: true },
    });

    return policies.map((policy) => ({
      id: policy.id,
      type: 'POLICY',
      title: lang === 'ar' ? policy.titleAr : policy.titleEn,
      source: policy.entity
        ? (lang === 'ar' ? policy.entity.nameAr : policy.entity.nameEn)
        : (lang === 'ar' ? 'عام' : 'General'),
      urgency: policy.priority === 'CRITICAL' ? 90 : 70,
      impact: 80,
      visibility: 70,
      escalation: 50,
      score: 0,
      status: 'PENDING_DECISION',
      details: {
        type: policy.type,
        priority: policy.priority,
      },
      recommendedAction: lang === 'ar'
        ? 'مراجعة تحليل الأثر واتخاذ قرار'
        : 'Review impact analysis and decide',
    })).map((item) => ({
      ...item,
      score: Math.round(item.urgency * 0.3 + item.impact * 0.3 + item.visibility * 0.2 + item.escalation * 0.2),
    }));
  }

  private async getNegativeFeedbackSurge(lang: string): Promise<RadarItem[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentNegative = await this.prisma.feedback.findMany({
      where: {
        sentiment: 'NEGATIVE',
        receivedAt: { gte: sevenDaysAgo },
      },
      include: { service: true, entity: true },
    });

    // Group by service
    const byService: Record<string, { service: any; count: number }> = {};
    recentNegative.forEach((f) => {
      if (f.serviceId) {
        if (!byService[f.serviceId]) {
          byService[f.serviceId] = { service: f.service, count: 0 };
        }
        byService[f.serviceId].count++;
      }
    });

    const surges = Object.values(byService)
      .filter((s) => s.count >= 5)
      .sort((a, b) => b.count - a.count)
      .slice(0, 2);

    return surges.map((s) => ({
      id: s.service.id,
      type: 'CITIZEN_SIGNAL',
      title: lang === 'ar'
        ? `ارتفاع الشكاوى: ${s.service.nameAr}`
        : `Complaint Surge: ${s.service.nameEn}`,
      source: lang === 'ar' ? s.service.nameAr : s.service.nameEn,
      urgency: 70,
      impact: 65,
      visibility: 80,
      escalation: 40,
      score: 0,
      status: 'TRENDING',
      details: {
        complaintsLast7Days: s.count,
        frictionScore: s.service.frictionScore,
      },
      recommendedAction: lang === 'ar'
        ? 'مراجعة تحليل احتكاك الخدمة'
        : 'Review service friction analysis',
    })).map((item) => ({
      ...item,
      score: Math.round(item.urgency * 0.3 + item.impact * 0.3 + item.visibility * 0.2 + item.escalation * 0.2),
    }));
  }

  private async getUpcomingDecisions(lang: string): Promise<RadarItem[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const decisions = await this.prisma.decision.findMany({
      where: {
        status: 'PENDING',
        deadline: { lte: tomorrow },
      },
      include: { meeting: true },
    });

    return decisions.map((d) => ({
      id: d.id,
      type: 'DECISION',
      title: lang === 'ar' ? d.titleAr : d.titleEn,
      source: lang === 'ar' ? d.meeting.titleAr : d.meeting.titleEn,
      urgency: 85,
      impact: d.priority === 'CRITICAL' ? 100 : d.priority === 'HIGH' ? 80 : 60,
      visibility: 60,
      escalation: 70,
      score: 0,
      status: 'DUE_SOON',
      details: {
        deadline: d.deadline,
        owner: d.owner,
        priority: d.priority,
      },
      recommendedAction: lang === 'ar'
        ? 'متابعة التنفيذ قبل الموعد النهائي'
        : 'Follow up on execution before deadline',
    })).map((item) => ({
      ...item,
      score: Math.round(item.urgency * 0.3 + item.impact * 0.3 + item.visibility * 0.2 + item.escalation * 0.2),
    }));
  }

  private async getUpcomingMeetingsToday(lang: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.meeting.findMany({
      where: {
        scheduledAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: { scheduledAt: 'asc' },
    }).then((meetings) =>
      meetings.map((m) => ({
        id: m.id,
        title: lang === 'ar' ? m.titleAr : m.titleEn,
        time: m.scheduledAt,
        type: m.meetingType,
        hasBriefing: !!m.briefingNotesEn || !!m.briefingNotesAr,
      })),
    );
  }

  private async getPendingFollowUps(lang: string) {
    const today = new Date();

    return this.prisma.followUp.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        deadline: { lte: today },
      },
      orderBy: { deadline: 'asc' },
    }).then((followUps) =>
      followUps.map((f) => ({
        id: f.id,
        title: lang === 'ar' ? f.titleAr : f.titleEn,
        owner: f.owner,
        deadline: f.deadline,
        status: f.status,
      })),
    );
  }

  private async getTrustPulse() {
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
}
