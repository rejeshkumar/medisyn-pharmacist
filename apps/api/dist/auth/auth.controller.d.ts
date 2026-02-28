import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(dto: LoginDto): Promise<{
        access_token: string;
        user: {
            id: string;
            full_name: string;
            mobile: string;
            role: import("../database/entities/user.entity").UserRole;
        };
    }>;
    me(req: any): Promise<any>;
}
