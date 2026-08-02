import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ============================================================
  // LISTE DES CLIENTS (depuis Supabase — isolation par user_id)
  // ============================================================
  async findAll(userId?: string) {
    let query = this.supabase.getClient()
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId && userId !== 'guest') {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`❌ Supabase findAll clients error: ${error.message}`);
      throw new BadRequestException('Erreur lors de la récupération des clients.');
    }

    return { success: true, data: data || [] };
  }

  // ============================================================
  // CRÉER UN CLIENT (persisté dans Supabase)
  // ============================================================
  async create(dto: any, userId?: string) {
    if (!dto.name || dto.name.trim() === '') {
      throw new BadRequestException('Le nom du client est obligatoire.');
    }

    const clientData: any = {
      name: dto.name.trim(),
      ninea: dto.ninea || null,
      phone: dto.phone || null,
      email: dto.email || null,
      city: dto.city || null,
    };

    if (userId && userId !== 'guest') {
      clientData.user_id = userId;
    }

    const { data: newClient, error } = await this.supabase.getClient()
      .from('clients')
      .insert(clientData)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Supabase create client error: ${error.message}`);
      throw new BadRequestException(`Erreur lors de la création du client: ${error.message}`);
    }

    this.logger.log(`✅ Client créé dans Supabase: ${newClient.name} (ID: ${newClient.id})`);
    return { success: true, data: newClient };
  }

  // ============================================================
  // RÉCUPÉRER UN CLIENT PAR ID (depuis Supabase)
  // ============================================================
  async findOne(id: string, userId?: string) {
    let query = this.supabase.getClient()
      .from('clients')
      .select('*')
      .eq('id', id);

    if (userId && userId !== 'guest') {
      query = query.eq('user_id', userId);
    }

    const { data: client, error } = await query.single();

    if (error || !client) {
      return { success: false, message: 'Client non trouvé' };
    }

    return { success: true, data: client };
  }

  // ============================================================
  // METTRE À JOUR UN CLIENT (Supabase)
  // ============================================================
  async update(id: string, dto: any, userId?: string) {
    const updateData: any = {};
    if (dto.name) updateData.name = dto.name.trim();
    if (dto.ninea !== undefined) updateData.ninea = dto.ninea;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.city !== undefined) updateData.city = dto.city;

    let query = this.supabase.getClient()
      .from('clients')
      .update(updateData)
      .eq('id', id);

    if (userId && userId !== 'guest') {
      query = query.eq('user_id', userId);
    }

    const { data: updated, error } = await query.select().single();

    if (error || !updated) {
      throw new BadRequestException('Client introuvable ou impossible de mettre à jour.');
    }

    return { success: true, data: updated };
  }

  // ============================================================
  // SUPPRIMER UN CLIENT (Supabase)
  // ============================================================
  async delete(id: string, userId?: string) {
    let query = this.supabase.getClient()
      .from('clients')
      .delete()
      .eq('id', id);

    if (userId && userId !== 'guest') {
      query = query.eq('user_id', userId);
    }

    const { error } = await query;

    if (error) {
      throw new BadRequestException('Client introuvable ou impossible à supprimer.');
    }

    return { success: true, message: 'Client supprimé de la base de données avec succès.' };
  }
}
