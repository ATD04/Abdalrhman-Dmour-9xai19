import { Controller, Get, Param, Query, Headers } from '@nestjs/common';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  findAll(
    @Headers('accept-language') lang: string = 'en',
    @Query('entityId') entityId?: string,
    @Query('category') category?: string,
  ) {
    return this.servicesService.findAll(lang, { entityId, category });
  }

  @Get('high-friction')
  getHighFriction(
    @Headers('accept-language') lang: string = 'en',
    @Query('limit') limit?: string,
  ) {
    return this.servicesService.getHighFriction(lang, limit ? parseInt(limit) : 10);
  }

  @Get('summary')
  getFrictionSummary() {
    return this.servicesService.getFrictionSummary();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Headers('accept-language') lang: string = 'en') {
    return this.servicesService.findOne(id, lang);
  }
}
