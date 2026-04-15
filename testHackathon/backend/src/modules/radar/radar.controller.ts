import { Controller, Get, Headers } from '@nestjs/common';
import { RadarService } from './radar.service';

@Controller('radar')
export class RadarController {
  constructor(private readonly radarService: RadarService) {}

  @Get()
  getExecutiveRadar(@Headers('accept-language') lang: string = 'en') {
    return this.radarService.getExecutiveRadar(lang);
  }

  @Get('morning-brief')
  getMorningBrief(@Headers('accept-language') lang: string = 'en') {
    return this.radarService.getMorningBrief(lang);
  }

  @Get('early-warnings')
  getEarlyWarnings(@Headers('accept-language') lang: string = 'en') {
    return this.radarService.getEarlyWarnings(lang);
  }

  @Get('momentum')
  getMomentumSnapshot() {
    return this.radarService.getMomentumSnapshot();
  }
}
