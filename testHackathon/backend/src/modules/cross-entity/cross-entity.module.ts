import { Module } from '@nestjs/common';
import { CrossEntityController } from './cross-entity.controller';
import { CrossEntityService } from './cross-entity.service';

@Module({
  controllers: [CrossEntityController],
  providers: [CrossEntityService],
  exports: [CrossEntityService],
})
export class CrossEntityModule {}
