import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class FeedbackService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    lang: string = 'en',
    filters?: { entityId?: string; serviceId?: string; sentiment?: string; source?: string },
  ) {
    const where: any = {};
    if (filters?.entityId) where.entityId = filters.entityId;
    if (filters?.serviceId) where.serviceId = filters.serviceId;
    if (filters?.sentiment) where.sentiment = filters.sentiment;
    if (filters?.source) where.source = filters.source;

    const feedback = await this.prisma.feedback.findMany({
      where,
      include: {
        entity: true,
        service: true,
      },
      orderBy: { receivedAt: 'desc' },
      take: 100,
    });

    return feedback.map((f) => this.transformFeedback(f, lang));
  }

  async findOne(id: string, lang: string = 'en') {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id },
      include: {
        entity: true,
        service: true,
      },
    });

    if (!feedback) return null;
    return this.transformFeedback(feedback, lang);
  }

  async getThemeAnalysis() {
    const feedback = await this.prisma.feedback.findMany();
    
    // Aggregate themes
    const themeCount: Record<string, number> = {};
    feedback.forEach((f) => {
      f.themes.forEach((theme) => {
        themeCount[theme] = (themeCount[theme] || 0) + 1;
      });
    });

    const sortedThemes = Object.entries(themeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([theme, count]) => ({ theme, count }));

    return {
      topThemes: sortedThemes,
      totalFeedback: feedback.length,
      sentimentBreakdown: {
        positive: feedback.filter((f) => f.sentiment === 'POSITIVE').length,
        neutral: feedback.filter((f) => f.sentiment === 'NEUTRAL').length,
        negative: feedback.filter((f) => f.sentiment === 'NEGATIVE').length,
      },
    };
  }

  async getSentimentTrend(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const feedback = await this.prisma.feedback.findMany({
      where: {
        receivedAt: { gte: startDate },
      },
      orderBy: { receivedAt: 'asc' },
    });

    // Group by day
    const byDay: Record<string, { positive: number; neutral: number; negative: number }> = {};
    feedback.forEach((f) => {
      const day = f.receivedAt.toISOString().split('T')[0];
      if (!byDay[day]) {
        byDay[day] = { positive: 0, neutral: 0, negative: 0 };
      }
      byDay[day][f.sentiment.toLowerCase() as 'positive' | 'neutral' | 'negative']++;
    });

    return Object.entries(byDay).map(([date, counts]) => ({
      date,
      ...counts,
      total: counts.positive + counts.neutral + counts.negative,
    }));
  }

  async getRecurringIssues(lang: string = 'en', limit: number = 10) {
    const feedback = await this.prisma.feedback.findMany({
      where: { sentiment: 'NEGATIVE' },
      include: {
        entity: true,
        service: true,
      },
    });

    // Group by service and theme
    const issueGroups: Record<string, any> = {};
    feedback.forEach((f) => {
      f.themes.forEach((theme) => {
        const key = `${f.serviceId || 'general'}-${theme}`;
        if (!issueGroups[key]) {
          issueGroups[key] = {
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
            count: 0,
            recentExamples: [],
          };
        }
        issueGroups[key].count++;
        if (issueGroups[key].recentExamples.length < 3) {
          issueGroups[key].recentExamples.push({
            content: lang === 'ar' ? f.contentAr : f.contentEn,
            date: f.receivedAt,
          });
        }
      });
    });

    return Object.values(issueGroups)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, limit);
  }

  private transformFeedback(feedback: any, lang: string): any {
    return {
      id: feedback.id,
      content: lang === 'ar' ? feedback.contentAr : feedback.contentEn,
      contentEn: feedback.contentEn,
      contentAr: feedback.contentAr,
      entity: feedback.entity
        ? {
            id: feedback.entity.id,
            name: lang === 'ar' ? feedback.entity.nameAr : feedback.entity.nameEn,
          }
        : null,
      service: feedback.service
        ? {
            id: feedback.service.id,
            name: lang === 'ar' ? feedback.service.nameAr : feedback.service.nameEn,
          }
        : null,
      source: feedback.source,
      channel: feedback.channel,
      sentiment: feedback.sentiment,
      themes: feedback.themes,
      priority: feedback.priority,
      status: feedback.status,
      response: lang === 'ar' ? feedback.responseAr : feedback.responseEn,
      receivedAt: feedback.receivedAt,
      processedAt: feedback.processedAt,
    };
  }
}
