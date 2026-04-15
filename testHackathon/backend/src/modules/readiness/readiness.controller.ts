import { Controller, Get, Param, Headers } from '@nestjs/common';
import { ReadinessService } from './readiness.service';

@Controller('readiness')
export class ReadinessController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get('scorecard/:entityId')
  getReadinessScorecard(
    @Param('entityId') entityId: string,
    @Headers('accept-language') lang: string = 'en',
  ) {
    return this.readinessService.getReadinessScorecard(entityId, lang);
  }

  @Get('heatmap')
  getMaturityHeatmap(@Headers('accept-language') lang: string = 'en') {
    return this.readinessService.getMaturityHeatmap(lang);
  }

  @Get('gaps')
  getCapabilityGaps(@Headers('accept-language') lang: string = 'en') {
    return this.readinessService.getCapabilityGaps(lang);
  }

  @Get('comparison')
  getReadinessComparison(@Headers('accept-language') lang: string = 'en') {
    return this.readinessService.getReadinessComparison(lang);
  }

  @Get('improvement-plan/:entityId')
  getImprovementPlan(
    @Param('entityId') entityId: string,
    @Headers('accept-language') lang: string = 'en',
  ) {
    return this.readinessService.getImprovementPlan(entityId, lang);
  }
}
