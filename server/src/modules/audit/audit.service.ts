import { Injectable, Logger } from '@nestjs/common';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  details: any;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private auditLogs: AuditLogEntry[] = [];

  logAction(action: string, userId: string, details: any, ipAddress: string = '127.0.0.1') {
    const entry: AuditLogEntry = {
      id: 'audit_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: userId || 'anonymous',
      action,
      details,
      ipAddress,
    };

    this.auditLogs.unshift(entry);
    this.logger.log(`📊 [AUDIT SYSCOHADA] Action: ${action} | User: ${userId} | IP: ${ipAddress}`);
    return entry;
  }

  getAuditLogs(userId?: string) {
    if (userId) {
      return this.auditLogs.filter(l => l.userId === userId);
    }
    return this.auditLogs;
  }
}
