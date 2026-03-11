import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private client: Anthropic;
  private readonly hasKey: boolean;

  constructor() {
    // Strip any accidental whitespace/newlines from the key
    const rawKey = (process.env.ANTHROPIC_API_KEY || '').trim().replace(/\s+/g, '');
    // A valid Anthropic key starts with sk-ant-
    const validKey = rawKey.startsWith('sk-ant-') ? rawKey : '';
    this.hasKey = !!validKey;
    if (!validKey && rawKey) {
      this.logger.error(`ANTHROPIC_API_KEY is set but malformed (value: "${rawKey.slice(0, 30)}..."). It must start with sk-ant-`);
    } else if (!validKey) {
      this.logger.warn('ANTHROPIC_API_KEY is not set — all AI features will fail');
    }
    this.client = new Anthropic({
      apiKey: validKey || 'missing',
    });
  }

  // ── Health check: verifies the key is set and valid ───────────────
  async healthCheck(): Promise<{ ok: boolean; reason?: string }> {
    if (!this.hasKey) {
      const raw = (process.env.ANTHROPIC_API_KEY || '').trim();
      if (raw && !raw.startsWith('sk-ant-')) {
        return { ok: false, reason: `ANTHROPIC_API_KEY is malformed — it must start with "sk-ant-" but got "${raw.slice(0, 20)}...". Fix the Railway variable.` };
      }
      return { ok: false, reason: 'ANTHROPIC_API_KEY is not set in Railway environment variables' };
    }
    try {
      await this.client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'reply ok' }],
      });
      return { ok: true };
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes('401') || msg.includes('authentication') || msg.includes('invalid x-api-key')) {
        return { ok: false, reason: 'ANTHROPIC_API_KEY is set but invalid or expired' };
      }
      return { ok: false, reason: `API call failed: ${msg}` };
    }
  }

  // ── 3.1 OCR: Extract medicines from prescription image ─────────────
  async extractPrescription(base64Image: string, mediaType: string): Promise<{
    medicines: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      notes?: string;
    }>;
    doctor_notes?: string;
    confidence: 'high' | 'medium' | 'low';
    raw_text?: string;
  }> {
    const response = await this.client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType as any, data: base64Image },
          },
          {
            type: 'text',
            text: `This is a handwritten medical prescription. Extract all medicines and return ONLY valid JSON in this exact format:
{
  "medicines": [
    {
      "name": "medicine name",
      "dosage": "e.g. 500mg",
      "frequency": "e.g. twice daily",
      "duration": "e.g. 5 days",
      "notes": "optional instructions like after food"
    }
  ],
  "doctor_notes": "any other instructions or diagnoses written",
  "confidence": "high|medium|low",
  "raw_text": "full transcription of all text in the image"
}
If a field is unclear, make your best guess and lower the confidence. Return only JSON, no other text.`,
          },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch {
      this.logger.error('OCR parse failed', text);
      return { medicines: [], confidence: 'low', raw_text: text };
    }
  }

  // ── 3.2 Drug interaction checker ──────────────────────────────────
  async checkDrugInteractions(medicines: string[]): Promise<{
    interactions: Array<{
      drugs: string[];
      severity: 'mild' | 'moderate' | 'severe';
      description: string;
      recommendation: string;
    }>;
    safe: boolean;
    summary: string;
  }> {
    if (medicines.length < 2) {
      return { interactions: [], safe: true, summary: 'Single medicine — no interactions to check.' };
    }

    const response = await this.client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Check drug interactions for this combination: ${medicines.join(', ')}

Return ONLY valid JSON in this exact format:
{
  "interactions": [
    {
      "drugs": ["drug1", "drug2"],
      "severity": "mild|moderate|severe",
      "description": "what happens when combined",
      "recommendation": "what to do about it"
    }
  ],
  "safe": true,
  "summary": "one sentence overall safety summary"
}

If no interactions exist, return empty interactions array and safe: true.
Return only JSON, no other text.`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch {
      this.logger.error('Drug interaction parse failed', text);
      return { interactions: [], safe: true, summary: 'Could not check interactions.' };
    }
  }

  // ── 3.3 Transcribe voice to structured consultation notes ──────────
  async transcribeConsultationNotes(transcribedText: string, patientContext?: {
    age?: number;
    gender?: string;
    chief_complaint?: string;
    vitals?: any;
  }): Promise<{
    chief_complaint?: string;
    history_of_present_illness?: string;
    examination_findings?: string;
    diagnosis?: string;
    advice?: string;
    follow_up?: string;
    raw_transcription: string;
  }> {
    const contextStr = patientContext ? `
Patient context:
- Age: ${patientContext.age || 'unknown'}
- Gender: ${patientContext.gender || 'unknown'}
- Chief complaint: ${patientContext.chief_complaint || 'unknown'}
- Vitals: ${patientContext.vitals ? JSON.stringify(patientContext.vitals) : 'not available'}
` : '';

    const response = await this.client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `A doctor dictated the following consultation notes (voice transcription):

"${transcribedText}"
${contextStr}
Structure this into a proper medical note. Return ONLY valid JSON:
{
  "chief_complaint": "main complaint in one line",
  "history_of_present_illness": "structured HPI",
  "examination_findings": "clinical findings mentioned",
  "diagnosis": "diagnosis or differential if mentioned",
  "advice": "treatment or management plan",
  "follow_up": "follow up instructions if any",
  "raw_transcription": "${transcribedText.replace(/"/g, "'")}"
}
Only include fields that were actually mentioned. Return only JSON, no other text.`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch {
      return { raw_transcription: transcribedText };
    }
  }

  // ── 3.4 AI diagnosis suggestions ──────────────────────────────────
  async suggestDiagnosis(input: {
    symptoms: string;
    age?: number;
    gender?: string;
    vitals?: {
      bp?: string;
      pulse?: number;
      temperature?: number;
      spo2?: number;
      blood_sugar?: number;
    };
    duration?: string;
    existing_conditions?: string;
    current_medicines?: string;
  }): Promise<{
    probable_diagnoses: Array<{
      diagnosis: string;
      likelihood: 'high' | 'medium' | 'low';
      reasoning: string;
    }>;
    red_flags: string[];
    suggested_investigations: string[];
    immediate_actions?: string;
    disclaimer: string;
  }> {
    const response = await this.client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `You are a clinical decision support tool. Based on these patient details, suggest probable diagnoses.

Patient:
- Age: ${input.age || 'unknown'}, Gender: ${input.gender || 'unknown'}
- Symptoms: ${input.symptoms}
- Duration: ${input.duration || 'not specified'}
- Vitals: ${input.vitals ? `BP ${input.vitals.bp || 'N/A'}, Pulse ${input.vitals.pulse || 'N/A'}, Temp ${input.vitals.temperature || 'N/A'}°F, SpO2 ${input.vitals.spo2 || 'N/A'}%, Blood Sugar ${input.vitals.blood_sugar || 'N/A'} mg/dL` : 'not available'}
- Known conditions: ${input.existing_conditions || 'none'}
- Current medicines: ${input.current_medicines || 'none'}

Return ONLY valid JSON:
{
  "probable_diagnoses": [
    {
      "diagnosis": "diagnosis name",
      "likelihood": "high|medium|low",
      "reasoning": "brief clinical reasoning"
    }
  ],
  "red_flags": ["list of red flags to rule out"],
  "suggested_investigations": ["list of tests to consider"],
  "immediate_actions": "if urgent action needed",
  "disclaimer": "This is AI-generated clinical decision support. Final diagnosis must be made by the treating physician."
}
Return only JSON, no other text.`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch {
      this.logger.error('Diagnosis suggestion parse failed', text);
      return {
        probable_diagnoses: [],
        red_flags: [],
        suggested_investigations: [],
        disclaimer: 'AI analysis unavailable. Please assess clinically.',
      };
    }
  }
}
