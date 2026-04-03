// Add these routes to apps/api/src/compliance/compliance.controller.ts
// or create a new file apps/api/src/compliance/form17.controller.ts

import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Form17Service } from './form17.service';

@Controller('compliance')
@UseGuards(JwtAuthGuard, TenantGuard)
export class Form17Controller {
  constructor(private readonly form17: Form17Service) {}

  // GET /compliance/form17?from=2026-01-01&to=2026-03-31
  // Returns list of Schedule X entries (JSON)
  @Get('form17')
  async getForm17Entries(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any,
  ) {
    const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const toDate   = to   || new Date().toISOString().split('T')[0];
    return this.form17.getScheduleXEntries(req.user.tenant_id, fromDate, toDate);
  }

  // GET /compliance/form17/pdf?from=2026-01-01&to=2026-03-31
  // Returns PDF download
  @Get('form17/pdf')
  async downloadForm17Pdf(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const toDate   = to   || new Date().toISOString().split('T')[0];

    const pdfBuffer = await this.form17.generateForm17Pdf(
      req.user.tenant_id,
      fromDate,
      toDate,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Form17_${fromDate}_to_${toDate}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }
}
