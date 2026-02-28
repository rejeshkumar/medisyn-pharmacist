import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserStatus } from '../database/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(mobile: string, password: string) {
    const user = await this.usersRepo.findOne({ where: { mobile } });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.status === UserStatus.INACTIVE)
      throw new UnauthorizedException('Account is deactivated. Contact admin.');

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, role: user.role, name: user.full_name };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: user.id,
        full_name: user.full_name,
        mobile: user.mobile,
        role: user.role,
      },
    };
  }

  async validateUser(userId: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user || user.status === UserStatus.INACTIVE) return null;
    return user;
  }

  async seedOwner() {
    const existing = await this.usersRepo.findOne({
      where: { mobile: '9999999999' },
    });
    if (!existing) {
      const hash = await bcrypt.hash('admin123', 10);
      const owner = this.usersRepo.create({
        full_name: 'Admin Owner',
        mobile: '9999999999',
        password_hash: hash,
        role: 'owner' as any,
      });
      await this.usersRepo.save(owner);
      console.log('✅ Default owner seeded: mobile=9999999999, password=admin123');
    }
  }
}
