import { Controller, Get, Headers } from '@nestjs/common';
import { CrossEntityService } from './cross-entity.service';

@Controller('cross-entity')
export class CrossEntityController {
  constructor(private readonly crossEntityService: CrossEntityService) {}

  @Get('dependency-map')
  getDependencyMap(@Headers('accept-language') lang: string = 'en') {
    return this.crossEntityService.getDependencyMap(lang);
  }

  @Get('blockers')
  getBlockerDashboard(@Headers('accept-language') lang: string = 'en') {
    return this.crossEntityService.getBlockerDashboard(lang);
  }

  @Get('escalation-queue')
  getEscalationQueue(@Headers('accept-language') lang: string = 'en') {
    return this.crossEntityService.getEscalationQueue(lang);
  }

  @Get('ownership-matrix')
  getOwnershipMatrix(@Headers('accept-language') lang: string = 'en') {
    return this.crossEntityService.getOwnershipMatrix(lang);
  }

  @Get('health')
  getCoordinationHealth() {
    return this.crossEntityService.getCoordinationHealth();
  }
}
