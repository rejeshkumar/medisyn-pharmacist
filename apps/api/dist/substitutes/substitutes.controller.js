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
exports.SubstitutesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const substitutes_service_1 = require("./substitutes.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
let SubstitutesController = class SubstitutesController {
    constructor(substitutesService) {
        this.substitutesService = substitutesService;
    }
    getSubstitutes(medicineId) {
        return this.substitutesService.getSubstitutes(medicineId);
    }
};
exports.SubstitutesController = SubstitutesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get substitute medicines for a given medicine ID' }),
    (0, swagger_1.ApiQuery)({ name: 'medicine_id', required: true }),
    __param(0, (0, common_1.Query)('medicine_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SubstitutesController.prototype, "getSubstitutes", null);
exports.SubstitutesController = SubstitutesController = __decorate([
    (0, swagger_1.ApiTags)('Substitutes'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('substitutes'),
    __metadata("design:paramtypes", [substitutes_service_1.SubstitutesService])
], SubstitutesController);
//# sourceMappingURL=substitutes.controller.js.map