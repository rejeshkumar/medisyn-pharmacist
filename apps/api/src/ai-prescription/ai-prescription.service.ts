import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AiPrescription, ExtractionStatus } from '../database/entities/ai-prescription.entity';
import { Medicine } from '../database/entities/medicine.entity';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

export interface ExtractedMedicine {
  name: string;
  strength?: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  notes?: string;
  confidence: 'high' | 'medium' | 'low';
  matched_medicine_id?: string;
  matched_medicine_name?: string;
}

@Injectable()
export class AiPrescriptionService {
  private openai: OpenAI;

  constructor(
    @InjectRepository(AiPrescription)
    private aiRxRepo: Repository<AiPrescription>,
    @InjectRepository(Medicine)
    private medicineRepo: Repository<Medicine>,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async uploadAndParse(file: Express.Multer.File, userId: string) {
    const imageUrl = `/uploads/prescriptions/${file.filename}`;

    const prescription = this.aiRxRepo.create({
      uploaded_by: userId,
      image_url: imageUrl,
      status: ExtractionStatus.PROCESSING,
    });
    const saved = await this.aiRxRepo.save(prescription);

    this.processAsync(saved.id, file.path).catch(console.error);

    return { id: saved.id, image_url: imageUrl, status: ExtractionStatus.PROCESSING };
  }

  private async processAsync(prescriptionId: string, filePath: string) {
    const prescription = await this.aiRxRepo.findOne({
      where: { id: prescriptionId },
    });
    if (!prescription) return;

    try {
      let extractedData: any;

      if (this.openai) {
        extractedData = await this.extractWithOpenAI(filePath);
      } else {
        extractedData = this.mockExtraction();
      }

      const mappedMedicines = await this.mapMedicinesToMaster(
        extractedData.medicines,
      );

      prescription.extraction_json = {
        medicines: mappedMedicines,
        patient_name: extractedData.patient_name,
        doctor_name: extractedData.doctor_name,
        raw_text: extractedData.raw_text,
      };
      prescription.patient_name = extractedData.patient_name;
      prescription.doctor_name = extractedData.doctor_name;
      prescription.confidence_summary = this.computeConfidenceSummary(mappedMedicines);
      prescription.status = ExtractionStatus.COMPLETED;
    } catch (error) {
      prescription.status = ExtractionStatus.FAILED;
      prescription.error_message = error.message;
    }

    await this.aiRxRepo.save(prescription);
  }

  private async extractWithOpenAI(filePath: string): Promise<any> {
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.pdf' ? 'image/jpeg' : `image/${ext.replace('.', '')}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a pharmacy assistant. Extract all medicine details from this prescription image.

Return a JSON object with this exact structure:
{
  "patient_name": "string or null",
  "doctor_name": "string or null",
  "medicines": [
    {
      "name": "medicine brand or generic name",
      "strength": "e.g. 500mg, 10mg",
      "dose": "e.g. 1 tablet, 5ml",
      "frequency": "e.g. twice daily, TID, OD",
      "duration": "e.g. 5 days, 1 month",
      "notes": "e.g. after food, before bed",
      "confidence": "high | medium | low"
    }
  ],
  "raw_text": "full text extracted from prescription"
}

Rules for confidence:
- high: name clearly readable and recognizable
- medium: partially readable or common abbreviation
- low: unclear, blurry or unrecognizable

Return only valid JSON. No markdown.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0].message.content);
  }

  private mockExtraction() {
    return {
      patient_name: 'Sample Patient',
      doctor_name: 'Dr. Sample',
      medicines: [
        {
          name: 'Amoxicillin',
          strength: '500mg',
          dose: '1 capsule',
          frequency: 'TID',
          duration: '5 days',
          notes: 'After food',
          confidence: 'high',
        },
        {
          name: 'Paracetamol',
          strength: '500mg',
          dose: '1 tablet',
          frequency: 'SOS',
          duration: '3 days',
          notes: null,
          confidence: 'high',
        },
      ],
      raw_text: 'Mock prescription text (OpenAI API key not configured)',
    };
  }

  private async mapMedicinesToMaster(medicines: ExtractedMedicine[]) {
    const result = [];
    for (const med of medicines) {
      const matches = await this.medicineRepo
        .createQueryBuilder('m')
        .where('m.brand_name ILIKE :name OR m.molecule ILIKE :name', {
          name: `%${med.name}%`,
        })
        .andWhere('m.is_active = true')
        .limit(3)
        .getMany();

      const exactMatch = matches.find(
        (m) =>
          m.brand_name.toLowerCase() === med.name.toLowerCase() ||
          m.molecule.toLowerCase() === med.name.toLowerCase(),
      );

      result.push({
        ...med,
        matched_medicine_id: exactMatch?.id || matches[0]?.id || null,
        matched_medicine_name:
          exactMatch?.brand_name || matches[0]?.brand_name || null,
        possible_matches: matches.slice(0, 3).map((m) => ({
          id: m.id,
          brand_name: m.brand_name,
          molecule: m.molecule,
          strength: m.strength,
        })),
        confidence: exactMatch ? 'high' : matches.length > 0 ? 'medium' : 'low',
      });
    }
    return result;
  }

  private computeConfidenceSummary(medicines: any[]): string {
    const high = medicines.filter((m) => m.confidence === 'high').length;
    const total = medicines.length;
    return `${high}/${total} medicines matched with high confidence`;
  }

  async findOne(id: string) {
    const rx = await this.aiRxRepo.findOne({ where: { id } });
    if (!rx) throw new NotFoundException('Prescription not found');
    return rx;
  }

  async finalize(id: string, approvedMedicines: any[]) {
    const rx = await this.findOne(id);
    if (rx.extraction_json) {
      rx.extraction_json.approved_medicines = approvedMedicines;
      rx.extraction_json.finalized = true;
    }
    return this.aiRxRepo.save(rx);
  }

  async findAll(userId?: string) {
    const where: any = {};
    if (userId) where.uploaded_by = userId;
    return this.aiRxRepo.find({
      where,
      order: { created_at: 'DESC' },
      take: 50,
    });
  }
}
