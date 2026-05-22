import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Controller('scan-label')
export class ScanLabelController {
  @UseGuards(JwtAuthGuard)
  @Post()
  async scanLabel(@Body() body: { image: string; mode: string }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

    const { image, mode } = body;
    const prompt = mode === 'dispensing'
      ? 'Extract medicine brand name and composition from this label. Return JSON only: {"medicine_name":"<brand>","composition":"<generic>","strength":"<dosage>"}'
      : 'Extract all medicine details from this label. Return JSON only: {"medicine_name":"<brand>","composition":"<generic>","strength":"<dosage>","batch_number":"<batch>","expiry_date":"<MM/YYYY>","mrp":<number>,"manufacturer":"<company>"}. Omit missing fields.';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse label');
    return JSON.parse(match[0]);
  }
}

