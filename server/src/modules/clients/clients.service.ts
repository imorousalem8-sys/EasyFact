import { Injectable } from '@nestjs/common';

@Injectable()
export class ClientsService {
  private clients = []; // Starts clean/empty for new user onboarding

  async findAll() {
    return { success: true, data: this.clients };
  }

  async create(dto: any) {
    const newClient = {
      id: 'cli_' + Date.now(),
      name: dto.name,
      ninea: dto.ninea || '',
      rccm: dto.rccm || '',
      phone: dto.phone || '',
      email: dto.email || '',
      city: dto.city || '',
    };
    this.clients.unshift(newClient);
    return { success: true, data: newClient };
  }

  async findOne(id: string) {
    const client = this.clients.find(c => c.id === id);
    if (!client) return { success: false, message: 'Client non trouvé' };
    return { success: true, data: client };
  }

  async delete(id: string) {
    this.clients = this.clients.filter(c => c.id !== id);
    return { success: true, message: 'Client supprimé' };
  }
}
