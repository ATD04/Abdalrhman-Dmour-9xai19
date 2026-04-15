import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class MeetingsService {
  constructor(private prisma: PrismaService) {}

  async findAll(lang: string = 'en', filters?: { status?: string; type?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.meetingType = filters.type;

    const meetings = await this.prisma.meeting.findMany({
      where,
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
      orderBy: { scheduledAt: 'desc' },
    });

    return meetings.map((m) => this.transformMeeting(m, lang));
  }

  async findOne(id: string, lang: string = 'en') {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
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
    return this.transformMeeting(meeting, lang);
  }

  async getUpcoming(lang: string = 'en', days: number = 7) {
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const meetings = await this.prisma.meeting.findMany({
      where: {
        scheduledAt: {
          gte: now,
          lte: endDate,
        },
        status: 'SCHEDULED',
      },
      include: {
        participants: {
          include: { entity: true },
        },
        agendaItems: {
          orderBy: { orderNumber: 'asc' },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return meetings.map((m) => this.transformMeeting(m, lang));
  }

  async getDecisions(lang: string = 'en', filters?: { status?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;

    const decisions = await this.prisma.decision.findMany({
      where,
      include: {
        meeting: true,
      },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
    });

    return decisions.map((d) => ({
      id: d.id,
      title: lang === 'ar' ? d.titleAr : d.titleEn,
      description: lang === 'ar' ? d.descriptionAr : d.descriptionEn,
      meeting: {
        id: d.meeting.id,
        title: lang === 'ar' ? d.meeting.titleAr : d.meeting.titleEn,
        scheduledAt: d.meeting.scheduledAt,
      },
      decisionType: d.decisionType,
      priority: d.priority,
      owner: d.owner,
      deadline: d.deadline,
      status: d.status,
    }));
  }

  async getFollowUps(lang: string = 'en', filters?: { status?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;

    const followUps = await this.prisma.followUp.findMany({
      where,
      include: {
        meeting: true,
      },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
    });

    return followUps.map((f) => ({
      id: f.id,
      title: lang === 'ar' ? f.titleAr : f.titleEn,
      description: lang === 'ar' ? f.descriptionAr : f.descriptionEn,
      meeting: {
        id: f.meeting.id,
        title: lang === 'ar' ? f.meeting.titleAr : f.meeting.titleEn,
        scheduledAt: f.meeting.scheduledAt,
      },
      owner: f.owner,
      deadline: f.deadline,
      priority: f.priority,
      status: f.status,
      completedAt: f.completedAt,
    }));
  }

  async getOverdueItems(lang: string = 'en') {
    const now = new Date();

    const [decisions, followUps] = await Promise.all([
      this.prisma.decision.findMany({
        where: {
          deadline: { lt: now },
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
        include: { meeting: true },
      }),
      this.prisma.followUp.findMany({
        where: {
          deadline: { lt: now },
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
        include: { meeting: true },
      }),
    ]);

    return {
      overdueDecisions: decisions.map((d) => ({
        id: d.id,
        title: lang === 'ar' ? d.titleAr : d.titleEn,
        owner: d.owner,
        deadline: d.deadline,
        daysOverdue: Math.floor((now.getTime() - d.deadline!.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      overdueFollowUps: followUps.map((f) => ({
        id: f.id,
        title: lang === 'ar' ? f.titleAr : f.titleEn,
        owner: f.owner,
        deadline: f.deadline,
        daysOverdue: Math.floor((now.getTime() - f.deadline!.getTime()) / (1000 * 60 * 60 * 24)),
      })),
    };
  }

  private transformMeeting(meeting: any, lang: string): any {
    return {
      id: meeting.id,
      title: lang === 'ar' ? meeting.titleAr : meeting.titleEn,
      titleEn: meeting.titleEn,
      titleAr: meeting.titleAr,
      description: lang === 'ar' ? meeting.descriptionAr : meeting.descriptionEn,
      meetingType: meeting.meetingType,
      scheduledAt: meeting.scheduledAt,
      duration: meeting.duration,
      location: meeting.location,
      status: meeting.status,
      briefingNotes: lang === 'ar' ? meeting.briefingNotesAr : meeting.briefingNotesEn,
      participants: meeting.participants?.map((p: any) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        entity: p.entity
          ? {
              id: p.entity.id,
              name: lang === 'ar' ? p.entity.nameAr : p.entity.nameEn,
            }
          : null,
        isRequired: p.isRequired,
        attendance: p.attendance,
      })),
      agendaItems: meeting.agendaItems?.map((a: any) => ({
        id: a.id,
        orderNumber: a.orderNumber,
        title: lang === 'ar' ? a.titleAr : a.titleEn,
        description: lang === 'ar' ? a.descriptionAr : a.descriptionEn,
        presenter: a.presenter,
        duration: a.duration,
        status: a.status,
      })),
      decisions: meeting.decisions?.map((d: any) => ({
        id: d.id,
        title: lang === 'ar' ? d.titleAr : d.titleEn,
        decisionType: d.decisionType,
        owner: d.owner,
        deadline: d.deadline,
        status: d.status,
      })),
      followUps: meeting.followUps?.map((f: any) => ({
        id: f.id,
        title: lang === 'ar' ? f.titleAr : f.titleEn,
        owner: f.owner,
        deadline: f.deadline,
        status: f.status,
      })),
      createdAt: meeting.createdAt,
      updatedAt: meeting.updatedAt,
    };
  }
}
