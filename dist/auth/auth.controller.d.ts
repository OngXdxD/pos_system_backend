import { Request } from 'express';
import { AuthService } from './auth.service';
import { PasscodeLoginDto } from './dto/passcode-login.dto';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    passcodeLogin(dto: PasscodeLoginDto, req: Request): Promise<{
        token: string;
        user: import("./auth.service").AuthUser;
    }>;
}
