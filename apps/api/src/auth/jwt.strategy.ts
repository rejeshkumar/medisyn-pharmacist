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
    // Load full user from DB on every request to get latest status + tenant_id
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

    // This object becomes request.user — available in all guards and controllers
    return {
      id:          user.id,
      full_name:   user.full_name,
      role:        user.role,
      tenant_id:   user.tenant_id,
      tenant_mode: user.tenant?.mode ?? 'full',
    };
  }
}
