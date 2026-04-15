import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class InitiativesService {
  constructor(private prisma: PrismaService) {}

  async findAll(lang: string = 'en', filters?: { status?: string; entityId?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.entityId) where.entityId = filters.entityId;

    const initiatives = await this.prisma.initiative.findMany({
      where,
      include: {
        entity: true,
        milestones: {
          orderBy: { dueDate: 'asc' },
        },
        risks: true,
        dependencies: {
          include: {
            toEntity: true,
            blockers: true,
          },
        },
        alerts: {
          where: { status: 'ACTIVE' },
        },
      },
      orderBy: [{ priority: 'desc' }, { targetDate: 'asc' }],
    });

    return initiatives.map((init) => this.transformInitiative(init, lang));
  }

  async findOne(id: string, lang: string = 'en') {
    const initiative = await this.prisma.initiative.findUnique({
      where: { id },
      include: {
        entity: true,
        milestones: {
          orderBy: { dueDate: 'asc' },
        },
        risks: true,
        dependencies: {
          include: {
            toEntity: true,
            fromEntity: true,
            blockers: true,
          },
        },
        alerts: true,
      },
    });

    if (!initiative) return null;
    return this.transformInitiative(initiative, lang);
  }

  async getAtRisk(lang: string = 'en') {
    const initiatives = await this.prisma.initiative.findMany({
      where: {
        status: { in: ['AT_RISK', 'DELAYED'] },
      },
      include: {
        entity: true,
        risks: true,
        alerts: {
          where: { status: 'ACTIVE' },
        },
      },
      orderBy: { riskLevel: 'desc' },
    });

    return initiatives.map((init) => this.transformInitiative(init, lang));
  }

  async getProgressSummary() {
    const all = await this.prisma.initiative.findMany();
    
    return {
      total: all.length,
      byStatus: {
        planning: all.filter((i) => i.status === 'PLANNING').length,
        inProgress: all.filter((i) => i.status === 'IN_PROGRESS').length,
        onTrack: all.filter((i) => i.status === 'ON_TRACK').length,
        atRisk: all.filter((i) => i.status === 'AT_RISK').length,
        delayed: all.filter((i) => i.status === 'DELAYED').length,
        completed: all.filter((i) => i.status === 'COMPLETED').length,
      },
      avgProgress: Math.round(all.reduce((sum, i) => sum + i.progress, 0) / all.length),
      criticalCount: all.filter((i) => i.riskLevel === 'CRITICAL').length,
    };
  }

  private transformInitiative(init: any, lang: string): any {
    return {
      id: init.id,
      title: lang === 'ar' ? init.titleAr : init.titleEn,
      titleEn: init.titleEn,
      titleAr: init.titleAr,
      description: lang === 'ar' ? init.descriptionAr : init.descriptionEn,
      entity: init.entity
        ? {
            id: init.entity.id,
            name: lang === 'ar' ? init.entity.nameAr : init.entity.nameEn,
            type: init.entity.type,
          }
        : null,
      status: init.status,
      priority: init.priority,
      progress: init.progress,
      startDate: init.startDate,
      targetDate: init.targetDate,
      riskLevel: init.riskLevel,
      milestones: init.milestones?.map((m: any) => ({
        id: m.id,
        title: lang === 'ar' ? m.titleAr : m.titleEn,
        dueDate: m.dueDate,
        completedDate: m.completedDate,
        status: m.status,
      })),
      risks: init.risks?.map((r: any) => ({
        id: r.id,
        title: lang === 'ar' ? r.titleAr : r.titleEn,
        description: lang === 'ar' ? r.descriptionAr : r.descriptionEn,
        likelihood: r.likelihood,
        impact: r.impact,
        status: r.status,
        mitigation: lang === 'ar' ? r.mitigationAr : r.mitigationEn,
      })),
      dependencies: init.dependencies?.map((d: any) => ({
        id: d.id,
        title: lang === 'ar' ? d.titleAr : d.titleEn,
        toEntity: d.toEntity
          ? {
              id: d.toEntity.id,
              name: lang === 'ar' ? d.toEntity.nameAr : d.toEntity.nameEn,
            }
          : null,
        type: d.type,
        status: d.status,
        hasBlockers: d.blockers?.length > 0,
      })),
      alerts: init.alerts,
      createdAt: init.createdAt,
      updatedAt: init.updatedAt,
    };
  }
}
