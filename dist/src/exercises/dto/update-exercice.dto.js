"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateExerciseDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_exercice_dto_1 = require("./create-exercice.dto");
class UpdateExerciseDto extends (0, mapped_types_1.PartialType)(create_exercice_dto_1.CreateExerciseDto) {
}
exports.UpdateExerciseDto = UpdateExerciseDto;
//# sourceMappingURL=update-exercice.dto.js.map