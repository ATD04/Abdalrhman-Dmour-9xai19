import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CrossEntityService {
  constructor(private prisma: PrismaService) {}

  async getDependencyMap(lang: string = 'en') {
    const dependencies = await this.prisma.dependency.findMany({
      include: {
        fromEntity: true,
        toEntity: true,
        initiative: true,
        blockers: {
          where: { status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] } },
        },
      },
    });

    // Build graph structure
    const nodes = new Map<string, any>();
    const edges: any[] = [];

    dependencies.forEach((dep) => {
      // Add from entity
      if (!nodes.has(dep.fromEntityId)) {
        nodes.set(dep.fromEntityId, {
          id: dep.fromEntity.id,
          name: lang === 'ar' ? dep.fromEntity.nameAr : dep.fromEntity.nameEn,
          type: dep.fromEntity.type,
          dependencyCount: 0,
          blockedCount: 0,
        });
      }

      // Add to entity
      if (!nodes.has(dep.toEntityId)) {
        nodes.set(dep.toEntityId, {
          id: dep.toEntity.id,
          name: lang === 'ar' ? dep.toEntity.nameAr : dep.toEntity.nameEn,
          type: dep.toEntity.type,
          dependencyCount: 0,
          blockedCount: 0,
        });
      }

      // Update counts
      const fromNode = nodes.get(dep.fromEntityId)!;
      fromNode.dependencyCount++;
      if (dep.status === 'BLOCKED') fromNode.blockedCount++;

      // Add edge
      edges.push({
        id: dep.id,
        from: dep.fromEntityId,
        to: dep.toEntityId,
        title: lang === 'ar' ? dep.titleAr : dep.titleEn,
        type: dep.type,
        status: dep.status,
        hasBlockers: dep.blockers.length > 0,
        initiative: dep.initiative
          ? {
              id: dep.initiative.id,
              title: lang === 'ar' ? dep.initiative.titleAr : dep.initiative.titleEn,
            }
          : null,
      });
    });

    return {
      nodes: Array.from(nodes.values()),
      edges,
      summary: {
        totalDependencies: dependencies.length,
        blockedCount: dependencies.filter((d) => d.status === 'BLOCKED').length,
        completedCount: dependencies.filter((d) => d.status === 'COMPLETED').length,
      },
    };
  }

  async getBlockerDashboard(lang: string = 'en') {
    const blockers = await this.prisma.blocker.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] } },
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

    const byEscalation = {
      MINISTERIAL: [] as any[],
      SECRETARY_GENERAL: [] as any[],
      DIRECTOR: [] as any[],
      WORKING: [] as any[],
    };

    blockers.forEach((blocker) => {
      const item = {
        id: blocker.id,
        title: lang === 'ar' ? blocker.titleAr : blocker.titleEn,
        description: lang === 'ar' ? blocker.descriptionAr : blocker.descriptionEn,
        reportedDate: blocker.reportedDate,
        daysOpen: Math.floor(
          (Date.now() - blocker.reportedDate.getTime()) / (1000 * 60 * 60 * 24),
        ),
        status: blocker.status,
        dependency: {
          title: lang === 'ar' ? blocker.dependency.titleAr : blocker.dependency.titleEn,
          fromEntity: lang === 'ar' 
            ? blocker.dependency.fromEntity.nameAr 
            : blocker.dependency.fromEntity.nameEn,
          toEntity: lang === 'ar'
            ? blocker.dependency.toEntity.nameAr
            : blocker.dependency.toEntity.nameEn,
          initiative: blocker.dependency.initiative
            ? (lang === 'ar' 
                ? blocker.dependency.initiative.titleAr 
                : blocker.dependency.initiative.titleEn)
            : null,
        },
      };

      byEscalation[blocker.escalationLevel as keyof typeof byEscalation].push(item);
    });

    return {
      total: blockers.length,
      byEscalation,
      criticalCount: byEscalation.MINISTERIAL.length + byEscalation.SECRETARY_GENERAL.length,
      avgDaysOpen: blockers.length > 0
        ? Math.round(
            blockers.reduce(
              (sum, b) => sum + (Date.now() - b.reportedDate.getTime()) / (1000 * 60 * 60 * 24),
              0,
            ) / blockers.length,
          )
        : 0,
    };
  }

  async getEscalationQueue(lang: string = 'en') {
    // Get blockers that need escalation
    const blockers = await this.prisma.blocker.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      include: {
        dependency: {
          include: {
            fromEntity: true,
            toEntity: true,
          },
        },
      },
    });

    const escalationNeeded: any[] = [];

    blockers.forEach((blocker) => {
      const daysOpen = Math.floor(
        (Date.now() - blocker.reportedDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      let newLevel: string | null = null;
      if (daysOpen >= 30 && blocker.escalationLevel !== 'MINISTERIAL') {
        newLevel = 'MINISTERIAL';
      } else if (daysOpen >= 21 && ['WORKING', 'DIRECTOR'].includes(blocker.escalationLevel)) {
        newLevel = 'SECRETARY_GENERAL';
      } else if (daysOpen >= 14 && blocker.escalationLevel === 'WORKING') {
        newLevel = 'DIRECTOR';
      }

      if (newLevel) {
        escalationNeeded.push({
          id: blocker.id,
          title: lang === 'ar' ? blocker.titleAr : blocker.titleEn,
          currentLevel: blocker.escalationLevel,
          recommendedLevel: newLevel,
          daysOpen,
          dependency: {
            fromEntity: lang === 'ar'
              ? blocker.dependency.fromEntity.nameAr
              : blocker.dependency.fromEntity.nameEn,
            toEntity: lang === 'ar'
              ? blocker.dependency.toEntity.nameAr
              : blocker.dependency.toEntity.nameEn,
          },
          reason: lang === 'ar'
            ? `مر ${daysOpen} يوماً دون حل`
            : `${daysOpen} days without resolution`,
        });
      }
    });

    return escalationNeeded.sort((a, b) => b.daysOpen - a.daysOpen);
  }

  async getOwnershipMatrix(lang: string = 'en') {
    const dependencies = await this.prisma.dependency.findMany({
      include: {
        fromEntity: true,
        toEntity: true,
        initiative: true,
      },
    });

    // Group by initiative
    const byInitiative: Record<string, any> = {};

    dependencies.forEach((dep) => {
      if (!dep.initiative) return;

      const initKey = dep.initiativeId!;
      if (!byInitiative[initKey]) {
        byInitiative[initKey] = {
          initiative: {
            id: dep.initiative.id,
            title: lang === 'ar' ? dep.initiative.titleAr : dep.initiative.titleEn,
          },
          primaryOwner: {
            id: dep.fromEntity.id,
            name: lang === 'ar' ? dep.fromEntity.nameAr : dep.fromEntity.nameEn,
          },
          dependentEntities: new Map(),
        };
      }

      const depEntity = byInitiative[initKey].dependentEntities;
      if (!depEntity.has(dep.toEntityId)) {
        depEntity.set(dep.toEntityId, {
          id: dep.toEntity.id,
          name: lang === 'ar' ? dep.toEntity.nameAr : dep.toEntity.nameEn,
          dependencies: [],
        });
      }

      depEntity.get(dep.toEntityId).dependencies.push({
        id: dep.id,
        title: lang === 'ar' ? dep.titleAr : dep.titleEn,
        type: dep.type,
        status: dep.status,
      });
    });

    return Object.values(byInitiative).map((item: any) => ({
      ...item,
      dependentEntities: Array.from(item.dependentEntities.values()),
    }));
  }

  async getCoordinationHealth() {
    const dependencies = await this.prisma.dependency.findMany({
      include: { blockers: true },
    });

    const total = dependencies.length;
    if (total === 0) return { healthScore: 100, details: {} };

    const completed = dependencies.filter((d) => d.status === 'COMPLETED').length;
    const blocked = dependencies.filter((d) => d.status === 'BLOCKED').length;
    const overdue = dependencies.filter((d) => d.status === 'OVERDUE').length;
    const onTime = dependencies.filter((d) => d.status === 'IN_PROGRESS').length;

    const blockers = await this.prisma.blocker.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] } },
    });

    // Calculate health score
    let healthScore = 100;
    healthScore -= (blocked / total) * 40;
    healthScore -= (overdue / total) * 30;
    healthScore -= blockers.filter((b) => b.escalationLevel === 'MINISTERIAL').length * 5;
    healthScore -= blockers.filter((b) => b.escalationLevel === 'SECRETARY_GENERAL').length * 3;
    healthScore = Math.max(0, Math.round(healthScore));

    const healthStatus = healthScore >= 80 ? 'HEALTHY' : healthScore >= 60 ? 'AT_RISK' : 'CRITICAL';

    return {
      healthScore,
      healthStatus,
      details: {
        totalDependencies: total,
        completed,
        inProgress: onTime,
        blocked,
        overdue,
        completionRate: Math.round((completed / total) * 100),
      },
      blockerSummary: {
        total: blockers.length,
        ministerial: blockers.filter((b) => b.escalationLevel === 'MINISTERIAL').length,
        secretaryGeneral: blockers.filter((b) => b.escalationLevel === 'SECRETARY_GENERAL').length,
        director: blockers.filter((b) => b.escalationLevel === 'DIRECTOR').length,
        working: blockers.filter((b) => b.escalationLevel === 'WORKING').length,
      },
      recommendations: this.generateHealthRecommendations(healthScore, blocked, blockers),
    };
  }

  private generateHealthRecommendations(
    healthScore: number,
    blockedCount: number,
    blockers: any[],
  ): string[] {
    const recommendations: string[] = [];

    if (blockedCount > 3) {
      recommendations.push('Schedule coordination review meeting for blocked dependencies');
    }

    const ministerialBlockers = blockers.filter((b) => b.escalationLevel === 'MINISTERIAL');
    if (ministerialBlockers.length > 0) {
      recommendations.push('Address ministerial-level blockers in next leadership meeting');
    }

    if (healthScore < 60) {
      recommendations.push('Consider establishing dedicated cross-entity coordination team');
    }

    const oldBlockers = blockers.filter((b) => {
      const daysOpen = (Date.now() - b.reportedDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysOpen > 30;
    });
    if (oldBlockers.length > 0) {
      recommendations.push(`${oldBlockers.length} blockers open more than 30 days require intervention`);
    }

    return recommendations;
  }
}
