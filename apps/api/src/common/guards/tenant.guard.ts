import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.tenant_id) {
      throw new ForbiddenException('No tenant context');
    }

    return true;
  }
}

// Helper: check if user has a role (supports both single role and roles array)
export function hasRole(user: any, ...roles: string[]): boolean {
  if (!user) return false;
  // Check roles array first (new), fallback to single role (legacy)
  const userRoles: string[] = user.roles?.length ? user.roles : [user.role];
  return roles.some(r => userRoles.includes(r));
}
