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
exports.BulkActivityLog = exports.BulkActionType = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
var BulkActionType;
(function (BulkActionType) {
    BulkActionType["BULK_IMPORT_MEDICINE"] = "bulk_import_medicine";
    BulkActionType["BULK_IMPORT_STOCK"] = "bulk_import_stock";
    BulkActionType["BULK_MODIFY_MEDICINE"] = "bulk_modify_medicine";
    BulkActionType["BULK_MODIFY_STOCK"] = "bulk_modify_stock";
})(BulkActionType || (exports.BulkActionType = BulkActionType = {}));
let BulkActivityLog = class BulkActivityLog {
};
exports.BulkActivityLog = BulkActivityLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], BulkActivityLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: BulkActionType }),
    __metadata("design:type", String)
], BulkActivityLog.prototype, "action_type", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], BulkActivityLog.prototype, "file_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], BulkActivityLog.prototype, "total_rows", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], BulkActivityLog.prototype, "success_rows", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], BulkActivityLog.prototype, "failed_rows", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], BulkActivityLog.prototype, "performed_by", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'performed_by' }),
    __metadata("design:type", user_entity_1.User)
], BulkActivityLog.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], BulkActivityLog.prototype, "error_file_url", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], BulkActivityLog.prototype, "created_at", void 0);
exports.BulkActivityLog = BulkActivityLog = __decorate([
    (0, typeorm_1.Entity)('bulk_activity_logs')
], BulkActivityLog);
//# sourceMappingURL=bulk-activity-log.entity.js.map