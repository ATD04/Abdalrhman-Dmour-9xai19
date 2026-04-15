import { Controller, Get, Param, Query, Headers } from '@nestjs/common';
import { InitiativesService } from './initiatives.service';

@Controller('initiatives')
export class InitiativesController {
  constructor(private readonly initiativesService: InitiativesService) {}

  @Get()
  findAll(
    @Headers('accept-language') lang: string = 'en',
    @Query('status') status?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.initiativesService.findAll(lang, { status, entityId });
  }

  @Get('at-risk')
  getAtRisk(@Headers('accept-language') lang: string = 'en') {
    return this.initiativesService.getAtRisk(lang);
  }

  @Get('summary')
  getProgressSummary() {
    return this.initiativesService.getProgressSummary();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Headers('accept-language') lang: string = 'en') {
    return this.initiativesService.findOne(id, lang);
  }
}
