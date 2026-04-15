import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PoliciesService {
  constructor(private prisma: PrismaService) {}

  async findAll(lang: string = 'en', filters?: { status?: string; type?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;

    const policies = await this.prisma.policy.findMany({
      where,
      include: {
        entity: true,
        options: true,
        impactAssessments: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return policies.map((p) => this.transformPolicy(p, lang));
  }

  async findOne(id: string, lang: string = 'en') {
    const policy = await this.prisma.policy.findUnique({
      where: { id },
      include: {
        entity: true,
        options: true,
        impactAssessments: true,
      },
    });

    if (!policy) return null;
    return this.transformPolicy(policy, lang);
  }

  async getPendingDecisions(lang: string = 'en') {
    const policies = await this.prisma.policy.findMany({
      where: {
        status: { in: ['DRAFT', 'UNDER_REVIEW'] },
      },
      include: {
        entity: true,
        options: true,
      },
      orderBy: { priority: 'desc' },
    });

    return policies.map((p) => this.transformPolicy(p, lang));
  }

  async getImpactSummary() {
    const impacts = await this.prisma.policyImpact.findMany({
      include: {
        policy: true,
      },
    });

    const byStakeholder = impacts.reduce((acc, imp) => {
      if (!acc[imp.stakeholderGroup]) {
        acc[imp.stakeholderGroup] = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
      }
      acc[imp.stakeholderGroup][imp.impactType.toLowerCase()]++;
      return acc;
    }, {} as Record<string, any>);

    return {
      totalAssessments: impacts.length,
      byStakeholder,
      byImpactType: {
        positive: impacts.filter((i) => i.impactType === 'POSITIVE').length,
        negative: impacts.filter((i) => i.impactType === 'NEGATIVE').length,
        neutral: impacts.filter((i) => i.impactType === 'NEUTRAL').length,
        mixed: impacts.filter((i) => i.impactType === 'MIXED').length,
      },
    };
  }

  private transformPolicy(policy: any, lang: string): any {
    return {
      id: policy.id,
      title: lang === 'ar' ? policy.titleAr : policy.titleEn,
      titleEn: policy.titleEn,
      titleAr: policy.titleAr,
      description: lang === 'ar' ? policy.descriptionAr : policy.descriptionEn,
      entity: policy.entity
        ? {
            id: policy.entity.id,
            name: lang === 'ar' ? policy.entity.nameAr : policy.entity.nameEn,
          }
        : null,
      status: policy.status,
      type: policy.type,
      priority: policy.priority,
      options: policy.options?.map((opt: any) => ({
        id: opt.id,
        title: lang === 'ar' ? opt.titleAr : opt.titleEn,
        description: lang === 'ar' ? opt.descriptionAr : opt.descriptionEn,
        effectiveness: opt.effectiveness,
        equity: opt.equity,
        cost: opt.cost,
        speed: opt.speed,
        risk: opt.risk,
        isRecommended: opt.isRecommended,
      })),
      impactAssessments: policy.impactAssessments?.map((imp: any) => ({
        id: imp.id,
        stakeholderGroup: imp.stakeholderGroup,
        impactType: imp.impactType,
        impactLevel: imp.impactLevel,
        description: lang === 'ar' ? imp.descriptionAr : imp.descriptionEn,
      })),
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
    };
  }
}
