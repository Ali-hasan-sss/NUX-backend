import {
  PrismaClient,
  Role,
  CompanySubscriptionStatus,
  Prisma,
} from '@prisma/client';
import { walletService } from '../wallet/services/wallet.service';

const prisma = new PrismaClient();

export class CompanyOwnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompanyOwnerError';
  }
}

/** Current calendar month in UTC as `YYYY-MM` (used for allowance runs). */
export function yearMonthUTC(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export class CompanyService {
  constructor(private readonly db: PrismaClient) {}

  async listCompanies(ownerId: string) {
    return this.db.company.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { employees: true } },
      },
    });
  }

  async getCompanyForOwner(ownerId: string, companyId: string) {
    return this.db.company.findFirst({
      where: { id: companyId, ownerId },
      include: {
        employees: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                isActive: true,
                qrCode: true,
              },
            },
          },
        },
        allowanceMonths: { orderBy: { yearMonth: 'desc' }, take: 36 },
      },
    });
  }

  async createCompany(
    ownerId: string,
    data: {
      name: string;
      taxNumber: string;
      commercialRegister: string;
      reportedEmployeeCount?: number;
      monthlyAllowancePerEmployee?: string | number;
      subscriptionPerEmployeeEur?: string | number;
    },
  ) {
    const owner = await this.db.user.findUnique({ where: { id: ownerId } });
    if (!owner || owner.role !== Role.COMPANY_OWNER) {
      throw new CompanyOwnerError('COMPANY_OWNER_REQUIRED');
    }
    const allowance = new Prisma.Decimal(data.monthlyAllowancePerEmployee ?? 0);
    const subEur = new Prisma.Decimal(data.subscriptionPerEmployeeEur ?? 1.75);
    if (subEur.lt(0)) {
      throw new CompanyOwnerError('INVALID_SUBSCRIPTION_RATE');
    }
    return this.db.company.create({
      data: {
        ownerId,
        name: data.name.trim(),
        taxNumber: data.taxNumber.trim(),
        commercialRegister: data.commercialRegister.trim(),
        reportedEmployeeCount: Math.max(0, Math.floor(data.reportedEmployeeCount ?? 0)),
        monthlyAllowancePerEmployee: allowance,
        subscriptionPerEmployeeEur: subEur,
      },
    });
  }

  async updateCompany(
    ownerId: string,
    companyId: string,
    patch: Partial<{
      name: string;
      taxNumber: string;
      commercialRegister: string;
      reportedEmployeeCount: number;
      monthlyAllowancePerEmployee: string | number;
      subscriptionPerEmployeeEur: string | number;
    }>,
  ) {
    const existing = await this.db.company.findFirst({
      where: { id: companyId, ownerId },
    });
    if (!existing) {
      throw new CompanyOwnerError('COMPANY_NOT_FOUND');
    }
    const data: Prisma.CompanyUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name.trim();
    if (patch.taxNumber !== undefined) data.taxNumber = patch.taxNumber.trim();
    if (patch.commercialRegister !== undefined) {
      data.commercialRegister = patch.commercialRegister.trim();
    }
    if (patch.reportedEmployeeCount !== undefined) {
      data.reportedEmployeeCount = Math.max(0, Math.floor(patch.reportedEmployeeCount));
    }
    if (patch.monthlyAllowancePerEmployee !== undefined) {
      data.monthlyAllowancePerEmployee = new Prisma.Decimal(patch.monthlyAllowancePerEmployee);
    }
    if (patch.subscriptionPerEmployeeEur !== undefined) {
      const s = new Prisma.Decimal(patch.subscriptionPerEmployeeEur);
      if (s.lt(0)) throw new CompanyOwnerError('INVALID_SUBSCRIPTION_RATE');
      data.subscriptionPerEmployeeEur = s;
    }
    return this.db.company.update({
      where: { id: companyId },
      data,
    });
  }

  async setSubscriptionStatus(
    ownerId: string,
    companyId: string,
    status: CompanySubscriptionStatus,
  ) {
    const existing = await this.db.company.findFirst({
      where: { id: companyId, ownerId },
    });
    if (!existing) {
      throw new CompanyOwnerError('COMPANY_NOT_FOUND');
    }
    return this.db.company.update({
      where: { id: companyId },
      data: { subscriptionStatus: status },
    });
  }

  async addEmployee(ownerId: string, companyId: string, employeeUserId: string) {
    const company = await this.db.company.findFirst({
      where: { id: companyId, ownerId },
    });
    if (!company) {
      throw new CompanyOwnerError('COMPANY_NOT_FOUND');
    }
    const empUser = await this.db.user.findUnique({
      where: { id: employeeUserId },
      select: { id: true, role: true },
    });
    if (!empUser || empUser.role !== Role.USER) {
      throw new CompanyOwnerError('EMPLOYEE_MUST_BE_APP_USER');
    }
    return this.db.companyEmployee.upsert({
      where: {
        companyId_userId: { companyId, userId: employeeUserId },
      },
      create: { companyId, userId: employeeUserId, isActive: true },
      update: { isActive: true },
    });
  }

  async removeEmployee(ownerId: string, companyId: string, employeeUserId: string) {
    const company = await this.db.company.findFirst({
      where: { id: companyId, ownerId },
    });
    if (!company) {
      throw new CompanyOwnerError('COMPANY_NOT_FOUND');
    }
    await this.db.companyEmployee.deleteMany({
      where: { companyId, userId: employeeUserId },
    });
  }

  /**
   * Credits employee wallets for one company and calendar month (UTC `YYYY-MM`).
   * Subscription fee snapshot uses **active linked employees** × `subscriptionPerEmployeeEur`.
   * Idempotent: safe to retry; wallet lines use ledger idempotency keys.
   */
  async processCompanyAllowanceMonth(
    companyId: string,
    yearMonth: string,
  ): Promise<{
    companyId: string;
    yearMonth: string;
    employeeCount: number;
    totalAllowanceCredited: string;
    subscriptionFeeEur: string;
    alreadyCompleted: boolean;
  } | null> {
    const company = await this.db.company.findUnique({
      where: { id: companyId },
      include: {
        employees: {
          where: { isActive: true },
          include: {
            user: { select: { id: true, role: true, isActive: true } },
          },
        },
      },
    });
    if (!company || company.subscriptionStatus !== CompanySubscriptionStatus.ACTIVE) {
      return null;
    }

    const existingDone = await this.db.companyAllowanceMonth.findUnique({
      where: {
        companyId_yearMonth: { companyId, yearMonth },
      },
    });
    if (existingDone?.creditedAt) {
      return {
        companyId,
        yearMonth,
        employeeCount: existingDone.employeeCount,
        totalAllowanceCredited: existingDone.totalAllowanceCredited.toString(),
        subscriptionFeeEur: existingDone.subscriptionFeeEur.toString(),
        alreadyCompleted: true,
      };
    }

    const eligible = company.employees.filter(
      (e) => e.user.role === Role.USER && e.user.isActive,
    );
    const employeeCount = eligible.length;
    const allowancePer = company.monthlyAllowancePerEmployee;
    const subscriptionFeeEur = company.subscriptionPerEmployeeEur.mul(employeeCount);
    const totalAllowance = allowancePer.mul(employeeCount);

    if (!existingDone) {
      try {
        await this.db.companyAllowanceMonth.create({
          data: {
            companyId,
            yearMonth,
            employeeCount,
            allowancePerEmployee: allowancePer,
            totalAllowanceCredited: new Prisma.Decimal(0),
            subscriptionFeeEur,
          },
        });
      } catch (e: unknown) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const again = await this.db.companyAllowanceMonth.findUnique({
            where: { companyId_yearMonth: { companyId, yearMonth } },
          });
          if (again?.creditedAt) {
            return {
              companyId,
              yearMonth,
              employeeCount: again.employeeCount,
              totalAllowanceCredited: again.totalAllowanceCredited.toString(),
              subscriptionFeeEur: again.subscriptionFeeEur.toString(),
              alreadyCompleted: true,
            };
          }
        } else {
          throw e;
        }
      }
    }

    const currency = 'EUR';
    for (const row of eligible) {
      try {
        await walletService.creditUserWalletCompanyAllowance({
          userId: row.userId,
          companyId,
          yearMonth,
          amount: allowancePer,
          currency,
        });
      } catch (err) {
        console.error(
          `Company allowance credit failed company=${companyId} user=${row.userId} ym=${yearMonth}:`,
          err,
        );
      }
    }

    await this.db.companyAllowanceMonth.update({
      where: { companyId_yearMonth: { companyId, yearMonth } },
      data: {
        employeeCount,
        allowancePerEmployee: allowancePer,
        totalAllowanceCredited: totalAllowance,
        subscriptionFeeEur,
        creditedAt: new Date(),
      },
    });

    return {
      companyId,
      yearMonth,
      employeeCount,
      totalAllowanceCredited: totalAllowance.toString(),
      subscriptionFeeEur: subscriptionFeeEur.toString(),
      alreadyCompleted: false,
    };
  }

  async runMonthlyAllowancesForAllCompanies(yearMonth: string): Promise<number> {
    const companies = await this.db.company.findMany({
      where: { subscriptionStatus: CompanySubscriptionStatus.ACTIVE },
      select: { id: true },
    });
    let n = 0;
    for (const c of companies) {
      const r = await this.processCompanyAllowanceMonth(c.id, yearMonth);
      if (r && !r.alreadyCompleted) n += 1;
    }
    return n;
  }
}

export const companyService = new CompanyService(prisma);
