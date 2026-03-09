import { PatientsService } from './patients.service';
import { CreatePatientDto, VipRegisterDto } from './dto/create-patient.dto';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/create-appointment.dto';
import { CreateReminderDto } from './dto/create-reminder.dto';
export declare class PatientsController {
    private readonly patientsService;
    constructor(patientsService: PatientsService);
    vipRegister(dto: VipRegisterDto): Promise<import("../database/entities/patient.entity").Patient>;
    getStats(req: any): Promise<{
        totalPatients: number;
        vipPatients: number;
        todayAppointments: number;
        missedCount: number;
    }>;
    getTodaySchedule(req: any): Promise<import("../database/entities/patient-appointment.entity").PatientAppointment[]>;
    getMissedAppointments(req: any): Promise<import("../database/entities/patient-appointment.entity").PatientAppointment[]>;
    getUpcomingAppointments(req: any): Promise<import("../database/entities/patient-appointment.entity").PatientAppointment[]>;
    getDueReminders(req: any): Promise<import("../database/entities/patient-reminder.entity").PatientReminder[]>;
    findAll(req: any, search?: string, isVip?: string, category?: string): Promise<import("../database/entities/patient.entity").Patient[]>;
    create(dto: CreatePatientDto, req: any): Promise<import("../database/entities/patient.entity").Patient>;
    findOne(id: string, req: any): Promise<import("../database/entities/patient.entity").Patient>;
    update(id: string, dto: Partial<CreatePatientDto>, req: any): Promise<import("../database/entities/patient.entity").Patient>;
    getAppointments(id: string, req: any): Promise<import("../database/entities/patient-appointment.entity").PatientAppointment[]>;
    createAppointment(id: string, dto: CreateAppointmentDto, req: any): Promise<import("../database/entities/patient-appointment.entity").PatientAppointment>;
    updateAppointment(apptId: string, dto: UpdateAppointmentDto, req: any): Promise<import("../database/entities/patient-appointment.entity").PatientAppointment>;
    getReminders(id: string, req: any): Promise<import("../database/entities/patient-reminder.entity").PatientReminder[]>;
    createReminder(id: string, dto: CreateReminderDto, req: any): Promise<import("../database/entities/patient-reminder.entity").PatientReminder>;
    markReminderDone(reminderId: string, req: any): Promise<import("../database/entities/patient-reminder.entity").PatientReminder>;
}
