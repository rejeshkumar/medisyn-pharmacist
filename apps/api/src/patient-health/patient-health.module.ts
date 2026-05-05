import { Module } from '@nestjs/common';
import { PatientHealthController } from './patient-health.controller';
import { PatientHealthService } from './patient-health.service';

@Module({
  controllers: [PatientHealthController],
  providers: [PatientHealthService],
  exports: [PatientHealthService],
})
export class PatientHealthModule {}
