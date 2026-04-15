import { Module } from '@nestjs/common';
import { ChiefOfStaffController } from './chief-of-staff.controller';
import { ChiefOfStaffService } from './chief-of-staff.service';

@Module({
  controllers: [ChiefOfStaffController],
  providers: [ChiefOfStaffService],
  exports: [ChiefOfStaffService],
})
export class ChiefOfStaffModule {}
