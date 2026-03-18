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
exports.TimeController = void 0;
const common_1 = require("@nestjs/common");
const time_service_1 = require("./time.service");
const clock_in_dto_1 = require("./dto/clock-in.dto");
const clock_out_dto_1 = require("./dto/clock-out.dto");
let TimeController = class TimeController {
    constructor(time) {
        this.time = time;
    }
    clockIn(dto) {
        return this.time.clockIn(dto.employeeId);
    }
    clockOut(dto) {
        return this.time.clockOut(dto.entryId);
    }
    entries(employeeId) {
        return this.time.listEntries(employeeId);
    }
};
exports.TimeController = TimeController;
__decorate([
    (0, common_1.Post)('clock-in'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [clock_in_dto_1.ClockInDto]),
    __metadata("design:returntype", void 0)
], TimeController.prototype, "clockIn", null);
__decorate([
    (0, common_1.Post)('clock-out'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [clock_out_dto_1.ClockOutDto]),
    __metadata("design:returntype", void 0)
], TimeController.prototype, "clockOut", null);
__decorate([
    (0, common_1.Get)('entries'),
    __param(0, (0, common_1.Query)('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TimeController.prototype, "entries", null);
exports.TimeController = TimeController = __decorate([
    (0, common_1.Controller)('time'),
    __metadata("design:paramtypes", [time_service_1.TimeService])
], TimeController);
//# sourceMappingURL=time.controller.js.map