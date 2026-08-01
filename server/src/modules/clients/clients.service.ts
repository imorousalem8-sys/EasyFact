import { Injectable } from '@nestjs/common';

@Injectable()
export class ClientsService {
  // Map of userId -> Client[] for 100% strict per-user tenant isolation
  private userClients = new Map<string, any[]>();

  async findAll(userId: string = 'guest') {
    const clients = this.userClients.get(userId) || [];
    return { success: true, data: clients };
  }

  async create(dto: any, userId: string = 'guest') {
    const newClient = {
      id: 'cli_' + Date.now(),
      userId,
      name: dto.name,
      ninea: dto.ninea || '',
      rccm: dto.rccm || '',
      phone: dto.phone || '',
      email: dto.email || '',
      city: dto.city || '',
    };

    const clients = this.userClients.get(userId) || [];
    clients.unshift(newClient);
    this.userClients.set(userId, clients);

    return { success: true, data: newClient };
  }

  async findOne(id: string, userId: string = 'guest') {
    const clients = this.userClients.get(userId) || [];
    const client = clients.find(c => c.id === id);
    if (!client) return { success: false, message: 'Client non trouvé' };
    return { success: true, data: client };
  }

  async delete(id: string, userId: string = 'guest') {
    const clients = this.userClients.get(userId) || [];
    const updated = clients.filter(c => c.id !== id);
    this.userClients.set(userId, updated);
    return { success: true, message: 'Client supprimé' };
  }
}
