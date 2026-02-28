import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserStatus } from '../database/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async findAll() {
    return this.usersRepo.find({ order: { created_at: 'DESC' } });
  }

  async findOne(id: string) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.usersRepo.findOne({
      where: { mobile: dto.mobile },
    });
    if (existing) throw new ConflictException('Mobile number already registered');

    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      full_name: dto.full_name,
      mobile: dto.mobile,
      password_hash: hash,
      role: dto.role,
    });
    return this.usersRepo.save(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id);
    if (dto.password) {
      dto['password_hash'] = await bcrypt.hash(dto.password, 10);
      delete dto.password;
    }
    Object.assign(user, dto);
    return this.usersRepo.save(user);
  }

  async deactivate(id: string) {
    const user = await this.findOne(id);
    user.status = UserStatus.INACTIVE;
    return this.usersRepo.save(user);
  }

  async activate(id: string) {
    const user = await this.findOne(id);
    user.status = UserStatus.ACTIVE;
    return this.usersRepo.save(user);
  }
}
