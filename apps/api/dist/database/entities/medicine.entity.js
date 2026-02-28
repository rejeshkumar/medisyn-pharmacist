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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Medicine = exports.IntakeRoute = exports.RxUnit = exports.DosageForm = exports.ScheduleClass = void 0;
const typeorm_1 = require("typeorm");
const stock_batch_entity_1 = require("./stock-batch.entity");
var ScheduleClass;
(function (ScheduleClass) {
    ScheduleClass["OTC"] = "OTC";
    ScheduleClass["H"] = "H";
    ScheduleClass["H1"] = "H1";
    ScheduleClass["X"] = "X";
})(ScheduleClass || (exports.ScheduleClass = ScheduleClass = {}));
var DosageForm;
(function (DosageForm) {
    DosageForm["TABLET"] = "Tablet";
    DosageForm["CAPSULE"] = "Capsule";
    DosageForm["SYRUP"] = "Syrup";
    DosageForm["INJECTION"] = "Injection";
    DosageForm["VIAL"] = "Vial";
    DosageForm["SUSPENSION"] = "Suspension";
    DosageForm["DROPS"] = "Drops";
    DosageForm["POWDER"] = "Powder";
    DosageForm["GEL"] = "Gel";
    DosageForm["LIQUID"] = "Liquid";
    DosageForm["LOTION"] = "Lotion";
    DosageForm["CREAM"] = "Cream";
    DosageForm["EYE_DROPS"] = "Eye Drops";
    DosageForm["OINTMENT"] = "Ointment";
    DosageForm["SOAP"] = "Soap";
    DosageForm["INHALER"] = "Inhaler";
    DosageForm["PILL"] = "Pill";
    DosageForm["PATCH"] = "Patch";
    DosageForm["OTHER"] = "Other";
})(DosageForm || (exports.DosageForm = DosageForm = {}));
var RxUnit;
(function (RxUnit) {
    RxUnit["UNITS"] = "units";
    RxUnit["TSP"] = "tsp";
    RxUnit["ML"] = "ml";
    RxUnit["DROPS"] = "drps";
    RxUnit["PUFF"] = "puff";
    RxUnit["MG"] = "mg";
    RxUnit["MCG"] = "\u03BCg";
    RxUnit["G"] = "g";
})(RxUnit || (exports.RxUnit = RxUnit = {}));
var IntakeRoute;
(function (IntakeRoute) {
    IntakeRoute["ORAL"] = "Oral";
    IntakeRoute["TOPICAL"] = "Topical";
    IntakeRoute["PARENTERAL"] = "Parenteral";
    IntakeRoute["OPHTHALMIC"] = "Ophthalmic";
    IntakeRoute["OTIC"] = "Otic";
    IntakeRoute["NASAL"] = "Nasal";
    IntakeRoute["INHALATION"] = "Inhalation";
    IntakeRoute["SUBLINGUAL"] = "Sublingual";
    IntakeRoute["RECTAL"] = "Rectal";
    IntakeRoute["TRANSDERMAL"] = "Transdermal";
})(IntakeRoute || (exports.IntakeRoute = IntakeRoute = {}));
let Medicine = class Medicine {
};
exports.Medicine = Medicine;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Medicine.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Medicine.prototype, "brand_name", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Medicine.prototype, "molecule", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Medicine.prototype, "strength", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: 'Tablet' }),
    __metadata("design:type", String)
], Medicine.prototype, "dosage_form", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ScheduleClass, default: ScheduleClass.OTC }),
    __metadata("design:type", String)
], Medicine.prototype, "schedule_class", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Medicine.prototype, "substitute_group_key", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Medicine.prototype, "gst_percent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Medicine.prototype, "mrp", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Medicine.prototype, "sale_rate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Medicine.prototype, "manufacturer", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Medicine.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], Medicine.prototype, "rx_units", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Medicine.prototype, "stock_group", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Medicine.prototype, "treatment_for", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Medicine.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Medicine.prototype, "discount_percent", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Medicine.prototype, "rack_location", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], Medicine.prototype, "intake_route", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Medicine.prototype, "reorder_qty", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Medicine.prototype, "is_rx_required", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], Medicine.prototype, "is_active", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => stock_batch_entity_1.StockBatch, (batch) => batch.medicine),
    __metadata("design:type", Array)
], Medicine.prototype, "batches", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Medicine.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Medicine.prototype, "updated_at", void 0);
exports.Medicine = Medicine = __decorate([
    (0, typeorm_1.Entity)('medicines')
], Medicine);
//# sourceMappingURL=medicine.entity.js.map