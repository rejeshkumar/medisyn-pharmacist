// ============================================================
// apps/api/src/sales/credit-note.controller.ts
// ============================================================
import {
  Controller, Get, Post, Param, Query, Body,
  UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreditNoteService, CreateCreditNoteDto } from './credit-note.service';

@ApiTags('Credit Notes')
@ApiBearerAuth()
@Controller('credit-notes')
export class CreditNoteController {
  constructor(private readonly cn: CreditNoteService) {}

  /**
   * GET /credit-notes/returnable/:saleId
   * Called when pharmacist opens the Return Medicines dialog.
   * Returns which items on the bill can still be returned.
   */
  @Get('returnable/:saleId')
  @ApiOperation({ summary: 'Get returnable items for a bill' })
  getReturnableItems(@Param('saleId') saleId: string, @Request() req) {
    return this.cn.getReturnableItems(saleId, req.user.tenantId);
  }

  /**
   * GET /credit-notes/by-sale/:saleId
   * List all credit notes raised against a particular bill.
   */
  @Get('by-sale/:saleId')
  @ApiOperation({ summary: 'List credit notes for a bill' })
  listBySale(@Param('saleId') saleId: string, @Request() req) {
    return this.cn.listBySale(saleId, req.user.tenantId);
  }

  /**
   * GET /credit-notes?from=&to=
   * List recent credit notes with optional date filter.
   */
  @Get()
  @ApiOperation({ summary: 'List credit notes' })
  list(
    @Query('from') from: string,
    @Query('to') to: string,
    @Request() req,
  ) {
    return this.cn.list(req.user.tenantId, from, to);
  }

  /**
   * GET /credit-notes/:cnNumber
   * Fetch a single credit note for printing.
   */
  @Get(':cnNumber')
  @ApiOperation({ summary: 'Get credit note by number (for print)' })
  getOne(@Param('cnNumber') cnNumber: string, @Request() req) {
    return this.cn.getCreditNote(cnNumber, req.user.tenantId);
  }

  /**
   * POST /credit-notes
   * Create a new credit note. Stock is restored atomically.
   */
  @Post()
  @ApiOperation({ summary: 'Create a credit note (patient return)' })
  create(@Body() dto: CreateCreditNoteDto, @Request() req) {
    return this.cn.createCreditNote(dto, req.user.userId, req.user.tenantId);
  }
}
