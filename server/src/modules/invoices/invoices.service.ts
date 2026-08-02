import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ============================================================
  // LISTE DES FACTURES (depuis Supabase, filtrée)
  // ============================================================
  async findAll(search?: string, status?: string, userId?: string) {
    let query = this.supabase.getClient()
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`client_name.ilike.%${search}%,invoice_number.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`❌ Supabase findAll invoices error: ${error.message}`);
      throw new BadRequestException('Erreur lors de la récupération des factures.');
    }

    return {
      success: true,
      data: data || [],
      totalCount: count || (data ? data.length : 0),
    };
  }

  // ============================================================
  // CRÉER UNE FACTURE (persistée dans Supabase)
  // ============================================================
  async create(dto: any) {
    const totalHt = (dto.items || []).reduce((acc: number, curr: any) => acc + (curr.qty * curr.unitPrice), 0);
    const vatRate = dto.vatRate || 18;
    const withRate = dto.withholdingRate || 0;

    const vatAmount = parseFloat((totalHt * (vatRate / 100)).toFixed(2));
    const withAmount = parseFloat((totalHt * (withRate / 100)).toFixed(2));
    const netTotal = parseFloat((totalHt + vatAmount - withAmount - (dto.advanceAmount || 0)).toFixed(2));

    // Générer un numéro de facture unique
    const year = new Date().getFullYear();
    const { count } = await this.supabase.getClient()
      .from('invoices')
      .select('id', { count: 'exact' })
      .eq('user_id', dto.userId || null);

    const invoiceNumber = dto.invoiceNumber || `FAC-${year}-${String((count || 0) + 1).padStart(4, '0')}`;

    const invoiceData: any = {
      invoice_number: invoiceNumber,
      client_name: dto.clientName || dto.client_name || 'Client',
      type: dto.type || 'Facture',
      status: dto.status || 'En attente',
      amount_ht: totalHt,
      tax_vat: vatAmount,
      tax_withholding: withAmount,
      advance_amount: dto.advanceAmount || 0,
      net_to_pay: netTotal,
      items: dto.items || [],
      due_date: dto.dueDate || null,
      // Note: 'notes' column added in schema v2.0 — only include if provided and column exists
    };

    if (dto.userId) {
      invoiceData.user_id = dto.userId;
    }

    const { data: newInvoice, error } = await this.supabase.getClient()
      .from('invoices')
      .insert(invoiceData)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Supabase create invoice error: ${error.message}`);
      throw new BadRequestException(`Erreur lors de la création de la facture: ${error.message}`);
    }

    // QR Code Wave pour paiement
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://wave.com/pay/easyfact-${invoiceNumber}-${netTotal}`)}`;

    return {
      success: true,
      message: 'Facture créée et enregistrée dans Supabase avec succès.',
      data: {
        ...newInvoice,
        qrCodeUrl,
        // Aliases pour compatibilité frontend
        reference: newInvoice.invoice_number,
        clientName: newInvoice.client_name,
        totalHt: newInvoice.amount_ht,
        vatAmount: newInvoice.tax_vat,
        withholdingAmount: newInvoice.tax_withholding,
        netTotal: newInvoice.net_to_pay,
      },
    };
  }

  // ============================================================
  // RÉCUPÉRER UNE FACTURE PAR ID (depuis Supabase)
  // ============================================================
  async findOne(id: string) {
    const { data: inv, error } = await this.supabase.getClient()
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !inv) {
      throw new BadRequestException('Facture introuvable');
    }

    return {
      success: true,
      data: {
        ...inv,
        reference: inv.invoice_number,
        clientName: inv.client_name,
        totalHt: inv.amount_ht,
        vatAmount: inv.tax_vat,
        withholdingAmount: inv.tax_withholding,
        netTotal: inv.net_to_pay,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://wave.com/pay/easyfact-${inv.invoice_number}-${inv.net_to_pay}`)}`,
      },
    };
  }

  // ============================================================
  // METTRE À JOUR LE STATUT (Supabase)
  // ============================================================
  async updateStatus(id: string, status: string) {
    const { data: updated, error } = await this.supabase.getClient()
      .from('invoices')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) {
      throw new BadRequestException('Facture introuvable ou impossible de mettre à jour.');
    }

    return {
      success: true,
      message: `Statut de la facture mis à jour : ${status}`,
      data: updated,
    };
  }

  // ============================================================
  // SUPPRIMER UNE FACTURE (Supabase)
  // ============================================================
  async delete(id: string) {
    const { error } = await this.supabase.getClient()
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) {
      throw new BadRequestException('Facture introuvable ou impossible à supprimer.');
    }

    return { success: true, message: 'Facture supprimée avec succès de la base de données.' };
  }

  // ============================================================
  // STATISTIQUES DU TABLEAU DE BORD (depuis Supabase)
  // ============================================================
  async getStats(userId?: string) {
    let query = this.supabase.getClient().from('invoices').select('status,net_to_pay');
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: invoices, error } = await query;

    if (error) {
      this.logger.error(`❌ Supabase getStats error: ${error.message}`);
      return { success: true, stats: { totalRevenue: 0, pendingTotal: 0, paidCount: 0, pendingCount: 0, totalInvoices: 0 } };
    }

    const paid = (invoices || []).filter(i => i.status === 'Payée' || i.status === 'Payé');
    const pending = (invoices || []).filter(i => i.status === 'En attente');

    return {
      success: true,
      stats: {
        totalRevenue: paid.reduce((sum, i) => sum + (Number(i.net_to_pay) || 0), 0),
        pendingTotal: pending.reduce((sum, i) => sum + (Number(i.net_to_pay) || 0), 0),
        paidCount: paid.length,
        pendingCount: pending.length,
        totalInvoices: (invoices || []).length,
      },
    };
  }

  // ============================================================
  // LIEN WHATSAPP (avec données Supabase)
  // ============================================================
  async generateWhatsAppLink(id: string, phone: string) {
    const inv = await this.findOne(id);
    const text = encodeURIComponent(
      `Bonjour *${inv.data.clientName}*,\n\nVoici le lien pour régler la facture *#${inv.data.reference}* d'un montant de *${inv.data.netTotal} FCFA* par Mobile Money (Wave / Orange Money) : ${inv.data.qrCodeUrl}`
    );
    return {
      success: true,
      whatsappUrl: `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${text}`,
    };
  }
}
