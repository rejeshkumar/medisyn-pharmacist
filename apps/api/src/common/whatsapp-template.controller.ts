import { Controller, Get, Patch, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WhatsAppTemplateService, WaEvent } from '../common/whatsapp-template.service';

@Controller('whatsapp-templates')
@UseGuards(JwtAuthGuard)
export class WhatsAppTemplateController {
  constructor(private readonly svc: WhatsAppTemplateService) {}

  @Get()
  list(@Req() req: any) {
    return this.svc.listTemplates(req.user.tenant_id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.svc.updateTemplate(req.user.tenant_id, id, body);
  }

  @Post(':id/reset')
  reset(@Param('id') id: string, @Body() body: { event_type: string; send_to: string }, @Req() req: any) {
    return this.svc.resetTemplate(req.user.tenant_id, body.event_type, body.send_to);
  }

  @Get('preview')
  async preview(
    @Query('event_type') eventType: WaEvent,
    @Query('send_to') sendTo: 'patient' | 'owner',
    @Req() req: any,
  ) {
    const message = await this.svc.previewTemplate(req.user.tenant_id, eventType, sendTo);
    return { message };
  }

  @Post('seed')
  seed(@Req() req: any) {
    return this.svc.seedDefaultTemplates(req.user.tenant_id).then(() => ({ ok: true }));
  }

  @Post('test-send')
  async testSend(
    @Body() body: { mobile: string; event_type: WaEvent; send_to: 'patient' | 'owner' },
    @Req() req: any,
  ) {
    const message = await this.svc.previewTemplate(req.user.tenant_id, body.event_type, body.send_to);
    if (!message) return { ok: false, error: 'Template not found' };
    const sent = await this.svc.send(body.mobile, message);
    return { ok: sent, message };
  }
}
