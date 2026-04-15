import { Controller, Get, Param, Query, Headers } from '@nestjs/common';
import { PoliciesService } from './policies.service';

@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get()
  findAll(
    @Headers('accept-language') lang: string = 'en',
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.policiesService.findAll(lang, { status, type });
  }

  @Get('pending')
  getPendingDecisions(@Headers('accept-language') lang: string = 'en') {
    return this.policiesService.getPendingDecisions(lang);
  }

  @Get('impact-summary')
  getImpactSummary() {
    return this.policiesService.getImpactSummary();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Headers('accept-language') lang: string = 'en') {
    return this.policiesService.findOne(id, lang);
  }
}
