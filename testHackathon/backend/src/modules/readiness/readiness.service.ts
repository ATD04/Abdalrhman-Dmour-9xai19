import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ReadinessService {
  constructor(private prisma: PrismaService) {}

  async getReadinessScorecard(entityId: string, lang: string = 'en') {
    const entity = await this.prisma.entity.findUnique({
      where: { id: entityId },
      include: {
        readinessScores: {
          orderBy: { assessmentDate: 'desc' },
        },
        initiatives: {
          select: {
            id: true,
            status: true,
            progress: true,
          },
        },
      },
    });

    if (!entity) return null;

    // Get latest scores by dimension
    const latestScores: Record<string, number> = {};
    const dimensions = ['GOVERNANCE', 'CAPABILITIES', 'TECHNOLOGY', 'CULTURE', 'LEADERSHIP'];
    
    dimensions.forEach((dim) => {
      const score = entity.readinessScores.find((s) => s.dimension === dim);
      latestScores[dim] = score?.score || 0;
    });

    const avgScore = Math.round(
      Object.values(latestScores).reduce((a, b) => a + b, 0) / dimensions.length,
    );

    const maturityLevel = this.getMaturityLevel(avgScore);

    return {
      entity: {
        id: entity.id,
        name: lang === 'ar' ? entity.nameAr : entity.nameEn,
        type: entity.type,
      },
      overallScore: avgScore,
      maturityLevel,
      dimensions: dimensions.map((dim) => ({
        dimension: dim,
        score: latestScores[dim],
        level: this.getMaturityLevel(latestScores[dim]),
        status: latestScores[dim] >= 60 ? 'GOOD' : latestScores[dim] >= 40 ? 'NEEDS_IMPROVEMENT' : 'CRITICAL',
      })),
      initiativePerformance: {
        total: entity.initiatives.length,
        avgProgress: entity.initiatives.length > 0
          ? Math.round(entity.initiatives.reduce((sum, i) => sum + i.progress, 0) / entity.initiatives.length)
          : 0,
        onTrack: entity.initiatives.filter((i) => i.status === 'ON_TRACK').length,
        atRisk: entity.initiatives.filter((i) => i.status === 'AT_RISK' || i.status === 'DELAYED').length,
      },
      recommendations: this.generateRecommendations(latestScores, lang),
    };
  }

  async getMaturityHeatmap(lang: string = 'en') {
    const entities = await this.prisma.entity.findMany({
      include: {
        readinessScores: {
          orderBy: { assessmentDate: 'desc' },
        },
      },
      orderBy: { nameEn: 'asc' },
    });

    const dimensions = ['GOVERNANCE', 'CAPABILITIES', 'TECHNOLOGY', 'CULTURE', 'LEADERSHIP'];

    return entities.map((entity) => {
      const scores: Record<string, number> = {};
      dimensions.forEach((dim) => {
        const score = entity.readinessScores.find((s) => s.dimension === dim);
        scores[dim] = score?.score || 0;
      });

      const avgScore = Math.round(
        Object.values(scores).reduce((a, b) => a + b, 0) / dimensions.length,
      );

      return {
        id: entity.id,
        name: lang === 'ar' ? entity.nameAr : entity.nameEn,
        type: entity.type,
        overallScore: avgScore,
        maturityLevel: this.getMaturityLevel(avgScore),
        scores,
      };
    });
  }

  async getCapabilityGaps(lang: string = 'en') {
    const entities = await this.prisma.entity.findMany({
      include: {
        readinessScores: {
          orderBy: { assessmentDate: 'desc' },
        },
      },
    });

    const gaps: any[] = [];
    const dimensions = ['GOVERNANCE', 'CAPABILITIES', 'TECHNOLOGY', 'CULTURE', 'LEADERSHIP'];

    entities.forEach((entity) => {
      dimensions.forEach((dim) => {
        const score = entity.readinessScores.find((s) => s.dimension === dim);
        if (!score || score.score < 50) {
          gaps.push({
            entity: {
              id: entity.id,
              name: lang === 'ar' ? entity.nameAr : entity.nameEn,
              type: entity.type,
            },
            dimension: dim,
            currentScore: score?.score || 0,
            targetScore: 70,
            gap: 70 - (score?.score || 0),
            severity: !score || score.score < 30 ? 'CRITICAL' : 'MODERATE',
          });
        }
      });
    });

    return gaps.sort((a, b) => b.gap - a.gap);
  }

  async getReadinessComparison(lang: string = 'en') {
    const entities = await this.prisma.entity.findMany({
      include: {
        readinessScores: {
          orderBy: { assessmentDate: 'desc' },
        },
      },
    });

    const dimensions = ['GOVERNANCE', 'CAPABILITIES', 'TECHNOLOGY', 'CULTURE', 'LEADERSHIP'];

    // Calculate averages per dimension
    const dimensionAverages: Record<string, number[]> = {};
    dimensions.forEach((dim) => {
      dimensionAverages[dim] = [];
    });

    const entityData = entities.map((entity) => {
      const scores: Record<string, number> = {};
      dimensions.forEach((dim) => {
        const score = entity.readinessScores.find((s) => s.dimension === dim);
        scores[dim] = score?.score || 0;
        dimensionAverages[dim].push(scores[dim]);
      });

      const avgScore = Math.round(
        Object.values(scores).reduce((a, b) => a + b, 0) / dimensions.length,
      );

      return {
        id: entity.id,
        name: lang === 'ar' ? entity.nameAr : entity.nameEn,
        type: entity.type,
        overallScore: avgScore,
        scores,
      };
    });

    const benchmarks: Record<string, number> = {};
    dimensions.forEach((dim) => {
      const values = dimensionAverages[dim];
      benchmarks[dim] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    });

    return {
      entities: entityData.sort((a, b) => b.overallScore - a.overallScore),
      benchmarks,
      topPerformers: entityData.filter((e) => e.overallScore >= 70).length,
      needsSupport: entityData.filter((e) => e.overallScore < 50).length,
    };
  }

  async getImprovementPlan(entityId: string, lang: string = 'en') {
    const scorecard = await this.getReadinessScorecard(entityId, lang);
    if (!scorecard) return null;

    const weakDimensions = scorecard.dimensions
      .filter((d: any) => d.score < 60)
      .sort((a: any, b: any) => a.score - b.score);

    const improvementActions = weakDimensions.map((dim: any) => ({
      dimension: dim.dimension,
      currentScore: dim.score,
      targetScore: 70,
      timeframe: dim.score < 30 ? '12 months' : '6 months',
      actions: this.getImprovementActions(dim.dimension, dim.score, lang),
    }));

    return {
      entity: scorecard.entity,
      currentMaturity: scorecard.maturityLevel,
      targetMaturity: 'MANAGED',
      overallTimeline: weakDimensions.length > 2 ? '18 months' : '12 months',
      priorityAreas: improvementActions,
      quickWins: this.getQuickWins(weakDimensions, lang),
      resourceRequirements: this.estimateResources(weakDimensions),
    };
  }

  private getMaturityLevel(score: number): string {
    if (score >= 81) return 'OPTIMIZING';
    if (score >= 61) return 'MANAGED';
    if (score >= 41) return 'DEFINED';
    if (score >= 21) return 'DEVELOPING';
    return 'INITIAL';
  }

  private generateRecommendations(scores: Record<string, number>, lang: string): string[] {
    const recommendations: string[] = [];
    const isArabic = lang === 'ar';

    if (scores['GOVERNANCE'] < 50) {
      recommendations.push(isArabic 
        ? 'تحسين هيكل الحوكمة وتوضيح صلاحيات اتخاذ القرار'
        : 'Improve governance structure and clarify decision-making authority');
    }
    if (scores['CAPABILITIES'] < 50) {
      recommendations.push(isArabic
        ? 'وضع خطة لبناء القدرات وتطوير المهارات'
        : 'Develop a capacity building and skills development plan');
    }
    if (scores['TECHNOLOGY'] < 50) {
      recommendations.push(isArabic
        ? 'تحديث البنية التحتية التقنية والأنظمة'
        : 'Modernize technical infrastructure and systems');
    }
    if (scores['CULTURE'] < 50) {
      recommendations.push(isArabic
        ? 'إطلاق برنامج إدارة التغيير ونشر ثقافة الابتكار'
        : 'Launch change management program and innovation culture');
    }
    if (scores['LEADERSHIP'] < 50) {
      recommendations.push(isArabic
        ? 'تعزيز التزام القيادة ورعاية التحديث'
        : 'Strengthen leadership commitment and modernization sponsorship');
    }

    return recommendations;
  }

  private getImprovementActions(dimension: string, score: number, lang: string): string[] {
    const actions: Record<string, { en: string[]; ar: string[] }> = {
      GOVERNANCE: {
        en: [
          'Establish clear modernization governance committee',
          'Define decision-making matrix',
          'Implement progress monitoring framework',
        ],
        ar: [
          'إنشاء لجنة حوكمة التحديث',
          'تحديد مصفوفة صنع القرار',
          'تنفيذ إطار مراقبة التقدم',
        ],
      },
      CAPABILITIES: {
        en: [
          'Conduct skills gap assessment',
          'Develop training program for key competencies',
          'Consider strategic hiring or secondments',
        ],
        ar: [
          'إجراء تقييم فجوة المهارات',
          'تطوير برنامج تدريبي للكفاءات الأساسية',
          'النظر في التوظيف الاستراتيجي أو الإعارة',
        ],
      },
      TECHNOLOGY: {
        en: [
          'Assess current technology landscape',
          'Develop technology modernization roadmap',
          'Plan system integration priorities',
        ],
        ar: [
          'تقييم المشهد التقني الحالي',
          'وضع خارطة طريق تحديث التقنية',
          'تخطيط أولويات تكامل الأنظمة',
        ],
      },
      CULTURE: {
        en: [
          'Launch change management initiative',
          'Create innovation champions network',
          'Establish feedback and recognition mechanisms',
        ],
        ar: [
          'إطلاق مبادرة إدارة التغيير',
          'إنشاء شبكة سفراء الابتكار',
          'وضع آليات التغذية الراجعة والتقدير',
        ],
      },
      LEADERSHIP: {
        en: [
          'Secure executive sponsorship commitment',
          'Establish regular leadership review sessions',
          'Align incentives with modernization goals',
        ],
        ar: [
          'تأمين التزام الرعاية التنفيذية',
          'إنشاء جلسات مراجعة قيادية منتظمة',
          'مواءمة الحوافز مع أهداف التحديث',
        ],
      },
    };

    return lang === 'ar' ? actions[dimension]?.ar || [] : actions[dimension]?.en || [];
  }

  private getQuickWins(weakDimensions: any[], lang: string): string[] {
    const quickWins: string[] = [];
    const isArabic = lang === 'ar';

    weakDimensions.forEach((dim) => {
      if (dim.dimension === 'CULTURE') {
        quickWins.push(isArabic 
          ? 'تنظيم ورش عمل تعريفية بالتحديث'
          : 'Organize modernization awareness workshops');
      }
      if (dim.dimension === 'GOVERNANCE') {
        quickWins.push(isArabic
          ? 'تعيين منسق تحديث مؤقت'
          : 'Appoint interim modernization coordinator');
      }
    });

    return quickWins;
  }

  private estimateResources(weakDimensions: any[]): any {
    const dimensionCount = weakDimensions.length;
    const avgGap = weakDimensions.reduce((sum, d) => sum + (70 - d.score), 0) / dimensionCount;

    return {
      estimatedBudget: avgGap > 40 ? 'HIGH' : avgGap > 20 ? 'MEDIUM' : 'LOW',
      staffingNeeds: dimensionCount >= 3 ? 'Dedicated team required' : 'Part-time coordination',
      externalSupport: avgGap > 30 ? 'Recommended' : 'Optional',
    };
  }
}
