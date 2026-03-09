import { Repository } from 'typeorm';
import { Patient } from '../database/entities/patient.entity';
import { PatientAppointment } from '../database/entities/patient-appointment.entity';
import { PatientReminder } from '../database/entities/patient-reminder.entity';
import { CreatePatientDto, VipRegisterDto } from './dto/create-patient.dto';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/create-appointment.dto';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { AuditService } from '../audit/audit.service';
import { UserContext } from '../sales/sales.service';
export declare class PatientsService {
    private patientRepo;
    private apptRepo;
    private reminderRepo;
    private auditService;
    constructor(patientRepo: Repository<Patient>, apptRepo: Repository<PatientAppointment>, reminderRepo: Repository<PatientReminder>, auditService: AuditService);
    findAll(tenantId: string, search?: string, isVip?: boolean, category?: string): Promise<Patient[]>;
    findOne(id: string, tenantId: string): Promise<Patient>;
    create(dto: CreatePatientDto, user: UserContext): Promise<Patient>;
    update(id: string, dto: Partial<CreatePatientDto>, user: UserContext): Promise<Patient>;
    vipRegister(dto: VipRegisterDto, tenantId: string): Promise<Patient>;
    getStats(tenantId: string): Promise<{
        totalPatients: number;
        vipPatients: number;
        todayAppointments: number;
        missedCount: number;
    }>;
    getAppointments(patientId: string, tenantId: string): Promise<PatientAppointment[]>;
    createAppointment(patientId: string, dto: CreateAppointmentDto, user: UserContext): Promise<PatientAppointment>;
    updateAppointment(id: string, dto: UpdateAppointmentDto, tenantId: string): Promise<PatientAppointment>;
    getTodaySchedule(tenantId: string): Promise<PatientAppointment[]>;
    getMissedAppointments(tenantId: string): Promise<PatientAppointment[]>;
    getUpcomingAppointments(tenantId: string): Promise<PatientAppointment[]>;
    private autoMarkMissed;
    getReminders(patientId: string, tenantId: string): Promise<PatientReminder[]>;
    createReminder(patientId: string, dto: CreateReminderDto, user: UserContext): Promise<PatientReminder>;
    markReminderDone(id: string, tenantId: string): Promise<PatientReminder>;
    getDueReminders(tenantId: string): Promise<PatientReminder[]>;
    private generateUhid;
}
