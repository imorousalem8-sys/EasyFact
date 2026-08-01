import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class InvoicesService {
  private invoices = []; // Store starts empty as requested by user (application vierge)

  async findAll(search?: string, status?: string) {
    let result = [...this.invoices];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i => i.clientName.toLowerCase().includes(q) || i.reference.toLowerCase().includes(q));
    }
    if (status && status !== 'all') {
      result = result.filter(i => i.status === status);
    }
    return {
      success: true,
      data: result,
      totalCount: result.length,
    };
  }

  async create(dto: any) {
    const totalHt = (dto.items || []).reduce((acc, curr) => acc + (curr.qty * curr.unitPrice), 0);
    const vatRate = dto.vatRate || 18;
    const withRate = dto.withholdingRate || 0;

    const vatAmount = totalHt * (vatRate / 100);
    const withAmount = totalHt * (withRate / 100);
    const netTotal = totalHt + vatAmount - withAmount;

    const newInvoice = {
      id: 'inv_' + Date.now(),
      reference: dto.reference || `FAC-${new Date().getFullYear()}-${String(this.invoices.length + 1).padStart(3, '0')}`,
      clientName: dto.clientName || 'Client',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: dto.dueDate || '2026-08-15',
      items: dto.items || [],
      totalHt,
      vatAmount,
      withholdingAmount: withAmount,
      netTotal,
      currency: dto.currency || 'XOF',
      paymentMethod: dto.paymentMethod || 'wave',
      status: 'En attente',
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://wave.com/pay/easyfact-${netTotal}`,
    };

    this.invoices.unshift(newInvoice);
    return {
      success: true,
      message: 'Facture créée et enregistrée avec succès.',
      data: newInvoice,
    };
  }

  async findOne(id: string) {
    const inv = this.invoices.find(i => i.id === id || i.reference === id);
    if (!inv) {
      throw new BadRequestException('Facture introuvable');
    }
    return { success: true, data: inv };
  }

  async updateStatus(id: string, status: string) {
    const invIndex = this.invoices.findIndex(i => i.id === id || i.reference === id);
    if (invIndex === -1) {
      throw new BadRequestException('Facture introuvable');
    }
    this.invoices[invIndex].status = status;
    return {
      success: true,
      message: `Statut de la facture mis à jour : ${status}`,
      data: this.invoices[invIndex],
    };
  }

  async delete(id: string) {
    const initialLength = this.invoices.length;
    this.invoices = this.invoices.filter(i => i.id !== id && i.reference !== id);
    if (this.invoices.length === initialLength) {
      throw new BadRequestException('Facture introuvable');
    }
    return { success: true, message: 'Facture supprimée avec succès' };
  }

  async getStats() {
    const totalRevenue = this.invoices
      .filter(i => i.status === 'Payée')
      .reduce((sum, i) => sum + (i.netTotal || 0), 0);
    const pendingTotal = this.invoices
      .filter(i => i.status === 'En attente')
      .reduce((sum, i) => sum + (i.netTotal || 0), 0);
    const paidCount = this.invoices.filter(i => i.status === 'Payée').length;
    const pendingCount = this.invoices.filter(i => i.status === 'En attente').length;

    return {
      success: true,
      stats: {
        totalRevenue,
        pendingTotal,
        paidCount,
        pendingCount,
        totalInvoices: this.invoices.length,
      },
    };
  }

  async generateWhatsAppLink(id: string, phone: string) {
    const inv = await this.findOne(id);
    const text = encodeURIComponent(`Bonjour *${inv.data.clientName}*,\n\nVoici le lien pour régler la facture *#${inv.data.reference}* d'un montant de *${inv.data.netTotal} FCFA* par Mobile Money (Wave / Orange Money) : https://wave.com/pay/easyfact-${inv.data.netTotal}`);
    return {
      success: true,
      whatsappUrl: `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${text}`,
    };
  }
}
