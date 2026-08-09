import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('stats/dashboard')
  async getStats(@Request() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    return this.invoicesService.getStats(userId);
  }

  @Get()
  async findAll(@Request() req: any, @Query('search') search?: string, @Query('status') status?: string) {
    const userId = req.user?.sub || req.user?.userId;
    return this.invoicesService.findAll(search, status, userId);
  }

  @Post()
  async create(@Request() req: any, @Body() invoiceDto: any) {
    const userId = req.user?.sub || req.user?.userId;
    const userTier = req.user?.tier || invoiceDto.userTier || 'starter';
    return this.invoicesService.create({ ...invoiceDto, userId, userTier });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.invoicesService.updateStatus(id, body.status);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.invoicesService.delete(id);
  }

  @Post(':id/send-whatsapp')
  async sendWhatsApp(@Param('id') id: string, @Body() body: { phone: string }) {
    return this.invoicesService.generateWhatsAppLink(id, body.phone);
  }
}
