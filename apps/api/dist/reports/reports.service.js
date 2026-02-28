"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const sale_entity_1 = require("../database/entities/sale.entity");
const sale_item_entity_1 = require("../database/entities/sale-item.entity");
const stock_batch_entity_1 = require("../database/entities/stock-batch.entity");
const medicine_entity_1 = require("../database/entities/medicine.entity");
const dayjs = require("dayjs");
const ExcelJS = require("exceljs");
let ReportsService = class ReportsService {
    constructor(saleRepo, saleItemRepo, batchRepo, medicineRepo) {
        this.saleRepo = saleRepo;
        this.saleItemRepo = saleItemRepo;
        this.batchRepo = batchRepo;
        this.medicineRepo = medicineRepo;
    }
    async getDashboard() {
        const todayStart = dayjs().startOf('day').toDate();
        const todayEnd = dayjs().endOf('day').toDate();
        const [todaySales, todayBillCount, lowStockCount, nearExpiryCount] = await Promise.all([
            this.saleRepo
                .createQueryBuilder('s')
                .select('COALESCE(SUM(s.total_amount), 0)', 'total')
                .where('s.created_at BETWEEN :start AND :end', {
                start: todayStart,
                end: todayEnd,
            })
                .andWhere('s.is_voided = false')
                .getRawOne(),
            this.saleRepo.count({
                where: { is_voided: false },
            }),
            this.batchRepo
                .createQueryBuilder('b')
                .where('b.quantity <= 10')
                .andWhere('b.quantity > 0')
                .andWhere('b.is_active = true')
                .getCount(),
            this.batchRepo
                .createQueryBuilder('b')
                .where('b.expiry_date <= :d90', {
                d90: dayjs().add(90, 'day').toDate(),
            })
                .andWhere('b.expiry_date > NOW()')
                .andWhere('b.quantity > 0')
                .andWhere('b.is_active = true')
                .getCount(),
        ]);
        const topMedicines = await this.saleItemRepo
            .createQueryBuilder('si')
            .select('si.medicine_id', 'medicine_id')
            .addSelect('si.medicine_name', 'medicine_name')
            .addSelect('SUM(si.qty)', 'total_qty')
            .addSelect('SUM(si.item_total)', 'total_revenue')
            .innerJoin('si.sale', 's', 's.is_voided = false')
            .groupBy('si.medicine_id')
            .addGroupBy('si.medicine_name')
            .orderBy('total_qty', 'DESC')
            .limit(10)
            .getRawMany();
        return {
            today_sales: parseFloat(todaySales?.total || '0'),
            today_bill_count: todayBillCount,
            low_stock_count: lowStockCount,
            near_expiry_count: nearExpiryCount,
            top_medicines: topMedicines,
        };
    }
    async getDailySales(date) {
        const targetDate = date ? dayjs(date) : dayjs();
        const start = targetDate.startOf('day').toDate();
        const end = targetDate.endOf('day').toDate();
        const sales = await this.saleRepo.find({
            where: { is_voided: false },
            relations: ['items', 'pharmacist'],
            order: { created_at: 'DESC' },
        });
        const filtered = sales.filter((s) => s.created_at >= start && s.created_at <= end);
        const total = filtered.reduce((sum, s) => sum + Number(s.total_amount), 0);
        return { date: targetDate.format('YYYY-MM-DD'), total, sales: filtered };
    }
    async getPeriodSales(from, to) {
        return this.saleRepo
            .createQueryBuilder('s')
            .leftJoinAndSelect('s.pharmacist', 'u')
            .where('s.created_at BETWEEN :from AND :to', {
            from: new Date(from),
            to: new Date(to + 'T23:59:59'),
        })
            .andWhere('s.is_voided = false')
            .orderBy('s.created_at', 'DESC')
            .getMany();
    }
    async getTopMedicines(from, to) {
        const qb = this.saleItemRepo
            .createQueryBuilder('si')
            .select('si.medicine_id', 'medicine_id')
            .addSelect('si.medicine_name', 'medicine_name')
            .addSelect('SUM(si.qty)', 'total_qty')
            .addSelect('SUM(si.item_total)', 'total_revenue')
            .innerJoin('si.sale', 's', 's.is_voided = false')
            .groupBy('si.medicine_id')
            .addGroupBy('si.medicine_name')
            .orderBy('total_qty', 'DESC')
            .limit(20);
        if (from && to) {
            qb.where('s.created_at BETWEEN :from AND :to', {
                from: new Date(from),
                to: new Date(to + 'T23:59:59'),
            });
        }
        return qb.getRawMany();
    }
    async getLowStockReport() {
        return this.batchRepo
            .createQueryBuilder('b')
            .leftJoinAndSelect('b.medicine', 'm')
            .leftJoinAndSelect('b.supplier', 's')
            .where('b.quantity <= 10')
            .andWhere('b.quantity >= 0')
            .andWhere('b.is_active = true')
            .orderBy('b.quantity', 'ASC')
            .getMany();
    }
    async getNearExpiryReport(days = 90) {
        const targetDate = dayjs().add(days, 'day').toDate();
        return this.batchRepo
            .createQueryBuilder('b')
            .leftJoinAndSelect('b.medicine', 'm')
            .leftJoinAndSelect('b.supplier', 's')
            .where('b.expiry_date <= :targetDate', { targetDate })
            .andWhere('b.expiry_date > NOW()')
            .andWhere('b.quantity > 0')
            .andWhere('b.is_active = true')
            .orderBy('b.expiry_date', 'ASC')
            .getMany();
    }
    async getStockValuation() {
        const batches = await this.batchRepo
            .createQueryBuilder('b')
            .leftJoinAndSelect('b.medicine', 'm')
            .where('b.is_active = true')
            .andWhere('b.quantity > 0')
            .getMany();
        let totalPurchaseValue = 0;
        let totalMrpValue = 0;
        const items = batches.map((b) => {
            const purchaseValue = b.quantity * Number(b.purchase_price);
            const mrpValue = b.quantity * Number(b.mrp);
            totalPurchaseValue += purchaseValue;
            totalMrpValue += mrpValue;
            return { ...b, purchase_value: purchaseValue, mrp_value: mrpValue };
        });
        return {
            items,
            total_purchase_value: totalPurchaseValue,
            total_mrp_value: totalMrpValue,
            potential_profit: totalMrpValue - totalPurchaseValue,
        };
    }
    async exportSalesToExcel(from, to) {
        const sales = await this.getPeriodSales(from, to);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Sales Report');
        sheet.columns = [
            { header: 'Bill No', key: 'bill_number', width: 20 },
            { header: 'Date', key: 'date', width: 20 },
            { header: 'Customer', key: 'customer_name', width: 25 },
            { header: 'Payment Mode', key: 'payment_mode', width: 15 },
            { header: 'Subtotal', key: 'subtotal', width: 15 },
            { header: 'Discount', key: 'discount_amount', width: 12 },
            { header: 'Tax', key: 'tax_amount', width: 12 },
            { header: 'Total', key: 'total_amount', width: 15 },
            { header: 'Pharmacist', key: 'pharmacist', width: 25 },
        ];
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2D7D46' },
        };
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        for (const sale of sales) {
            sheet.addRow({
                bill_number: sale.bill_number,
                date: new Date(sale.created_at).toLocaleString('en-IN'),
                customer_name: sale.customer_name || '-',
                payment_mode: sale.payment_mode,
                subtotal: Number(sale.subtotal).toFixed(2),
                discount_amount: Number(sale.discount_amount).toFixed(2),
                tax_amount: Number(sale.tax_amount).toFixed(2),
                total_amount: Number(sale.total_amount).toFixed(2),
                pharmacist: sale.pharmacist?.full_name || '-',
            });
        }
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(sale_entity_1.Sale)),
    __param(1, (0, typeorm_1.InjectRepository)(sale_item_entity_1.SaleItem)),
    __param(2, (0, typeorm_1.InjectRepository)(stock_batch_entity_1.StockBatch)),
    __param(3, (0, typeorm_1.InjectRepository)(medicine_entity_1.Medicine)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ReportsService);
//# sourceMappingURL=reports.service.js.map