import { Module } from '@nestjs/common';
import { CitizenVoiceController } from './citizen-voice.controller';
import { CitizenVoiceService } from './citizen-voice.service';

@Module({
  controllers: [CitizenVoiceController],
  providers: [CitizenVoiceService],
  exports: [CitizenVoiceService],
})
export class CitizenVoiceModule {}
