import { Controller, Get, Param, Query, Headers } from '@nestjs/common';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  findAll(
    @Headers('accept-language') lang: string = 'en',
    @Query('entityId') entityId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('sentiment') sentiment?: string,
    @Query('source') source?: string,
  ) {
    return this.feedbackService.findAll(lang, { entityId, serviceId, sentiment, source });
  }

  @Get('themes')
  getThemeAnalysis() {
    return this.feedbackService.getThemeAnalysis();
  }

  @Get('sentiment-trend')
  getSentimentTrend(@Query('days') days?: string) {
    return this.feedbackService.getSentimentTrend(days ? parseInt(days) : 30);
  }

  @Get('recurring-issues')
  getRecurringIssues(
    @Headers('accept-language') lang: string = 'en',
    @Query('limit') limit?: string,
  ) {
    return this.feedbackService.getRecurringIssues(lang, limit ? parseInt(limit) : 10);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Headers('accept-language') lang: string = 'en') {
    return this.feedbackService.findOne(id, lang);
  }
}
