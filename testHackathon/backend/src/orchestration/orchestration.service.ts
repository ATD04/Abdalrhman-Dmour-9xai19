import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class OrchestrationService {
  constructor(private prisma: PrismaService) {}

  async getExecutiveDashboard(lang: string = 'en') {
    const [
      initiativeSummary,
      frictionSummary,
      readinessSummary,
      coordinationHealth,
      citizenTrust,
      upcomingMeetings,
      activeAlerts,
    ] = await Promise.all([
      this.getInitiativeSummary(),
      this.getFrictionSummary(),
      this.getReadinessSummary(),
      this.getCoordinationHealth(),
      this.getCitizenTrust(),
      this.getUpcomingMeetings(lang),
      this.getActiveAlerts(lang),
    ]);

    // Calculate overall health score
    const healthFactors = [
      initiativeSummary.healthScore,
      100 - frictionSummary.avgFrictionScore,
      readinessSummary.avgReadiness,
      coordinationHealth.healthScore,
      citizenTrust.score,
    ];
    const overallHealth = Math.round(
      healthFactors.reduce((a, b) => a + b, 0) / healthFactors.length,
    );

    return {
      overallHealth,
      healthStatus: overallHealth >= 70 ? 'GOOD' : overallHealth >= 50 ? 'MODERATE' : 'NEEDS_ATTENTION',
      initiatives: initiativeSummary,
      serviceFriction: frictionSummary,
      institutionalReadiness: readinessSummary,
      coordination: coordinationHealth,
      citizenTrust,
      upcomingMeetings: upcomingMeetings.slice(0, 3),
      criticalAlerts: activeAlerts.filter((a: any) => a.severity === 'CRITICAL' || a.severity === 'HIGH'),
      lastUpdated: new Date().toISOString(),
    };
  }

  async getCapabilityIntegration(lang: string = 'en') {
    // Show how capabilities connect
    return {
      capabilities: [
        {
          id: 'radar',
          name: lang === 'ar' ? 'رادار التنفيذي' : 'Executive Radar',
          description: lang === 'ar'
            ? 'رؤية عالية المستوى للأولويات والمخاطر'
            : 'High-level view of priorities and risks',
          inputs: ['initiatives', 'readiness', 'coordination', 'citizen-voice', 'policies'],
          outputs: ['morning-brief', 'alerts', 'priorities'],
        },
        {
          id: 'friction',
          name: lang === 'ar' ? 'ذكاء احتكاك الخدمات' : 'Service Friction Intelligence',
          description: lang === 'ar'
            ? 'تحديد وتحليل نقاط الألم في الخدمات'
            : 'Identify and analyze service pain points',
          inputs: ['services', 'citizen-voice'],
          outputs: ['pain-map', 'quick-wins', 'redesign-priorities'],
        },
        {
          id: 'readiness',
          name: lang === 'ar' ? 'محلل الجاهزية المؤسسية' : 'Institutional Readiness Analyzer',
          description: lang === 'ar'
            ? 'تقييم قدرة المؤسسات على التحديث'
            : 'Assess institutional modernization capability',
          inputs: ['entities', 'initiatives'],
          outputs: ['scorecards', 'heatmaps', 'improvement-plans'],
        },
        {
          id: 'policy-impact',
          name: lang === 'ar' ? 'مساعد تأثير السياسات' : 'Policy Impact Assistant',
          description: lang === 'ar'
            ? 'تقييم خيارات السياسات قبل التنفيذ'
            : 'Evaluate policy options before implementation',
          inputs: ['policies', 'readiness'],
          outputs: ['comparisons', 'tradeoffs', 'recommendations'],
        },
        {
          id: 'cross-entity',
          name: lang === 'ar' ? 'محرك التنسيق بين الجهات' : 'Cross-Entity Coordination Engine',
          description: lang === 'ar'
            ? 'تتبع التبعيات والمعوقات بين المؤسسات'
            : 'Track dependencies and blockers across institutions',
          inputs: ['initiatives', 'entities'],
          outputs: ['dependency-map', 'blockers', 'escalations'],
        },
        {
          id: 'citizen-voice',
          name: lang === 'ar' ? 'مترجم صوت المواطن' : 'Citizen Voice Translator',
          description: lang === 'ar'
            ? 'تحويل التغذية الراجعة إلى ذكاء قابل للتنفيذ'
            : 'Convert feedback into actionable intelligence',
          inputs: ['feedback'],
          outputs: ['trust-pulse', 'themes', 'recommendations'],
        },
        {
          id: 'chief-of-staff',
          name: lang === 'ar' ? 'مكتب رئيس الديوان' : "Chief of Staff Office",
          description: lang === 'ar'
            ? 'دعم التنفيذ والمتابعة الوزارية'
            : 'Executive support and follow-up tracking',
          inputs: ['all-capabilities', 'meetings'],
          outputs: ['daily-briefs', 'meeting-prep', 'follow-ups'],
        },
      ],
      dataFlows: [
        { from: 'citizen-voice', to: 'friction', data: 'complaints' },
        { from: 'citizen-voice', to: 'radar', data: 'trust-signals' },
        { from: 'readiness', to: 'radar', data: 'low-readiness-alerts' },
        { from: 'readiness', to: 'policy-impact', data: 'capability-data' },
        { from: 'cross-entity', to: 'radar', data: 'blockers' },
        { from: 'cross-entity', to: 'chief-of-staff', data: 'escalations' },
        { from: 'policy-impact', to: 'radar', data: 'high-risk-policies' },
        { from: 'friction', to: 'radar', data: 'critical-friction' },
        { from: 'radar', to: 'chief-of-staff', data: 'priorities' },
        { from: 'all', to: 'chief-of-staff', data: 'context-for-meetings' },
      ],
    };
  }

  async getCrossCapabilityInsights(lang: string = 'en') {
    // Generate insights that span multiple capabilities
    const insights: any[] = [];

    // Check if high friction services correlate with entities with low readiness
    const frictionServices = await this.prisma.service.findMany({
      where: { frictionScore: { gte: 70 } },
      include: { entity: true },
    });

    const readinessScores = await this.prisma.readinessScore.findMany({
      orderBy: { assessmentDate: 'desc' },
    });

    const entityReadiness = new Map<string, number>();
    readinessScores.forEach((s) => {
      if (!entityReadiness.has(s.entityId)) {
        entityReadiness.set(s.entityId, s.score);
      }
    });

    frictionServices.forEach((svc) => {
      const readiness = entityReadiness.get(svc.entityId) || 0;
      if (readiness < 50) {
        insights.push({
          type: 'CORRELATION',
          title: lang === 'ar'
            ? `ارتباط بين احتكاك الخدمة وانخفاض الجاهزية`
            : `Correlation between service friction and low readiness`,
          description: lang === 'ar'
            ? `خدمة "${svc.nameAr}" ذات احتكاك عالي (${svc.frictionScore}) في جهة ذات جاهزية منخفضة (${readiness})`
            : `Service "${svc.nameEn}" has high friction (${svc.frictionScore}) in entity with low readiness (${readiness})`,
          recommendation: lang === 'ar'
            ? 'معالجة الجاهزية المؤسسية قبل إعادة تصميم الخدمة'
            : 'Address institutional readiness before service redesign',
          linkedCapabilities: ['friction', 'readiness'],
        });
      }
    });

    // Check for citizen complaints about services with known blockers
    const blockedDeps = await this.prisma.dependency.findMany({
      where: { status: 'BLOCKED' },
      include: { initiative: true },
    });

    // Add more cross-capability insights as patterns emerge
    return {
      insights,
      generatedAt: new Date().toISOString(),
    };
  }

  private async getInitiativeSummary() {
    const initiatives = await this.prisma.initiative.findMany();
    const total = initiatives.length;
    const onTrack = initiatives.filter((i) => i.status === 'ON_TRACK').length;
    const atRisk = initiatives.filter((i) => i.status === 'AT_RISK').length;
    const delayed = initiatives.filter((i) => i.status === 'DELAYED').length;

    return {
      total,
      onTrack,
      atRisk,
      delayed,
      avgProgress: total > 0
        ? Math.round(initiatives.reduce((sum, i) => sum + i.progress, 0) / total)
        : 0,
      healthScore: total > 0 ? Math.round((onTrack / total) * 100) : 0,
    };
  }

  private async getFrictionSummary() {
    const services = await this.prisma.service.findMany();
    const total = services.length;
    const highFriction = services.filter((s) => s.frictionScore >= 70).length;

    return {
      totalServices: total,
      highFriction,
      avgFrictionScore: total > 0
        ? Math.round(services.reduce((sum, s) => sum + s.frictionScore, 0) / total)
        : 0,
    };
  }

  private async getReadinessSummary() {
    const scores = await this.prisma.readinessScore.findMany({
      orderBy: { assessmentDate: 'desc' },
    });

    const entityScores = new Map<string, number[]>();
    scores.forEach((s) => {
      if (!entityScores.has(s.entityId)) {
        entityScores.set(s.entityId, []);
      }
      entityScores.get(s.entityId)!.push(s.score);
    });

    const avgByEntity = Array.from(entityScores.values()).map(
      (scores) => Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    );

    const avgReadiness = avgByEntity.length > 0
      ? Math.round(avgByEntity.reduce((a, b) => a + b, 0) / avgByEntity.length)
      : 0;

    return {
      entitiesAssessed: entityScores.size,
      avgReadiness,
      readyToExecute: avgByEntity.filter((s) => s >= 70).length,
      needsSupport: avgByEntity.filter((s) => s < 50).length,
    };
  }

  private async getCoordinationHealth() {
    const dependencies = await this.prisma.dependency.findMany();
    const total = dependencies.length;
    const blocked = dependencies.filter((d) => d.status === 'BLOCKED').length;
    const completed = dependencies.filter((d) => d.status === 'COMPLETED').length;

    const healthScore = total > 0
      ? Math.round(100 - (blocked / total) * 100)
      : 100;

    return {
      totalDependencies: total,
      blocked,
      completed,
      healthScore,
    };
  }

  private async getCitizenTrust() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const feedback = await this.prisma.feedback.findMany({
      where: { receivedAt: { gte: thirtyDaysAgo } },
    });

    const total = feedback.length;
    const positive = feedback.filter((f) => f.sentiment === 'POSITIVE').length;
    const negative = feedback.filter((f) => f.sentiment === 'NEGATIVE').length;

    const score = total > 0
      ? Math.max(0, Math.min(100, Math.round(((positive - negative) / total + 1) * 50)))
      : 50;

    return {
      score,
      trend: score >= 60 ? 'IMPROVING' : score <= 40 ? 'DECLINING' : 'STABLE',
      feedbackCount: total,
    };
  }

  private async getUpcomingMeetings(lang: string) {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const meetings = await this.prisma.meeting.findMany({
      where: {
        scheduledAt: { gte: today, lte: nextWeek },
        status: 'SCHEDULED',
      },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    });

    return meetings.map((m) => ({
      id: m.id,
      title: lang === 'ar' ? m.titleAr : m.titleEn,
      scheduledAt: m.scheduledAt,
      type: m.meetingType,
    }));
  }

  private async getActiveAlerts(lang: string) {
    const alerts = await this.prisma.alert.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });

    return alerts.map((a) => ({
      id: a.id,
      title: lang === 'ar' ? a.titleAr : a.titleEn,
      type: a.type,
      severity: a.severity,
    }));
  }
}
