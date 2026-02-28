import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { Patient } from '../database/entities/patient.entity';
import { PatientAppointment } from '../database/entities/patient-appointment.entity';
import { PatientReminder } from '../database/entities/patient-reminder.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, PatientAppointment, PatientReminder])],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
