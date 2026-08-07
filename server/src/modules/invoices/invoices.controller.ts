import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('stats/dashboard')
  async getStats() {
    return this.invoicesService.getStats();
  }

  @Get()
  async findAll(@Query('search') search?: string, @Query('status') status?: string) {
    return this.invoicesService.findAll(search, status);
  }

  @Post()
  async create(@Body() invoiceDto: any) {
    return this.invoicesService.create(invoiceDto);
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
