import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';

// Core modules
import { EntitiesModule } from './modules/entities/entities.module';
import { InitiativesModule } from './modules/initiatives/initiatives.module';
import { ServicesModule } from './modules/services/services.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { CoordinationModule } from './modules/coordination/coordination.module';
import { MeetingsModule } from './modules/meetings/meetings.module';

// Capability modules
import { RadarModule } from './modules/radar/radar.module';
import { FrictionModule } from './modules/friction/friction.module';
import { ReadinessModule } from './modules/readiness/readiness.module';
import { PolicyImpactModule } from './modules/policy-impact/policy-impact.module';
import { CrossEntityModule } from './modules/cross-entity/cross-entity.module';
import { CitizenVoiceModule } from './modules/citizen-voice/citizen-voice.module';
import { ChiefOfStaffModule } from './modules/chief-of-staff/chief-of-staff.module';

// Orchestration
import { OrchestrationModule } from './orchestration/orchestration.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    // Core data modules
    EntitiesModule,
    InitiativesModule,
    ServicesModule,
    PoliciesModule,
    FeedbackModule,
    CoordinationModule,
    MeetingsModule,
    // Capability modules
    RadarModule,
    FrictionModule,
    ReadinessModule,
    PolicyImpactModule,
    CrossEntityModule,
    CitizenVoiceModule,
    ChiefOfStaffModule,
    // Orchestration
    OrchestrationModule,
  ],
})
export class AppModule {}
