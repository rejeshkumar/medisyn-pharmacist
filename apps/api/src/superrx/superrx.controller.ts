import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { SuperRxService } from './superrx.service';

type OrderLine = { name: string; qty: number };

/**
 * Endpoints SimpliRx's browser calls.
 *
 * Your app applies JwtAuthGuard + TenantGuard GLOBALLY, so these routes are
 * already behind the pharmacist login. We read the pharmacist's tenant_id off
 * the request (set by your guards) and pass it down so the order is placed as
 * the right SuperRx pharmacy.
 *
 * No global path prefix, so the full paths are:
 *   POST /procurement/superrx/compare
 *   POST /procurement/superrx/order
 *   GET  /procurement/superrx/order/:id
 */
@Controller('procurement/superrx')
export class SuperRxController {
  constructor(private readonly superrx: SuperRxService) {}

  @Post('compare')
  async compare(@Req() req: any, @Body() body: { lines: OrderLine[] }) {
    const tenantId = tenantOf(req);
    const lines = cleanLines(body?.lines);
    if (lines.length === 0) {
      throw new BadRequestException('Add at least one medicine to compare.');
    }
    return this.superrx.compare(tenantId, lines);
  }

  @Post('order')
  async order(
    @Req() req: any,
    @Body() body: { dealerId: string; lines: OrderLine[] },
  ) {
    const tenantId = tenantOf(req);
    if (!body?.dealerId) {
      throw new BadRequestException('Choose a dealer before placing the order.');
    }
    const lines = cleanLines(body?.lines);
    if (lines.length === 0) {
      throw new BadRequestException('Add at least one medicine to order.');
    }
    return this.superrx.createOrder(tenantId, body.dealerId, lines);
  }

  @Get('order/:id')
  async status(@Param('id') id: string) {
    return this.superrx.getOrder(id);
  }
}

/** Read the tenant id your guards attach (handles either field name). */
function tenantOf(req: any): string | undefined {
  return req?.user?.tenant_id ?? req?.user?.tenantId;
}

/** Drop blank lines and bad quantities so we never send junk to SuperRx. */
function cleanLines(lines?: OrderLine[]): OrderLine[] {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((l) => ({ name: (l?.name ?? '').trim(), qty: Number(l?.qty) }))
    .filter((l) => l.name.length > 0 && Number.isFinite(l.qty) && l.qty > 0);
}
