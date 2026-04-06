import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AiPrescription, ExtractionStatus } from '../database/entities/ai-prescription.entity';
import { Medicine } from '../database/entities/medicine.entity';
import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';

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
  private anthropic: Anthropic;

  constructor(
    @InjectRepository(AiPrescription)
    private aiRxRepo: Repository<AiPrescription>,
    @InjectRepository(Medicine)
    private medicineRepo: Repository<Medicine>,
    private configService: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get('ANTHROPIC_API_KEY') || process.env.ANTHROPIC_API_KEY,
    });
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
      const extractedData = await this.extractWithClaude(filePath);

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

  private async extractWithClaude(filePath: string): Promise<{
    patient_name: string;
    doctor_name: string;
    medicines: ExtractedMedicine[];
    raw_text: string;
  }> {
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';

    const prompt = `You are a medical prescription parser specializing in Indian handwritten prescriptions.
Analyze this prescription image and extract ALL information accurately.

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{
  "patient_name": "patient name or null",
  "doctor_name": "doctor name or null",
  "raw_text": "all visible text from prescription",
  "medicines": [
    {
      "name": "medicine brand or generic name",
      "strength": "dosage strength e.g. 500mg",
      "dose": "e.g. 1 tablet",
      "frequency": "e.g. TID, BD, OD, SOS",
      "duration": "e.g. 5 days",
      "notes": "any special instructions or null",
      "confidence": "high|medium|low"
    }
  ]
}

Rules:
- Extract every medicine listed, even if partially readable
- For unclear text use confidence "low"
- Indian prescription abbreviations: OD=once daily, BD=twice daily, TID=three times daily, QID=four times daily, SOS=as needed, HS=at bedtime
- Include all medicines even if dosage is unclear`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      // If JSON parse fails, return a structured fallback
      return {
        patient_name: null,
        doctor_name: null,
        medicines: [],
        raw_text: text,
      };
    }
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
      raw_text: 'Mock prescription text (API key not configured)',
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
