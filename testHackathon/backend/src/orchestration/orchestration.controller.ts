import { Controller, Get, Headers } from '@nestjs/common';
import { OrchestrationService } from './orchestration.service';

@Controller('orchestration')
export class OrchestrationController {
  constructor(private readonly orchestrationService: OrchestrationService) {}

  @Get('dashboard')
  getExecutiveDashboard(@Headers('accept-language') lang: string = 'en') {
    return this.orchestrationService.getExecutiveDashboard(lang);
  }

  @Get('integration')
  getCapabilityIntegration(@Headers('accept-language') lang: string = 'en') {
    return this.orchestrationService.getCapabilityIntegration(lang);
  }

  @Get('insights')
  getCrossCapabilityInsights(@Headers('accept-language') lang: string = 'en') {
    return this.orchestrationService.getCrossCapabilityInsights(lang);
  }
}
