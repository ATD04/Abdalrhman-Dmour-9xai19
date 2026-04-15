import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PolicyImpactService {
  constructor(private prisma: PrismaService) {}

  async getPolicyComparison(policyId: string, lang: string = 'en') {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        entity: true,
        options: true,
        impactAssessments: true,
      },
    });

    if (!policy) return null;

    const optionsComparison = policy.options.map((opt) => ({
      id: opt.id,
      title: lang === 'ar' ? opt.titleAr : opt.titleEn,
      description: lang === 'ar' ? opt.descriptionAr : opt.descriptionEn,
      scores: {
        effectiveness: opt.effectiveness,
        equity: opt.equity,
        cost: opt.cost,
        speed: opt.speed,
        risk: opt.risk,
      },
      overallScore: this.calculateOverallScore(opt),
      isRecommended: opt.isRecommended,
    }));

    const impactByStakeholder = policy.impactAssessments.reduce((acc, imp) => {
      if (!acc[imp.stakeholderGroup]) {
        acc[imp.stakeholderGroup] = [];
      }
      acc[imp.stakeholderGroup].push({
        type: imp.impactType,
        level: imp.impactLevel,
        description: lang === 'ar' ? imp.descriptionAr : imp.descriptionEn,
      });
      return acc;
    }, {} as Record<string, any[]>);

    return {
      policy: {
        id: policy.id,
        title: lang === 'ar' ? policy.titleAr : policy.titleEn,
        description: lang === 'ar' ? policy.descriptionAr : policy.descriptionEn,
        type: policy.type,
        status: policy.status,
        priority: policy.priority,
      },
      optionsComparison,
      impactByStakeholder,
      tradeoffSummary: this.generateTradeoffSummary(optionsComparison, lang),
    };
  }

  async getImpactSummary(policyId: string, lang: string = 'en') {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        options: {
          where: { isRecommended: true },
        },
        impactAssessments: true,
      },
    });

    if (!policy) return null;

    const recommendedOption = policy.options[0];
    
    const positiveImpacts = policy.impactAssessments.filter((i) => i.impactType === 'POSITIVE');
    const negativeImpacts = policy.impactAssessments.filter((i) => i.impactType === 'NEGATIVE');
    const mixedImpacts = policy.impactAssessments.filter((i) => i.impactType === 'MIXED');

    return {
      policy: {
        id: policy.id,
        title: lang === 'ar' ? policy.titleAr : policy.titleEn,
      },
      recommendedOption: recommendedOption ? {
        title: lang === 'ar' ? recommendedOption.titleAr : recommendedOption.titleEn,
        scores: {
          effectiveness: recommendedOption.effectiveness,
          equity: recommendedOption.equity,
          cost: recommendedOption.cost,
          speed: recommendedOption.speed,
          risk: recommendedOption.risk,
        },
      } : null,
      impactSummary: {
        positiveCount: positiveImpacts.length,
        negativeCount: negativeImpacts.length,
        mixedCount: mixedImpacts.length,
        netImpact: positiveImpacts.length - negativeImpacts.length > 0 
          ? 'POSITIVE' 
          : (positiveImpacts.length - negativeImpacts.length < 0 ? 'NEGATIVE' : 'NEUTRAL'),
      },
      stakeholderImpacts: {
        positive: positiveImpacts.map((i) => ({
          stakeholder: i.stakeholderGroup,
          level: i.impactLevel,
          description: lang === 'ar' ? i.descriptionAr : i.descriptionEn,
        })),
        negative: negativeImpacts.map((i) => ({
          stakeholder: i.stakeholderGroup,
          level: i.impactLevel,
          description: lang === 'ar' ? i.descriptionAr : i.descriptionEn,
        })),
      },
    };
  }

  async getTradeoffBrief(policyId: string, lang: string = 'en') {
    const comparison = await this.getPolicyComparison(policyId, lang);
    if (!comparison) return null;

    const options = comparison.optionsComparison;
    if (options.length < 2) {
      return {
        policy: comparison.policy,
        message: lang === 'ar' 
          ? 'يتطلب خيارين على الأقل لتحليل المفاضلة'
          : 'Requires at least 2 options for tradeoff analysis',
      };
    }

    const tradeoffs: any[] = [];
    const dimensions = ['effectiveness', 'equity', 'cost', 'speed', 'risk'] as const;
    type ScoreDimension = typeof dimensions[number];

    // Compare options pairwise
    for (let i = 0; i < options.length; i++) {
      for (let j = i + 1; j < options.length; j++) {
        const optA = options[i];
        const optB = options[j];

        const comparison: any = {
          optionA: optA.title,
          optionB: optB.title,
          advantages: { optionA: [], optionB: [] },
          keyTradeoff: '',
        };

        dimensions.forEach((dim: ScoreDimension) => {
          const scores = optA.scores as Record<ScoreDimension, number>;
          const scoresB = optB.scores as Record<ScoreDimension, number>;
          const diff = scores[dim] - scoresB[dim];
          if (Math.abs(diff) >= 15) {
            if (dim === 'cost' || dim === 'risk') {
              // Lower is better for cost and risk
              if (diff < 0) {
                comparison.advantages.optionA.push(dim);
              } else {
                comparison.advantages.optionB.push(dim);
              }
            } else {
              if (diff > 0) {
                comparison.advantages.optionA.push(dim);
              } else {
                comparison.advantages.optionB.push(dim);
              }
            }
          }
        });

        comparison.keyTradeoff = this.generateKeyTradeoff(comparison, lang);
        tradeoffs.push(comparison);
      }
    }

    return {
      policy: comparison.policy,
      tradeoffs,
      recommendation: this.generateRecommendation(options, lang),
    };
  }

  async getImplementationRisk(policyId: string, lang: string = 'en') {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        entity: true,
        options: {
          where: { isRecommended: true },
        },
      },
    });

    if (!policy) return null;

    const recommendedOption = policy.options[0];
    
    // Get readiness of related entities
    const readinessScores = await this.prisma.readinessScore.findMany({
      where: policy.entityId ? { entityId: policy.entityId } : undefined,
      orderBy: { assessmentDate: 'desc' },
    });

    const avgReadiness = readinessScores.length > 0
      ? Math.round(readinessScores.reduce((sum, s) => sum + s.score, 0) / readinessScores.length)
      : 50;

    const implementationComplexity = recommendedOption
      ? (recommendedOption.cost + recommendedOption.risk) / 2
      : 50;

    const riskFactors: any[] = [];
    
    if (avgReadiness < 50) {
      riskFactors.push({
        factor: lang === 'ar' ? 'انخفاض مستوى الجاهزية المؤسسية' : 'Low institutional readiness',
        severity: 'HIGH',
        mitigation: lang === 'ar'
          ? 'تقديم دعم مكثف لبناء القدرات'
          : 'Provide intensive capacity building support',
      });
    }

    if (implementationComplexity > 70) {
      riskFactors.push({
        factor: lang === 'ar' ? 'التعقيد العالي للتنفيذ' : 'High implementation complexity',
        severity: 'HIGH',
        mitigation: lang === 'ar'
          ? 'النظر في التنفيذ المرحلي'
          : 'Consider phased implementation',
      });
    }

    if (policy.type === 'LEGISLATION') {
      riskFactors.push({
        factor: lang === 'ar' ? 'مدة طويلة لعملية التشريع' : 'Long legislative process duration',
        severity: 'MEDIUM',
        mitigation: lang === 'ar'
          ? 'البدء بإعداد المسودة مبكراً'
          : 'Start draft preparation early',
      });
    }

    return {
      policy: {
        id: policy.id,
        title: lang === 'ar' ? policy.titleAr : policy.titleEn,
      },
      riskLevel: riskFactors.filter((r) => r.severity === 'HIGH').length >= 2 
        ? 'HIGH' 
        : riskFactors.length > 0 ? 'MEDIUM' : 'LOW',
      institutionalReadiness: avgReadiness,
      implementationComplexity,
      riskFactors,
      recommendedTimeline: this.recommendTimeline(implementationComplexity, avgReadiness),
    };
  }

  async getRecommendedAction(policyId: string, lang: string = 'en') {
    const [comparison, impact, risk] = await Promise.all([
      this.getPolicyComparison(policyId, lang),
      this.getImpactSummary(policyId, lang),
      this.getImplementationRisk(policyId, lang),
    ]);

    if (!comparison) return null;

    const recommendedOption = comparison.optionsComparison.find((o: any) => o.isRecommended);

    return {
      policy: comparison.policy,
      recommendation: {
        action: recommendedOption
          ? (lang === 'ar' ? 'الموافقة على الخيار الموصى به' : 'Approve recommended option')
          : (lang === 'ar' ? 'طلب مزيد من التحليل' : 'Request further analysis'),
        option: recommendedOption?.title,
        confidence: (recommendedOption?.overallScore ?? 0) >= 70 ? 'HIGH' : 'MEDIUM',
      },
      rationale: [
        lang === 'ar' 
          ? `صافي الأثر ${impact?.impactSummary.netImpact === 'POSITIVE' ? 'إيجابي' : 'محايد/سلبي'}`
          : `Net impact is ${impact?.impactSummary.netImpact}`,
        lang === 'ar'
          ? `مستوى المخاطر ${risk?.riskLevel === 'HIGH' ? 'مرتفع' : 'معتدل'}`
          : `Risk level is ${risk?.riskLevel}`,
        recommendedOption 
          ? (lang === 'ar' 
              ? `الخيار الموصى به يحقق أعلى درجة إجمالية`
              : `Recommended option achieves highest overall score`)
          : '',
      ].filter(Boolean),
      nextSteps: [
        lang === 'ar' ? 'مراجعة ملخص المفاضلات' : 'Review tradeoff summary',
        lang === 'ar' ? 'التشاور مع الأطراف المتأثرة' : 'Consult with affected stakeholders',
        lang === 'ar' ? 'تحديد جدول زمني للتنفيذ' : 'Define implementation timeline',
      ],
    };
  }

  private calculateOverallScore(option: any): number {
    // Higher effectiveness, equity, speed is better
    // Lower cost, risk is better
    const positiveScore = (option.effectiveness + option.equity + option.speed) / 3;
    const negativeScore = (option.cost + option.risk) / 2;
    return Math.round(positiveScore - (negativeScore * 0.3));
  }

  private generateTradeoffSummary(options: any[], lang: string): string {
    if (options.length < 2) return '';
    
    const best = options.reduce((a, b) => a.overallScore > b.overallScore ? a : b);
    const fastest = options.reduce((a, b) => a.scores.speed > b.scores.speed ? a : b);
    const cheapest = options.reduce((a, b) => a.scores.cost < b.scores.cost ? a : b);

    if (lang === 'ar') {
      return `${best.title} يحقق أعلى درجة إجمالية. ${fastest.title} الأسرع. ${cheapest.title} الأقل تكلفة.`;
    }
    return `${best.title} achieves highest overall score. ${fastest.title} is fastest. ${cheapest.title} is cheapest.`;
  }

  private generateKeyTradeoff(comparison: any, lang: string): string {
    const aAdvantages = comparison.advantages.optionA.join(', ');
    const bAdvantages = comparison.advantages.optionB.join(', ');

    if (lang === 'ar') {
      return `${comparison.optionA} أفضل في (${aAdvantages || 'لا شيء'}). ${comparison.optionB} أفضل في (${bAdvantages || 'لا شيء'}).`;
    }
    return `${comparison.optionA} better in (${aAdvantages || 'none'}). ${comparison.optionB} better in (${bAdvantages || 'none'}).`;
  }

  private generateRecommendation(options: any[], lang: string): string {
    const recommended = options.find((o) => o.isRecommended);
    if (recommended) {
      return lang === 'ar'
        ? `توصية: المضي قدماً مع "${recommended.title}" بناءً على الدرجة الإجمالية`
        : `Recommendation: Proceed with "${recommended.title}" based on overall score`;
    }
    
    const best = options.reduce((a, b) => a.overallScore > b.overallScore ? a : b);
    return lang === 'ar'
      ? `"${best.title}" يحقق أعلى درجة إجمالية`
      : `"${best.title}" achieves highest overall score`;
  }

  private recommendTimeline(complexity: number, readiness: number): string {
    const baseMonths = complexity > 70 ? 18 : complexity > 50 ? 12 : 6;
    const readinessAdjustment = readiness < 50 ? 6 : readiness < 70 ? 3 : 0;
    return `${baseMonths + readinessAdjustment} months`;
  }
}
