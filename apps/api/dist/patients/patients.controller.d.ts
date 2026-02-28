import { PatientsService } from './patients.service';
import { CreatePatientDto, VipRegisterDto } from './dto/create-patient.dto';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/create-appointment.dto';
import { CreateReminderDto } from './dto/create-reminder.dto';
export declare class PatientsController {
    private readonly patientsService;
    constructor(patientsService: PatientsService);
    vipRegister(dto: VipRegisterDto): Promise<import("../database/entities/patient.entity").Patient>;
    getStats(): Promise<{
        totalPatients: number;
        vipPatients: number;
        todayAppointments: number;
        missedCount: number;
    }>;
    getTodaySchedule(): Promise<import("../database/entities/patient-appointment.entity").PatientAppointment[]>;
    getMissedAppointments(): Promise<import("../database/entities/patient-appointment.entity").PatientAppointment[]>;
    getUpcomingAppointments(): Promise<import("../database/entities/patient-appointment.entity").PatientAppointment[]>;
    getDueReminders(): Promise<import("../database/entities/patient-reminder.entity").PatientReminder[]>;
    findAll(search?: string, isVip?: string, category?: string): Promise<import("../database/entities/patient.entity").Patient[]>;
    create(dto: CreatePatientDto, req: any): Promise<import("../database/entities/patient.entity").Patient>;
    findOne(id: string): Promise<import("../database/entities/patient.entity").Patient>;
    update(id: string, dto: Partial<CreatePatientDto>): Promise<import("../database/entities/patient.entity").Patient>;
    getAppointments(id: string): Promise<import("../database/entities/patient-appointment.entity").PatientAppointment[]>;
    createAppointment(id: string, dto: CreateAppointmentDto, req: any): Promise<import("../database/entities/patient-appointment.entity").PatientAppointment>;
    updateAppointment(apptId: string, dto: UpdateAppointmentDto): Promise<import("../database/entities/patient-appointment.entity").PatientAppointment>;
    getReminders(id: string): Promise<import("../database/entities/patient-reminder.entity").PatientReminder[]>;
    createReminder(id: string, dto: CreateReminderDto, req: any): Promise<import("../database/entities/patient-reminder.entity").PatientReminder>;
    markReminderDone(reminderId: string): Promise<import("../database/entities/patient-reminder.entity").PatientReminder>;
}
