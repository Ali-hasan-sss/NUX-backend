import { Prisma, PrismaClient } from '@prisma/client';

export class AuditService {
  constructor(private readonly db: PrismaClient) {}

  async log(params: {
    userId?: string | null;
    action: string;
    ipAddress?: string | null;
    deviceInfo?: string | null;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    const data: Prisma.AuditLogUncheckedCreateInput = { action: params.action };
    if (params.userId != null && params.userId !== '') data.userId = params.userId;
    if (params.ipAddress != null && params.ipAddress !== '') data.ipAddress = params.ipAddress;
    if (params.deviceInfo != null && params.deviceInfo !== '') data.deviceInfo = params.deviceInfo;
    if (params.metadata !== undefined) data.metadata = params.metadata;
    await this.db.auditLog.create({ data });
  }
}
