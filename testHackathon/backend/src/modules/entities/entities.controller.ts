import { Controller, Get, Param, Headers } from '@nestjs/common';
import { EntitiesService } from './entities.service';

@Controller('entities')
export class EntitiesController {
  constructor(private readonly entitiesService: EntitiesService) {}

  @Get()
  findAll(@Headers('accept-language') lang: string = 'en') {
    return this.entitiesService.findAll(lang);
  }

  @Get('hierarchy')
  getHierarchy(@Headers('accept-language') lang: string = 'en') {
    return this.entitiesService.getEntityHierarchy(lang);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Headers('accept-language') lang: string = 'en') {
    return this.entitiesService.findOne(id, lang);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.entitiesService.getEntityStats(id);
  }
}
