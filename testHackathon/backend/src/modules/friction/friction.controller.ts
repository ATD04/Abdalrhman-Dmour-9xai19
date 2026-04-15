import { Controller, Get, Param, Query, Headers } from '@nestjs/common';
import { FrictionService } from './friction.service';

@Controller('friction')
export class FrictionController {
  constructor(private readonly frictionService: FrictionService) {}

  @Get('pain-map')
  getServicePainMap(@Headers('accept-language') lang: string = 'en') {
    return this.frictionService.getServicePainMap(lang);
  }

  @Get('diagnosis/:serviceId')
  getFrictionDiagnosis(
    @Param('serviceId') serviceId: string,
    @Headers('accept-language') lang: string = 'en',
  ) {
    return this.frictionService.getFrictionDiagnosis(serviceId, lang);
  }

  @Get('priorities')
  getRedesignPriorities(
    @Headers('accept-language') lang: string = 'en',
    @Query('limit') limit?: string,
  ) {
    return this.frictionService.getRedesignPriorities(lang, limit ? parseInt(limit) : 10);
  }

  @Get('quick-wins')
  getQuickWins(@Headers('accept-language') lang: string = 'en') {
    return this.frictionService.getQuickWins(lang);
  }

  @Get('root-cause-summary')
  getRootCauseSummary() {
    return this.frictionService.getRootCauseSummary();
  }
}
