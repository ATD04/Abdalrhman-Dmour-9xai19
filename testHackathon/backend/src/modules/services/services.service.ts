import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(lang: string = 'en', filters?: { entityId?: string; category?: string }) {
    const where: any = {};
    if (filters?.entityId) where.entityId = filters.entityId;
    if (filters?.category) where.category = filters.category;

    const services = await this.prisma.service.findMany({
      where,
      include: {
        entity: true,
        journeySteps: {
          orderBy: { stepNumber: 'asc' },
        },
        frictionIncidents: {
          where: { status: { not: 'RESOLVED' } },
        },
        feedbackItems: {
          take: 5,
          orderBy: { receivedAt: 'desc' },
        },
      },
      orderBy: { frictionScore: 'desc' },
    });

    return services.map((svc) => this.transformService(svc, lang));
  }

  async findOne(id: string, lang: string = 'en') {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        entity: true,
        journeySteps: {
          orderBy: { stepNumber: 'asc' },
        },
        frictionIncidents: true,
        feedbackItems: {
          orderBy: { receivedAt: 'desc' },
        },
      },
    });

    if (!service) return null;
    return this.transformService(service, lang);
  }

  async getHighFriction(lang: string = 'en', limit: number = 10) {
    const services = await this.prisma.service.findMany({
      where: {
        frictionScore: { gte: 60 },
      },
      include: {
        entity: true,
        frictionIncidents: {
          where: { status: { not: 'RESOLVED' } },
        },
      },
      orderBy: { frictionScore: 'desc' },
      take: limit,
    });

    return services.map((svc) => this.transformService(svc, lang));
  }

  async getFrictionSummary() {
    const services = await this.prisma.service.findMany({
      include: {
        frictionIncidents: true,
      },
    });

    const totalServices = services.length;
    const highFriction = services.filter((s) => s.frictionScore >= 70).length;
    const mediumFriction = services.filter((s) => s.frictionScore >= 40 && s.frictionScore < 70).length;
    const lowFriction = services.filter((s) => s.frictionScore < 40).length;
    const avgFrictionScore = Math.round(
      services.reduce((sum, s) => sum + s.frictionScore, 0) / totalServices,
    );

    const incidents = await this.prisma.frictionIncident.findMany();
    const incidentsByType = incidents.reduce((acc, inc) => {
      acc[inc.frictionType] = (acc[inc.frictionType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalServices,
      frictionDistribution: {
        high: highFriction,
        medium: mediumFriction,
        low: lowFriction,
      },
      avgFrictionScore,
      totalIncidents: incidents.length,
      incidentsByType,
    };
  }

  private transformService(svc: any, lang: string): any {
    return {
      id: svc.id,
      name: lang === 'ar' ? svc.nameAr : svc.nameEn,
      nameEn: svc.nameEn,
      nameAr: svc.nameAr,
      description: lang === 'ar' ? svc.descriptionAr : svc.descriptionEn,
      entity: svc.entity
        ? {
            id: svc.entity.id,
            name: lang === 'ar' ? svc.entity.nameAr : svc.entity.nameEn,
          }
        : null,
      category: svc.category,
      digitalStatus: svc.digitalStatus,
      avgProcessingDays: svc.avgProcessingDays,
      documentsRequired: svc.documentsRequired,
      stepsCount: svc.stepsCount,
      annualVolume: svc.annualVolume,
      frictionScore: svc.frictionScore,
      journeySteps: svc.journeySteps?.map((step: any) => ({
        id: step.id,
        stepNumber: step.stepNumber,
        title: lang === 'ar' ? step.titleAr : step.titleEn,
        description: lang === 'ar' ? step.descriptionAr : step.descriptionEn,
        channelType: step.channelType,
        avgDuration: step.avgDuration,
        isDigital: step.isDigital,
      })),
      frictionIncidents: svc.frictionIncidents?.map((inc: any) => ({
        id: inc.id,
        title: lang === 'ar' ? inc.titleAr : inc.titleEn,
        description: lang === 'ar' ? inc.descriptionAr : inc.descriptionEn,
        frictionType: inc.frictionType,
        severity: inc.severity,
        rootCause: inc.rootCause,
        status: inc.status,
        occurrences: inc.occurrences,
        recommendation: lang === 'ar' ? inc.recommendationAr : inc.recommendationEn,
      })),
      feedbackItems: svc.feedbackItems,
      createdAt: svc.createdAt,
      updatedAt: svc.updatedAt,
    };
  }
}
