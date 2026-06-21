import { Injectable, NotImplementedException } from '@nestjs/common';

type OrderLine = { name: string; qty: number };

/**
 * SuperRx integration — STUB.
 *
 * Real implementation pending design work:
 *  - SuperRx API base URL + how this service reaches it (no auth on SuperRx side yet)
 *  - pharmacyId mapping: SuperRx's Pharmacy.id (cuid) is a different ID space
 *    from SimpliRx's tenant_id (uuid) — needs an explicit mapping/onboarding step
 *  - compare() is actually two SuperRx calls: POST /orders/validate (free text →
 *    medicineIds) then POST /orders/compare (medicineIds → dealer pricing)
 *  - createOrder() now supports per-item dealerId (orders can split across dealers)
 *
 * Do not treat this as production-ready. See SuperRx integration PRD for full scope.
 */
@Injectable()
export class SuperRxService {
  async compare(tenantId: string, lines: OrderLine[]) {
    throw new NotImplementedException('SuperRx integration is not yet configured.');
  }

  async createOrder(tenantId: string, dealerId: string, lines: OrderLine[]) {
    throw new NotImplementedException('SuperRx integration is not yet configured.');
  }

  async getOrder(id: string) {
    throw new NotImplementedException('SuperRx integration is not yet configured.');
  }
}
