import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

type OrderLine = { name: string; qty: number };

@Injectable()
export class SuperRxService {
  private readonly logger = new Logger(SuperRxService.name);
  private readonly http: AxiosInstance;
  private readonly pharmacyMap: Record<string, string>;

  constructor(private config: ConfigService) {
    const baseURL = config.get<string>('SUPERRX_API_URL', 'https://superrx-backend-production.up.railway.app');
    const apiKey  = config.get<string>('SUPERRX_API_KEY', '');

    this.http = axios.create({
      baseURL,
      headers: { 'x-api-key': apiKey },
      timeout: 10_000,
    });

    // JSON map of SimpliRx tenantId → SuperRx pharmacyId
    // e.g. {"00000000-0000-0000-0000-000000000001":"cmpy94aup007ez6hytr6li0sy"}
    const raw = config.get<string>('SUPERRX_PHARMACY_MAP', '{}');
    try {
      this.pharmacyMap = JSON.parse(raw);
    } catch {
      this.logger.error('SUPERRX_PHARMACY_MAP is not valid JSON — using empty map');
      this.pharmacyMap = {};
    }
  }

  /** Resolve SimpliRx tenantId → SuperRx pharmacyId */
  private resolvePharmacyId(tenantId: string): string {
    const id = this.pharmacyMap[tenantId];
    if (!id) {
      throw new NotFoundException(
        `No SuperRx pharmacy mapped for tenant ${tenantId}. ` +
        `Add it to SUPERRX_PHARMACY_MAP.`,
      );
    }
    return id;
  }

  /** POST /integration/compare — returns dealer prices for a list of medicines */
  async compare(tenantId: string, lines: OrderLine[]) {
    const pharmacyId = this.resolvePharmacyId(tenantId);
    try {
      const { data } = await this.http.post('/integration/compare', {
        pharmacyId,
        lines,
      });
      return data;
    } catch (err: any) {
      this.logger.error('SuperRx compare failed', err?.response?.data ?? err.message);
      throw new InternalServerErrorException('Could not fetch dealer prices. Try again.');
    }
  }

  /** POST /integration/orders — place an order on SuperRx */
  async createOrder(tenantId: string, dealerId: string, lines: OrderLine[]) {
    const pharmacyId = this.resolvePharmacyId(tenantId);
    try {
      const { data } = await this.http.post('/integration/orders', {
        pharmacyId,
        dealerId,
        lines,
      });
      return data;
    } catch (err: any) {
      this.logger.error('SuperRx createOrder failed', err?.response?.data ?? err.message);
      throw new InternalServerErrorException('Could not place order. Try again.');
    }
  }

  /** GET /integration/orders/:id — fetch order status */
  async getOrder(id: string) {
    try {
      const { data } = await this.http.get(`/integration/orders/${id}`);
      return data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        throw new NotFoundException(`Order ${id} not found.`);
      }
      this.logger.error('SuperRx getOrder failed', err?.response?.data ?? err.message);
      throw new InternalServerErrorException('Could not fetch order status.');
    }
  }
}
