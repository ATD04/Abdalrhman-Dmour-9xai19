import { Controller, Get, Param, Query, Headers } from '@nestjs/common';
import { ChiefOfStaffService } from './chief-of-staff.service';

@Controller('chief-of-staff')
export class ChiefOfStaffController {
  constructor(private readonly chiefOfStaffService: ChiefOfStaffService) {}

  @Get('daily-brief')
  getDailyBrief(@Headers('accept-language') lang: string = 'en') {
    return this.chiefOfStaffService.getDailyBrief(lang);
  }

  @Get('meeting-prep/:meetingId')
  getMeetingPrep(
    @Param('meetingId') meetingId: string,
    @Headers('accept-language') lang: string = 'en',
  ) {
    return this.chiefOfStaffService.getMeetingPrep(meetingId, lang);
  }

  @Get('decision-memo/:meetingId')
  getDecisionMemo(
    @Param('meetingId') meetingId: string,
    @Headers('accept-language') lang: string = 'en',
  ) {
    return this.chiefOfStaffService.getDecisionMemo(meetingId, lang);
  }

  @Get('follow-ups')
  getFollowUpTracker(
    @Headers('accept-language') lang: string = 'en',
    @Query('status') status?: string,
  ) {
    return this.chiefOfStaffService.getFollowUpTracker(lang, { status });
  }

  @Get('weekly-priorities')
  getWeeklyPriorities(@Headers('accept-language') lang: string = 'en') {
    return this.chiefOfStaffService.getWeeklyPriorities(lang);
  }
}
