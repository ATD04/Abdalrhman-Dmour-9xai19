import { Module } from '@nestjs/common';
import { PolicyImpactController } from './policy-impact.controller';
import { PolicyImpactService } from './policy-impact.service';

@Module({
  controllers: [PolicyImpactController],
  providers: [PolicyImpactService],
  exports: [PolicyImpactService],
})
export class PolicyImpactModule {}
