import { Module } from '@nestjs/common';
import { FrictionController } from './friction.controller';
import { FrictionService } from './friction.service';

@Module({
  controllers: [FrictionController],
  providers: [FrictionService],
  exports: [FrictionService],
})
export class FrictionModule {}
