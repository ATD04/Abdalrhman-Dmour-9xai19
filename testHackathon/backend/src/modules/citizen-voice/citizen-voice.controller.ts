import { Controller, Get, Headers } from '@nestjs/common';
import { CitizenVoiceService } from './citizen-voice.service';

@Controller('citizen-voice')
export class CitizenVoiceController {
  constructor(private readonly citizenVoiceService: CitizenVoiceService) {}

  @Get('brief')
  getPublicVoiceBrief(@Headers('accept-language') lang: string = 'en') {
    return this.citizenVoiceService.getPublicVoiceBrief(lang);
  }

  @Get('recurring-issues')
  getRecurringIssues(@Headers('accept-language') lang: string = 'en') {
    return this.citizenVoiceService.getRecurringIssues(lang);
  }

  @Get('trust-pulse')
  getTrustPulse() {
    return this.citizenVoiceService.getTrustPulse();
  }

  @Get('themes')
  getThemeAnalysis(@Headers('accept-language') lang: string = 'en') {
    return this.citizenVoiceService.getThemeAnalysis(lang);
  }

  @Get('recommendations')
  getActionRecommendations(@Headers('accept-language') lang: string = 'en') {
    return this.citizenVoiceService.getActionRecommendations(lang);
  }
}
