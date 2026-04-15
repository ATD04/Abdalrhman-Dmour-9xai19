import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CoordinationService {
  constructor(private prisma: PrismaService) {}

  async getDependencies(lang: string = 'en', filters?: { entityId?: string; status?: string }) {
    const where: any = {};
    if (filters?.entityId) {
      where.OR = [
        { fromEntityId: filters.entityId },
        { toEntityId: filters.entityId },
      ];
    }
    if (filters?.status) where.status = filters.status;

    const dependencies = await this.prisma.dependency.findMany({
      where,
      include: {
        fromEntity: true,
        toEntity: true,
        initiative: true,
        blockers: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return dependencies.map((d) => this.transformDependency(d, lang));
  }

  async getBlockers(lang: string = 'en', escalationLevel?: string) {
    const where: any = {
      status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] },
    };
    if (escalationLevel) where.escalationLevel = escalationLevel;

    const blockers = await this.prisma.blocker.findMany({
      where,
      include: {
        dependency: {
          include: {
            fromEntity: true,
            toEntity: true,
            initiative: true,
          },
        },
      },
      orderBy: [{ escalationLevel: 'desc' }, { reportedDate: 'asc' }],
    });

    return blockers.map((b) => this.transformBlocker(b, lang));
  }

  async getDependencyMap(lang: string = 'en') {
    const dependencies = await this.prisma.dependency.findMany({
      include: {
        fromEntity: true,
        toEntity: true,
        blockers: {
          where: { status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] } },
        },
      },
    });

    // Build adjacency list
    const nodes: Set<string> = new Set();
    const edges: any[] = [];

    dependencies.forEach((d) => {
      nodes.add(d.fromEntityId);
      nodes.add(d.toEntityId);
      edges.push({
        from: d.fromEntityId,
        to: d.toEntityId,
        type: d.type,
        status: d.status,
        hasBlockers: d.blockers.length > 0,
        label: lang === 'ar' ? d.titleAr : d.titleEn,
      });
    });

    const entities = await this.prisma.entity.findMany({
      where: { id: { in: Array.from(nodes) } },
    });

    const nodeDetails = entities.map((e) => ({
      id: e.id,
      name: lang === 'ar' ? e.nameAr : e.nameEn,
      type: e.type,
    }));

    return { nodes: nodeDetails, edges };
  }

  async getCoordinationHealth() {
    const dependencies = await this.prisma.dependency.findMany({
      include: { blockers: true },
    });

    const blockers = await this.prisma.blocker.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] } },
    });

    const total = dependencies.length;
    const completed = dependencies.filter((d) => d.status === 'COMPLETED').length;
    const blocked = dependencies.filter((d) => d.status === 'BLOCKED').length;
    const overdue = dependencies.filter((d) => d.status === 'OVERDUE').length;

    const escalationBreakdown = blockers.reduce((acc, b) => {
      acc[b.escalationLevel] = (acc[b.escalationLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate health score (0-100)
    let healthScore = 100;
    if (total > 0) {
      healthScore -= (blocked / total) * 30;
      healthScore -= (overdue / total) * 20;
      healthScore -= (blockers.filter((b) => b.escalationLevel === 'MINISTERIAL').length * 5);
      healthScore -= (blockers.filter((b) => b.escalationLevel === 'SECRETARY_GENERAL').length * 3);
    }
    healthScore = Math.max(0, Math.round(healthScore));

    return {
      totalDependencies: total,
      statusBreakdown: {
        pending: dependencies.filter((d) => d.status === 'PENDING').length,
        inProgress: dependencies.filter((d) => d.status === 'IN_PROGRESS').length,
        completed,
        blocked,
        overdue,
      },
      activeBlockers: blockers.length,
      escalationBreakdown,
      healthScore,
    };
  }

  private transformDependency(dep: any, lang: string): any {
    return {
      id: dep.id,
      title: lang === 'ar' ? dep.titleAr : dep.titleEn,
      description: lang === 'ar' ? dep.descriptionAr : dep.descriptionEn,
      fromEntity: {
        id: dep.fromEntity.id,
        name: lang === 'ar' ? dep.fromEntity.nameAr : dep.fromEntity.nameEn,
        type: dep.fromEntity.type,
      },
      toEntity: {
        id: dep.toEntity.id,
        name: lang === 'ar' ? dep.toEntity.nameAr : dep.toEntity.nameEn,
        type: dep.toEntity.type,
      },
      initiative: dep.initiative
        ? {
            id: dep.initiative.id,
            title: lang === 'ar' ? dep.initiative.titleAr : dep.initiative.titleEn,
          }
        : null,
      type: dep.type,
      status: dep.status,
      dueDate: dep.dueDate,
      completedDate: dep.completedDate,
      blockers: dep.blockers?.map((b: any) => ({
        id: b.id,
        title: lang === 'ar' ? b.titleAr : b.titleEn,
        escalationLevel: b.escalationLevel,
        status: b.status,
      })),
    };
  }

  private transformBlocker(blocker: any, lang: string): any {
    return {
      id: blocker.id,
      title: lang === 'ar' ? blocker.titleAr : blocker.titleEn,
      description: lang === 'ar' ? blocker.descriptionAr : blocker.descriptionEn,
      reportedDate: blocker.reportedDate,
      escalationLevel: blocker.escalationLevel,
      status: blocker.status,
      resolution: lang === 'ar' ? blocker.resolutionAr : blocker.resolutionEn,
      dependency: blocker.dependency
        ? {
            id: blocker.dependency.id,
            title: lang === 'ar' ? blocker.dependency.titleAr : blocker.dependency.titleEn,
            fromEntity: {
              id: blocker.dependency.fromEntity.id,
              name: lang === 'ar' ? blocker.dependency.fromEntity.nameAr : blocker.dependency.fromEntity.nameEn,
            },
            toEntity: {
              id: blocker.dependency.toEntity.id,
              name: lang === 'ar' ? blocker.dependency.toEntity.nameAr : blocker.dependency.toEntity.nameEn,
            },
            initiative: blocker.dependency.initiative
              ? {
                  id: blocker.dependency.initiative.id,
                  title: lang === 'ar' ? blocker.dependency.initiative.titleAr : blocker.dependency.initiative.titleEn,
                }
              : null,
          }
        : null,
    };
  }
}
