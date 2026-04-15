import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Entity, EntityType, EntityStatus } from '@prisma/client';

@Injectable()
export class EntitiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(lang: string = 'en'): Promise<any[]> {
    const entities = await this.prisma.entity.findMany({
      include: {
        children: true,
        initiatives: {
          select: {
            id: true,
            status: true,
            progress: true,
          },
        },
        readinessScores: {
          orderBy: { assessmentDate: 'desc' },
          take: 5,
        },
      },
      orderBy: { nameEn: 'asc' },
    });

    return entities.map((entity) => this.transformEntity(entity, lang));
  }

  async findOne(id: string, lang: string = 'en'): Promise<any> {
    const entity = await this.prisma.entity.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        initiatives: true,
        services: true,
        readinessScores: {
          orderBy: { assessmentDate: 'desc' },
        },
        feedbackItems: {
          take: 10,
          orderBy: { receivedAt: 'desc' },
        },
      },
    });

    if (!entity) return null;
    return this.transformEntity(entity, lang);
  }

  async getEntityHierarchy(lang: string = 'en'): Promise<any[]> {
    const topLevel = await this.prisma.entity.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            children: true,
          },
        },
      },
      orderBy: { nameEn: 'asc' },
    });

    return topLevel.map((entity) => this.transformEntityHierarchy(entity, lang));
  }

  async getEntityStats(id: string): Promise<any> {
    const entity = await this.prisma.entity.findUnique({
      where: { id },
      include: {
        initiatives: true,
        services: true,
        readinessScores: true,
        feedbackItems: true,
      },
    });

    if (!entity) return null;

    const initiativeStats = {
      total: entity.initiatives.length,
      onTrack: entity.initiatives.filter((i) => i.status === 'ON_TRACK').length,
      atRisk: entity.initiatives.filter((i) => i.status === 'AT_RISK').length,
      delayed: entity.initiatives.filter((i) => i.status === 'DELAYED').length,
    };

    const avgReadiness =
      entity.readinessScores.length > 0
        ? Math.round(
            entity.readinessScores.reduce((sum, s) => sum + s.score, 0) /
              entity.readinessScores.length,
          )
        : 0;

    const feedbackSentiment = {
      positive: entity.feedbackItems.filter((f) => f.sentiment === 'POSITIVE').length,
      neutral: entity.feedbackItems.filter((f) => f.sentiment === 'NEUTRAL').length,
      negative: entity.feedbackItems.filter((f) => f.sentiment === 'NEGATIVE').length,
    };

    return {
      initiativeStats,
      servicesCount: entity.services.length,
      avgReadiness,
      feedbackSentiment,
    };
  }

  private transformEntity(entity: any, lang: string): any {
    return {
      id: entity.id,
      name: lang === 'ar' ? entity.nameAr : entity.nameEn,
      nameEn: entity.nameEn,
      nameAr: entity.nameAr,
      type: entity.type,
      status: entity.status,
      parentId: entity.parentId,
      parent: entity.parent
        ? {
            id: entity.parent.id,
            name: lang === 'ar' ? entity.parent.nameAr : entity.parent.nameEn,
          }
        : null,
      children: entity.children?.map((c: any) => ({
        id: c.id,
        name: lang === 'ar' ? c.nameAr : c.nameEn,
        type: c.type,
      })),
      initiatives: entity.initiatives,
      services: entity.services,
      readinessScores: entity.readinessScores,
      feedbackItems: entity.feedbackItems,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private transformEntityHierarchy(entity: any, lang: string): any {
    return {
      id: entity.id,
      name: lang === 'ar' ? entity.nameAr : entity.nameEn,
      type: entity.type,
      children: entity.children?.map((c: any) => this.transformEntityHierarchy(c, lang)),
    };
  }
}
