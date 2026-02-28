"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const dayjs = require("dayjs");
const patient_entity_1 = require("../database/entities/patient.entity");
const patient_appointment_entity_1 = require("../database/entities/patient-appointment.entity");
const patient_reminder_entity_1 = require("../database/entities/patient-reminder.entity");
let PatientsService = class PatientsService {
    constructor(patientRepo, apptRepo, reminderRepo) {
        this.patientRepo = patientRepo;
        this.apptRepo = apptRepo;
        this.reminderRepo = reminderRepo;
    }
    async findAll(search, isVip, category) {
        const qb = this.patientRepo.createQueryBuilder('p').orderBy('p.created_at', 'DESC');
        if (search) {
            qb.where('(p.first_name ILIKE :s OR p.last_name ILIKE :s OR p.mobile ILIKE :s OR p.uhid ILIKE :s)', { s: `%${search}%` });
        }
        if (isVip !== undefined)
            qb.andWhere('p.is_vip = :v', { v: isVip });
        if (category)
            qb.andWhere('p.category = :c', { c: category });
        qb.andWhere('p.is_active = true');
        return qb.getMany();
    }
    async findOne(id) {
        const p = await this.patientRepo.findOne({
            where: { id },
            relations: ['appointments', 'reminders'],
        });
        if (!p)
            throw new common_1.NotFoundException('Patient not found');
        return p;
    }
    async create(dto, userId) {
        const uhid = await this.generateUhid();
        let vip_start = dto.vip_start_date;
        let vip_end = dto.vip_end_date;
        if (dto.is_vip) {
            if (!vip_start)
                vip_start = dayjs().format('YYYY-MM-DD');
            if (!vip_end)
                vip_end = dayjs(vip_start).add(1, 'year').format('YYYY-MM-DD');
        }
        const patient = this.patientRepo.create({
            ...dto,
            uhid,
            created_by: userId,
            vip_start_date: vip_start,
            vip_end_date: vip_end,
        });
        return this.patientRepo.save(patient);
    }
    async update(id, dto) {
        const patient = await this.findOne(id);
        if (dto.is_vip && !patient.is_vip) {
            const start = dto.vip_start_date || dayjs().format('YYYY-MM-DD');
            const end = dto.vip_end_date || dayjs(start).add(1, 'year').format('YYYY-MM-DD');
            dto.vip_start_date = start;
            dto.vip_end_date = end;
        }
        if (dto.is_vip && patient.is_vip && dto.vip_start_date && !dto.vip_end_date) {
            dto.vip_end_date = dayjs(dto.vip_start_date).add(1, 'year').format('YYYY-MM-DD');
        }
        Object.assign(patient, dto);
        return this.patientRepo.save(patient);
    }
    async vipRegister(dto) {
        let patient = await this.patientRepo.findOne({ where: { mobile: dto.mobile } });
        const vipStart = dayjs().format('YYYY-MM-DD');
        const vipEnd = dayjs().add(1, 'year').format('YYYY-MM-DD');
        if (patient) {
            patient.is_vip = true;
            patient.vip_start_date = vipStart;
            patient.vip_end_date = vipEnd;
            patient.vip_registered_by = dto.vip_registered_by || 'Sales Team';
            if (dto.first_name)
                patient.first_name = dto.first_name;
            if (dto.last_name)
                patient.last_name = dto.last_name;
            if (dto.email)
                patient.email = dto.email;
            if (dto.area)
                patient.area = dto.area;
            if (dto.address)
                patient.address = dto.address;
            return this.patientRepo.save(patient);
        }
        const uhid = await this.generateUhid();
        patient = this.patientRepo.create({
            ...dto,
            uhid,
            is_vip: true,
            vip_start_date: vipStart,
            vip_end_date: vipEnd,
            vip_registered_by: dto.vip_registered_by || 'Sales Team',
            category: 'general',
        });
        return this.patientRepo.save(patient);
    }
    async getStats() {
        const today = dayjs().format('YYYY-MM-DD');
        const [totalPatients, vipPatients, todayAppointments, missedCount] = await Promise.all([
            this.patientRepo.count({ where: { is_active: true } }),
            this.patientRepo.count({ where: { is_vip: true, is_active: true } }),
            this.apptRepo.count({ where: { appointment_date: today, status: patient_appointment_entity_1.AppointmentStatus.SCHEDULED } }),
            this.apptRepo.count({ where: { status: patient_appointment_entity_1.AppointmentStatus.MISSED } }),
        ]);
        return { totalPatients, vipPatients, todayAppointments, missedCount };
    }
    async getAppointments(patientId) {
        await this.autoMarkMissed(patientId);
        return this.apptRepo.find({
            where: { patient_id: patientId },
            order: { appointment_date: 'DESC' },
        });
    }
    async createAppointment(patientId, dto, userId) {
        await this.findOne(patientId);
        const appt = this.apptRepo.create({ ...dto, patient_id: patientId, created_by: userId });
        const saved = await this.apptRepo.save(appt);
        const remindAt = dayjs(dto.appointment_date).subtract(1, 'day').toDate();
        if (remindAt > new Date()) {
            await this.reminderRepo.save(this.reminderRepo.create({
                patient_id: patientId,
                appointment_id: saved.id,
                title: `Appointment reminder`,
                message: `You have a ${dto.type || 'consultation'} appointment scheduled for ${dto.appointment_date}${dto.appointment_time ? ' at ' + dto.appointment_time : ''}.`,
                remind_at: remindAt,
                type: 'appointment',
                created_by: userId,
            }));
        }
        return saved;
    }
    async updateAppointment(id, dto) {
        const appt = await this.apptRepo.findOne({ where: { id } });
        if (!appt)
            throw new common_1.NotFoundException('Appointment not found');
        Object.assign(appt, dto);
        return this.apptRepo.save(appt);
    }
    async getTodaySchedule() {
        const today = dayjs().format('YYYY-MM-DD');
        return this.apptRepo.find({
            where: { appointment_date: today, status: patient_appointment_entity_1.AppointmentStatus.SCHEDULED },
            relations: ['patient'],
            order: { appointment_time: 'ASC' },
        });
    }
    async getMissedAppointments() {
        return this.apptRepo.find({
            where: { status: patient_appointment_entity_1.AppointmentStatus.MISSED },
            relations: ['patient'],
            order: { appointment_date: 'DESC' },
        });
    }
    async getUpcomingAppointments() {
        const today = dayjs().format('YYYY-MM-DD');
        return this.apptRepo
            .createQueryBuilder('a')
            .leftJoinAndSelect('a.patient', 'p')
            .where('a.appointment_date >= :today', { today })
            .andWhere('a.status = :s', { s: patient_appointment_entity_1.AppointmentStatus.SCHEDULED })
            .orderBy('a.appointment_date', 'ASC')
            .addOrderBy('a.appointment_time', 'ASC')
            .limit(50)
            .getMany();
    }
    async autoMarkMissed(patientId) {
        const today = dayjs().format('YYYY-MM-DD');
        await this.apptRepo
            .createQueryBuilder()
            .update(patient_appointment_entity_1.PatientAppointment)
            .set({ status: patient_appointment_entity_1.AppointmentStatus.MISSED })
            .where('patient_id = :pid', { pid: patientId })
            .andWhere('appointment_date < :today', { today })
            .andWhere('status = :s', { s: patient_appointment_entity_1.AppointmentStatus.SCHEDULED })
            .execute();
    }
    async getReminders(patientId) {
        return this.reminderRepo.find({
            where: { patient_id: patientId },
            order: { remind_at: 'ASC' },
        });
    }
    async createReminder(patientId, dto, userId) {
        await this.findOne(patientId);
        const reminder = this.reminderRepo.create({
            ...dto,
            patient_id: patientId,
            remind_at: new Date(dto.remind_at),
            created_by: userId,
        });
        return this.reminderRepo.save(reminder);
    }
    async markReminderDone(id) {
        const reminder = await this.reminderRepo.findOne({ where: { id } });
        if (!reminder)
            throw new common_1.NotFoundException('Reminder not found');
        reminder.is_done = true;
        return this.reminderRepo.save(reminder);
    }
    async getDueReminders() {
        return this.reminderRepo
            .createQueryBuilder('r')
            .leftJoinAndSelect('r.patient', 'p')
            .where('r.remind_at <= :now', { now: new Date() })
            .andWhere('r.is_done = false')
            .orderBy('r.remind_at', 'ASC')
            .getMany();
    }
    async generateUhid() {
        const count = await this.patientRepo.count();
        const date = dayjs().format('YYYYMMDD');
        return `MED-${date}-${String(count + 1).padStart(4, '0')}`;
    }
};
exports.PatientsService = PatientsService;
exports.PatientsService = PatientsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(patient_entity_1.Patient)),
    __param(1, (0, typeorm_1.InjectRepository)(patient_appointment_entity_1.PatientAppointment)),
    __param(2, (0, typeorm_1.InjectRepository)(patient_reminder_entity_1.PatientReminder)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], PatientsService);
//# sourceMappingURL=patients.service.js.map