import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const IS_PUBLIC_KEY = 'isPublic';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Skip for routes marked @Public() e.g. /auth/login
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const request = ctx.switchToHttp().getRequest();
    const user    = request.user; // populated by JwtAuthGuard before this runs

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!user.tenant_id) {
      throw new UnauthorizedException('Invalid tenant context — please log in again');
    }

    // Attach to request for easy access in controllers and services
    request.tenantId   = user.tenant_id;
    request.tenantMode = user.tenant_mode;
    request.userId     = user.id;
    request.userRole   = user.role;
    request.userName   = user.full_name;

    return true;
  }
}

// Helper: check if user has a role (supports both single role and roles array)
export function hasRole(user: any, ...roles: string[]): boolean {
  if (!user) return false;
  const userRoles: string[] = user.roles?.length ? user.roles : [user.role];
  return roles.some(r => userRoles.includes(r));
}
