import { Controller, Get, Param, Query, Headers } from '@nestjs/common';
import { MeetingsService } from './meetings.service';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  findAll(
    @Headers('accept-language') lang: string = 'en',
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.meetingsService.findAll(lang, { status, type });
  }

  @Get('upcoming')
  getUpcoming(
    @Headers('accept-language') lang: string = 'en',
    @Query('days') days?: string,
  ) {
    return this.meetingsService.getUpcoming(lang, days ? parseInt(days) : 7);
  }

  @Get('decisions')
  getDecisions(
    @Headers('accept-language') lang: string = 'en',
    @Query('status') status?: string,
  ) {
    return this.meetingsService.getDecisions(lang, { status });
  }

  @Get('follow-ups')
  getFollowUps(
    @Headers('accept-language') lang: string = 'en',
    @Query('status') status?: string,
  ) {
    return this.meetingsService.getFollowUps(lang, { status });
  }

  @Get('overdue')
  getOverdueItems(@Headers('accept-language') lang: string = 'en') {
    return this.meetingsService.getOverdueItems(lang);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Headers('accept-language') lang: string = 'en') {
    return this.meetingsService.findOne(id, lang);
  }
}
