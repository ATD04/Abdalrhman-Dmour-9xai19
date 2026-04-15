import { Controller, Get, Query, Headers } from '@nestjs/common';
import { CoordinationService } from './coordination.service';

@Controller('coordination')
export class CoordinationController {
  constructor(private readonly coordinationService: CoordinationService) {}

  @Get('dependencies')
  getDependencies(
    @Headers('accept-language') lang: string = 'en',
    @Query('entityId') entityId?: string,
    @Query('status') status?: string,
  ) {
    return this.coordinationService.getDependencies(lang, { entityId, status });
  }

  @Get('blockers')
  getBlockers(
    @Headers('accept-language') lang: string = 'en',
    @Query('escalationLevel') escalationLevel?: string,
  ) {
    return this.coordinationService.getBlockers(lang, escalationLevel);
  }

  @Get('dependency-map')
  getDependencyMap(@Headers('accept-language') lang: string = 'en') {
    return this.coordinationService.getDependencyMap(lang);
  }

  @Get('health')
  getCoordinationHealth() {
    return this.coordinationService.getCoordinationHealth();
  }
}
