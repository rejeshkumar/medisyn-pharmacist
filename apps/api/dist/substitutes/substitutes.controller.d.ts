import { SubstitutesService } from './substitutes.service';
export declare class SubstitutesController {
    private substitutesService;
    constructor(substitutesService: SubstitutesService);
    getSubstitutes(medicineId: string): Promise<any[]>;
}
