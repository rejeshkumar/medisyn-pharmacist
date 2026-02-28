import { Repository } from 'typeorm';
import { Patient } from '../database/entities/patient.entity';
import { PatientAppointment } from '../database/entities/patient-appointment.entity';
import { PatientReminder } from '../database/entities/patient-reminder.entity';
import { CreatePatientDto, VipRegisterDto } from './dto/create-patient.dto';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/create-appointment.dto';
import { CreateReminderDto } from './dto/create-reminder.dto';
export declare class PatientsService {
    private patientRepo;
    private apptRepo;
    private reminderRepo;
    constructor(patientRepo: Repository<Patient>, apptRepo: Repository<PatientAppointment>, reminderRepo: Repository<PatientReminder>);
    findAll(search?: string, isVip?: boolean, category?: string): Promise<Patient[]>;
    findOne(id: string): Promise<Patient>;
    create(dto: CreatePatientDto, userId: string): Promise<Patient>;
    update(id: string, dto: Partial<CreatePatientDto>): Promise<Patient>;
    vipRegister(dto: VipRegisterDto): Promise<Patient>;
    getStats(): Promise<{
        totalPatients: number;
        vipPatients: number;
        todayAppointments: number;
        missedCount: number;
    }>;
    getAppointments(patientId: string): Promise<PatientAppointment[]>;
    createAppointment(patientId: string, dto: CreateAppointmentDto, userId: string): Promise<PatientAppointment>;
    updateAppointment(id: string, dto: UpdateAppointmentDto): Promise<PatientAppointment>;
    getTodaySchedule(): Promise<PatientAppointment[]>;
    getMissedAppointments(): Promise<PatientAppointment[]>;
    getUpcomingAppointments(): Promise<PatientAppointment[]>;
    private autoMarkMissed;
    getReminders(patientId: string): Promise<PatientReminder[]>;
    createReminder(patientId: string, dto: CreateReminderDto, userId: string): Promise<PatientReminder>;
    markReminderDone(id: string): Promise<PatientReminder>;
    getDueReminders(): Promise<PatientReminder[]>;
    private generateUhid;
}
