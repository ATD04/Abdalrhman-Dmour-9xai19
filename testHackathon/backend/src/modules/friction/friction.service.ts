import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class FrictionService {
  constructor(private prisma: PrismaService) {}

  async getServicePainMap(lang: string = 'en') {
    const services = await this.prisma.service.findMany({
      include: {
        entity: true,
        frictionIncidents: true,
        feedbackItems: {
          where: { sentiment: 'NEGATIVE' },
        },
      },
      orderBy: { frictionScore: 'desc' },
    });

    return services.map((svc) => ({
      id: svc.id,
      name: lang === 'ar' ? svc.nameAr : svc.nameEn,
      entity: {
        id: svc.entity.id,
        name: lang === 'ar' ? svc.entity.nameAr : svc.entity.nameEn,
      },
      frictionScore: svc.frictionScore,
      category: svc.category,
      digitalStatus: svc.digitalStatus,
      metrics: {
        avgProcessingDays: svc.avgProcessingDays,
        documentsRequired: svc.documentsRequired,
        stepsCount: svc.stepsCount,
        annualVolume: svc.annualVolume,
      },
      incidentCount: svc.frictionIncidents.length,
      complaintCount: svc.feedbackItems.length,
      severity: svc.frictionScore >= 70 ? 'HIGH' : svc.frictionScore >= 40 ? 'MEDIUM' : 'LOW',
    }));
  }

  async getFrictionDiagnosis(serviceId: string, lang: string = 'en') {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        entity: true,
        journeySteps: {
          orderBy: { stepNumber: 'asc' },
        },
        frictionIncidents: true,
        feedbackItems: {
          where: { sentiment: 'NEGATIVE' },
          take: 20,
        },
      },
    });

    if (!service) return null;

    // Analyze journey steps for friction points
    const journeyAnalysis = service.journeySteps.map((step) => ({
      stepNumber: step.stepNumber,
      title: lang === 'ar' ? step.titleAr : step.titleEn,
      channelType: step.channelType,
      avgDuration: step.avgDuration,
      isDigital: step.isDigital,
      frictionRisk: !step.isDigital && step.channelType === 'IN_PERSON' ? 'HIGH' : 
                   step.avgDuration > 60 ? 'MEDIUM' : 'LOW',
    }));

    // Group incidents by type
    const incidentsByType = service.frictionIncidents.reduce((acc, inc) => {
      acc[inc.frictionType] = (acc[inc.frictionType] || 0) + inc.occurrences;
      return acc;
    }, {} as Record<string, number>);

    // Root cause analysis
    const rootCauses = service.frictionIncidents
      .filter((inc) => inc.rootCause)
      .reduce((acc, inc) => {
        acc[inc.rootCause!] = (acc[inc.rootCause!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    // Extract themes from negative feedback
    const themes: Record<string, number> = {};
    service.feedbackItems.forEach((fb) => {
      fb.themes.forEach((theme) => {
        themes[theme] = (themes[theme] || 0) + 1;
      });
    });

    return {
      service: {
        id: service.id,
        name: lang === 'ar' ? service.nameAr : service.nameEn,
        entity: {
          id: service.entity.id,
          name: lang === 'ar' ? service.entity.nameAr : service.entity.nameEn,
        },
        frictionScore: service.frictionScore,
        category: service.category,
      },
      metrics: {
        avgProcessingDays: service.avgProcessingDays,
        documentsRequired: service.documentsRequired,
        stepsCount: service.stepsCount,
        digitalSteps: journeyAnalysis.filter((s) => s.isDigital).length,
        manualSteps: journeyAnalysis.filter((s) => !s.isDigital).length,
      },
      journeyAnalysis,
      incidentAnalysis: {
        total: service.frictionIncidents.reduce((sum, i) => sum + i.occurrences, 0),
        byType: incidentsByType,
        topIncidents: service.frictionIncidents
          .sort((a, b) => b.occurrences - a.occurrences)
          .slice(0, 5)
          .map((inc) => ({
            title: lang === 'ar' ? inc.titleAr : inc.titleEn,
            type: inc.frictionType,
            severity: inc.severity,
            occurrences: inc.occurrences,
            recommendation: lang === 'ar' ? inc.recommendationAr : inc.recommendationEn,
          })),
      },
      rootCauseBreakdown: rootCauses,
      citizenFeedbackThemes: Object.entries(themes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([theme, count]) => ({ theme, count })),
    };
  }

  async getRedesignPriorities(lang: string = 'en', limit: number = 10) {
    const services = await this.prisma.service.findMany({
      where: { frictionScore: { gte: 50 } },
      include: {
        entity: true,
        frictionIncidents: {
          where: { status: { not: 'RESOLVED' } },
        },
      },
      orderBy: { frictionScore: 'desc' },
    });

    return services.slice(0, limit).map((svc, index) => ({
      rank: index + 1,
      id: svc.id,
      name: lang === 'ar' ? svc.nameAr : svc.nameEn,
      entity: lang === 'ar' ? svc.entity.nameAr : svc.entity.nameEn,
      frictionScore: svc.frictionScore,
      annualVolume: svc.annualVolume,
      impactScore: Math.round((svc.frictionScore * svc.annualVolume) / 10000),
      activeIncidents: svc.frictionIncidents.length,
      priorityRationale: lang === 'ar'
        ? this.getPriorityRationaleAr(svc)
        : this.getPriorityRationaleEn(svc),
    }));
  }

  async getQuickWins(lang: string = 'en') {
    const incidents = await this.prisma.frictionIncident.findMany({
      where: {
        status: { not: 'RESOLVED' },
        rootCause: { in: ['PROCESS', 'DESIGN', 'TRAINING'] },
        severity: { not: 'CRITICAL' },
      },
      include: {
        service: {
          include: { entity: true },
        },
      },
      orderBy: [{ occurrences: 'desc' }],
      take: 10,
    });

    return incidents.map((inc) => ({
      id: inc.id,
      title: lang === 'ar' ? inc.titleAr : inc.titleEn,
      service: {
        id: inc.service.id,
        name: lang === 'ar' ? inc.service.nameAr : inc.service.nameEn,
      },
      entity: {
        id: inc.service.entity.id,
        name: lang === 'ar' ? inc.service.entity.nameAr : inc.service.entity.nameEn,
      },
      frictionType: inc.frictionType,
      rootCause: inc.rootCause,
      occurrences: inc.occurrences,
      recommendation: lang === 'ar' ? inc.recommendationAr : inc.recommendationEn,
      estimatedEffort: this.estimateEffort(inc.rootCause, inc.frictionType),
      expectedImpact: this.estimateImpact(inc.occurrences, inc.severity),
    }));
  }

  async getRootCauseSummary() {
    const incidents = await this.prisma.frictionIncident.findMany({
      where: { status: { not: 'RESOLVED' } },
    });

    const byRootCause = incidents.reduce((acc, inc) => {
      const key = inc.rootCause || 'UNKNOWN';
      if (!acc[key]) {
        acc[key] = { count: 0, totalOccurrences: 0, severityBreakdown: {} };
      }
      acc[key].count++;
      acc[key].totalOccurrences += inc.occurrences;
      acc[key].severityBreakdown[inc.severity] = 
        (acc[key].severityBreakdown[inc.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, any>);

    return {
      summary: Object.entries(byRootCause)
        .map(([cause, data]: [string, any]) => ({
          rootCause: cause,
          incidentCount: data.count,
          totalOccurrences: data.totalOccurrences,
          severityBreakdown: data.severityBreakdown,
        }))
        .sort((a, b) => b.totalOccurrences - a.totalOccurrences),
      recommendations: this.generateRootCauseRecommendations(byRootCause),
    };
  }

  private getPriorityRationaleEn(service: any): string {
    const reasons = [];
    if (service.frictionScore >= 80) reasons.push('Very high friction score');
    if (service.annualVolume > 50000) reasons.push('High volume service');
    if (service.documentsRequired > 5) reasons.push('Excessive documentation');
    if (service.frictionIncidents.length > 3) reasons.push('Multiple reported incidents');
    return reasons.join(', ') || 'Requires attention';
  }

  private getPriorityRationaleAr(service: any): string {
    const reasons = [];
    if (service.frictionScore >= 80) reasons.push('درجة احتكاك عالية جداً');
    if (service.annualVolume > 50000) reasons.push('خدمة عالية الحجم');
    if (service.documentsRequired > 5) reasons.push('وثائق مطلوبة مفرطة');
    if (service.frictionIncidents.length > 3) reasons.push('حوادث متعددة مسجلة');
    return reasons.join('، ') || 'تتطلب اهتماماً';
  }

  private estimateEffort(rootCause: string | null, frictionType: string): string {
    if (rootCause === 'TRAINING' || frictionType === 'STAFF_ISSUE') return 'LOW';
    if (rootCause === 'PROCESS' || rootCause === 'DESIGN') return 'MEDIUM';
    if (rootCause === 'POLICY' || rootCause === 'TECHNICAL') return 'HIGH';
    return 'MEDIUM';
  }

  private estimateImpact(occurrences: number, severity: string): string {
    if (occurrences > 100 || severity === 'CRITICAL') return 'HIGH';
    if (occurrences > 20 || severity === 'HIGH') return 'MEDIUM';
    return 'LOW';
  }

  private generateRootCauseRecommendations(byRootCause: Record<string, any>): string[] {
    const recommendations: string[] = [];
    
    if (byRootCause['PROCESS']?.count > 3) {
      recommendations.push('Conduct process re-engineering workshop for top friction services');
    }
    if (byRootCause['TRAINING']?.count > 2) {
      recommendations.push('Implement targeted staff training program');
    }
    if (byRootCause['POLICY']?.count > 2) {
      recommendations.push('Review policy constraints with legal/regulatory team');
    }
    if (byRootCause['TECHNICAL']?.count > 2) {
      recommendations.push('Prioritize technical infrastructure improvements');
    }
    if (byRootCause['HANDOFF']?.count > 2) {
      recommendations.push('Establish clearer service level agreements between units');
    }

    return recommendations;
  }
}
