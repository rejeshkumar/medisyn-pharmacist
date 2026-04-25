import { Controller, Post, Headers, ForbiddenException } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { importMedicineReference } from './import-medicines-route';

@Controller('admin')
export class ImportMedicinesController {
  @Public()
  @Post('import-medicines')
  async run(@Headers('x-admin-key') key: string) {
    if (key !== 'medisyn-import-2024') throw new ForbiddenException();
    const dbUrl = process.env.DATABASE_URL!;
    const result = await importMedicineReference(dbUrl);
    return { result };
  }
}
