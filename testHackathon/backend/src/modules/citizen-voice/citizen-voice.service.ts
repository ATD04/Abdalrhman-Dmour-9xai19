import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CitizenVoiceService {
  constructor(private prisma: PrismaService) {}

  async getPublicVoiceBrief(lang: string = 'en') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const feedback = await this.prisma.feedback.findMany({
      where: { receivedAt: { gte: thirtyDaysAgo } },
      include: {
        service: true,
        entity: true,
      },
    });

    const totalCount = feedback.length;
    const positive = feedback.filter((f) => f.sentiment === 'POSITIVE').length;
    const neutral = feedback.filter((f) => f.sentiment === 'NEUTRAL').length;
    const negative = feedback.filter((f) => f.sentiment === 'NEGATIVE').length;

    // Top themes
    const themeCount: Record<string, number> = {};
    feedback.forEach((f) => {
      f.themes.forEach((theme) => {
        themeCount[theme] = (themeCount[theme] || 0) + 1;
      });
    });

    const topThemes = Object.entries(themeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme, count]) => ({ theme, count, percentage: Math.round((count / totalCount) * 100) }));

    // Top complained services
    const serviceComplaints: Record<string, { service: any; count: number }> = {};
    feedback
      .filter((f) => f.sentiment === 'NEGATIVE' && f.service)
      .forEach((f) => {
        if (!serviceComplaints[f.serviceId!]) {
          serviceComplaints[f.serviceId!] = { service: f.service, count: 0 };
        }
        serviceComplaints[f.serviceId!].count++;
      });

    const topComplainedServices = Object.values(serviceComplaints)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((s) => ({
        id: s.service.id,
        name: lang === 'ar' ? s.service.nameAr : s.service.nameEn,
        complaintCount: s.count,
      }));

    // Calculate trust pulse
    const trustScore = totalCount > 0
      ? Math.round(((positive - negative) / totalCount + 1) * 50)
      : 50;

    return {
      period: {
        start: thirtyDaysAgo.toISOString(),
        end: new Date().toISOString(),
      },
      overview: {
        totalFeedback: totalCount,
        sentimentBreakdown: {
          positive: { count: positive, percentage: Math.round((positive / totalCount) * 100) },
          neutral: { count: neutral, percentage: Math.round((neutral / totalCount) * 100) },
          negative: { count: negative, percentage: Math.round((negative / totalCount) * 100) },
        },
        trustPulse: {
          score: Math.max(0, Math.min(100, trustScore)),
          trend: trustScore >= 60 ? 'IMPROVING' : trustScore <= 40 ? 'DECLINING' : 'STABLE',
        },
      },
      topThemes,
      topComplainedServices,
      keyInsight: this.generateKeyInsight(topThemes, trustScore, lang),
    };
  }

  async getRecurringIssues(lang: string = 'en') {
    const feedback = await this.prisma.feedback.findMany({
      where: { sentiment: 'NEGATIVE' },
      include: {
        service: true,
        entity: true,
      },
    });

    // Group by theme and service
    const issues: Record<string, any> = {};

    feedback.forEach((f) => {
      f.themes.forEach((theme) => {
        const key = `${f.serviceId || 'general'}-${theme}`;
        if (!issues[key]) {
          issues[key] = {
            theme,
            service: f.service
              ? {
                  id: f.service.id,
                  name: lang === 'ar' ? f.service.nameAr : f.service.nameEn,
                }
              : null,
            entity: f.entity
              ? {
                  id: f.entity.id,
                  name: lang === 'ar' ? f.entity.nameAr : f.entity.nameEn,
                }
              : null,
            occurrences: 0,
            channels: new Set(),
            recentExamples: [],
          };
        }

        issues[key].occurrences++;
        issues[key].channels.add(f.channel);
        if (issues[key].recentExamples.length < 3) {
          issues[key].recentExamples.push({
            content: lang === 'ar' ? f.contentAr : f.contentEn,
            date: f.receivedAt,
            channel: f.channel,
          });
        }
      });
    });

    return Object.values(issues)
      .map((issue: any) => ({
        ...issue,
        channels: Array.from(issue.channels),
        severity: issue.occurrences >= 50 ? 'CRITICAL' : issue.occurrences >= 20 ? 'HIGH' : 'MEDIUM',
      }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10);
  }

  async getTrustPulse() {
    const periods = [7, 30, 90];
    const results: Record<string, any> = {};

    for (const days of periods) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const feedback = await this.prisma.feedback.findMany({
        where: { receivedAt: { gte: startDate } },
      });

      const total = feedback.length;
      const positive = feedback.filter((f) => f.sentiment === 'POSITIVE').length;
      const negative = feedback.filter((f) => f.sentiment === 'NEGATIVE').length;

      const score = total > 0
        ? Math.max(0, Math.min(100, Math.round(((positive - negative) / total + 1) * 50)))
        : 50;

      results[`last${days}Days`] = {
        score,
        totalFeedback: total,
        positive,
        negative,
        neutral: total - positive - negative,
      };
    }

    // Calculate trend
    const trend7 = results.last7Days.score;
    const trend30 = results.last30Days.score;

    return {
      ...results,
      overallTrend: trend7 > trend30 + 5 ? 'IMPROVING' : trend7 < trend30 - 5 ? 'DECLINING' : 'STABLE',
      trendIndicator: trend7 - trend30,
    };
  }

  async getThemeAnalysis(lang: string = 'en') {
    const feedback = await this.prisma.feedback.findMany({
      include: {
        service: true,
        entity: true,
      },
    });

    const themes: Record<string, any> = {};

    feedback.forEach((f) => {
      f.themes.forEach((theme) => {
        if (!themes[theme]) {
          themes[theme] = {
            theme,
            total: 0,
            positive: 0,
            neutral: 0,
            negative: 0,
            services: new Set(),
            entities: new Set(),
          };
        }

        themes[theme].total++;
        themes[theme][f.sentiment.toLowerCase()]++;
        if (f.service) themes[theme].services.add(f.serviceId);
        if (f.entity) themes[theme].entities.add(f.entityId);
      });
    });

    return Object.values(themes)
      .map((t: any) => ({
        theme: t.theme,
        totalMentions: t.total,
        sentimentBreakdown: {
          positive: t.positive,
          neutral: t.neutral,
          negative: t.negative,
        },
        sentiment: t.positive > t.negative ? 'POSITIVE' : t.negative > t.positive ? 'NEGATIVE' : 'MIXED',
        affectedServices: t.services.size,
        affectedEntities: t.entities.size,
      }))
      .sort((a, b) => b.totalMentions - a.totalMentions);
  }

  async getActionRecommendations(lang: string = 'en') {
    const [recurringIssues, trustPulse, themes] = await Promise.all([
      this.getRecurringIssues(lang),
      this.getTrustPulse(),
      this.getThemeAnalysis(lang),
    ]);

    const recommendations: any[] = [];

    // Based on recurring issues
    const criticalIssues = recurringIssues.filter((i: any) => i.severity === 'CRITICAL');
    criticalIssues.forEach((issue: any) => {
      recommendations.push({
        priority: 'HIGH',
        type: 'SERVICE_IMPROVEMENT',
        title: lang === 'ar'
          ? `معالجة المشكلة المتكررة: ${issue.theme}`
          : `Address recurring issue: ${issue.theme}`,
        description: lang === 'ar'
          ? `${issue.occurrences} شكوى حول ${issue.theme} ${issue.service ? `في خدمة ${issue.service.name}` : ''}`
          : `${issue.occurrences} complaints about ${issue.theme} ${issue.service ? `in ${issue.service.name} service` : ''}`,
        linkedService: issue.service,
        linkedEntity: issue.entity,
      });
    });

    // Based on trust pulse
    const trustPulseData = trustPulse as any;
    if (trustPulseData.overallTrend === 'DECLINING') {
      recommendations.push({
        priority: 'HIGH',
        type: 'TRUST_RECOVERY',
        title: lang === 'ar'
          ? 'مؤشر الثقة في انخفاض'
          : 'Trust pulse is declining',
        description: lang === 'ar'
          ? 'يجب إجراء تحليل عميق لأسباب تراجع رضا المواطنين'
          : 'Deep analysis required on causes of declining citizen satisfaction',
        metric: {
          current: trustPulseData.last7Days?.score ?? 0,
          previous: trustPulseData.last30Days?.score ?? 0,
          change: trustPulseData.trendIndicator ?? 0,
        },
      });
    }

    // Based on negative themes
    const negativeThemes = themes.filter((t: any) => t.sentiment === 'NEGATIVE');
    negativeThemes.slice(0, 3).forEach((theme: any) => {
      recommendations.push({
        priority: 'MEDIUM',
        type: 'THEME_INVESTIGATION',
        title: lang === 'ar'
          ? `التحقيق في موضوع: ${theme.theme}`
          : `Investigate theme: ${theme.theme}`,
        description: lang === 'ar'
          ? `${theme.totalMentions} إشارة سلبية تؤثر على ${theme.affectedServices} خدمات`
          : `${theme.totalMentions} negative mentions affecting ${theme.affectedServices} services`,
      });
    });

    return {
      recommendations: recommendations.sort((a, b) => 
        a.priority === 'HIGH' ? -1 : b.priority === 'HIGH' ? 1 : 0,
      ),
      summary: {
        totalRecommendations: recommendations.length,
        highPriority: recommendations.filter((r) => r.priority === 'HIGH').length,
        mediumPriority: recommendations.filter((r) => r.priority === 'MEDIUM').length,
      },
    };
  }

  private generateKeyInsight(topThemes: any[], trustScore: number, lang: string): string {
    const isArabic = lang === 'ar';
    
    if (trustScore < 40) {
      return isArabic
        ? 'مؤشر الثقة منخفض ويتطلب اهتماماً عاجلاً'
        : 'Trust pulse is low and requires urgent attention';
    }

    if (topThemes.length > 0 && topThemes[0].percentage > 30) {
      const theme = topThemes[0].theme;
      return isArabic
        ? `"${theme}" يمثل ${topThemes[0].percentage}% من التغذية الراجعة`
        : `"${theme}" represents ${topThemes[0].percentage}% of feedback`;
    }

    return isArabic
      ? 'التغذية الراجعة متوزعة عبر مواضيع متعددة'
      : 'Feedback is distributed across multiple themes';
  }
}
