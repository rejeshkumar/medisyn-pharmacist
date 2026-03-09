import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Use @Public() on any controller route that should skip JWT + TenantGuard
// Example: @Public() on POST /auth/login and POST /auth/register
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
