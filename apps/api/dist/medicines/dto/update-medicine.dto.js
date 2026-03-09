"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateMedicineDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_medicine_dto_1 = require("./create-medicine.dto");
class UpdateMedicineDto extends (0, swagger_1.PartialType)(create_medicine_dto_1.CreateMedicineDto) {
}
exports.UpdateMedicineDto = UpdateMedicineDto;
//# sourceMappingURL=update-medicine.dto.js.map