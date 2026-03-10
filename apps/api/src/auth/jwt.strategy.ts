import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../database/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET', 'medisyn-secret-key'),
    });
  }

  async validate(payload: any) {
    const user = await this.usersRepo.findOne({
      where: { id: payload.sub },
      relations: ['tenant'],
    });

    if (!user || user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException();
    }

    if (!user.tenant_id) {
      throw new UnauthorizedException('User has no tenant assigned');
    }

    // Support both single role (legacy) and roles array (new)
    const roles: string[] = (user as any).roles?.length
      ? (user as any).roles
      : [user.role];

    return {
      id:          user.id,
      sub:         user.id,
      full_name:   user.full_name,
      role:        user.role,       // keep for backward compat
      roles:       roles,           // new multi-role array
      tenant_id:   user.tenant_id,
      tenant_mode: user.tenant?.mode ?? 'full',
    };
  }
}
