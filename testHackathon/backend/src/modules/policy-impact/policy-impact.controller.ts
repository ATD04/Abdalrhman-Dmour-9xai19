import { Controller, Get, Param, Headers } from '@nestjs/common';
import { PolicyImpactService } from './policy-impact.service';

@Controller('policy-impact')
export class PolicyImpactController {
  constructor(private readonly policyImpactService: PolicyImpactService) {}

  @Get('comparison/:policyId')
  getPolicyComparison(
    @Param('policyId') policyId: string,
    @Headers('accept-language') lang: string = 'en',
  ) {
    return this.policyImpactService.getPolicyComparison(policyId, lang);
  }

  @Get('summary/:policyId')
  getImpactSummary(
    @Param('policyId') policyId: string,
    @Headers('accept-language') lang: string = 'en',
  ) {
    return this.policyImpactService.getImpactSummary(policyId, lang);
  }

  @Get('tradeoffs/:policyId')
  getTradeoffBrief(
    @Param('policyId') policyId: string,
    @Headers('accept-language') lang: string = 'en',
  ) {
    return this.policyImpactService.getTradeoffBrief(policyId, lang);
  }

  @Get('risk/:policyId')
  getImplementationRisk(
    @Param('policyId') policyId: string,
    @Headers('accept-language') lang: string = 'en',
  ) {
    return this.policyImpactService.getImplementationRisk(policyId, lang);
  }

  @Get('recommendation/:policyId')
  getRecommendedAction(
    @Param('policyId') policyId: string,
    @Headers('accept-language') lang: string = 'en',
  ) {
    return this.policyImpactService.getRecommendedAction(policyId, lang);
  }
}
