import { Request, Response } from 'express';
import { PrismaClient, CompanySubscriptionStatus, Prisma } from '@prisma/client';
import { errorResponse, successResponse } from '../../utils/response';
import { companyService, CompanyOwnerError, yearMonthUTC } from '../../services/company.service';
import { formatWalletAmountForApi } from '../../wallet/utils/formatAmount';

const prisma = new PrismaClient();

function parseExportDateRange(q: Request['query']): {
  start?: Date;
  end?: Date;
  error?: string;
} {
  const startRaw = typeof q.startDate === 'string' ? q.startDate : undefined;
  const endRaw = typeof q.endDate === 'string' ? q.endDate : undefined;
  let start: Date | undefined;
  let end: Date | undefined;
  if (startRaw) {
    start = new Date(startRaw);
    if (Number.isNaN(start.getTime())) return { error: 'Invalid startDate' };
  }
  if (endRaw) {
    end = new Date(endRaw);
    if (Number.isNaN(end.getTime())) return { error: 'Invalid endDate' };
    if (!endRaw.includes('T') && endRaw.length <= 10) {
      end.setUTCHours(23, 59, 59, 999);
    }
  }
  const out: { start?: Date; end?: Date } = {};
  if (start !== undefined) out.start = start;
  if (end !== undefined) out.end = end;
  return out;
}

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function ownerId(req: Request): string {
  return (req as Request & { user: { id: string } }).user.id;
}

/**
 * @swagger
 * tags:
 *   - name: Company
 *     description: B2B company meal allowance (owner role COMPANY_OWNER)
 */

/**
 * @swagger
 * /client/company:
 *   get:
 *     summary: List companies owned by the authenticated company owner
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Companies retrieved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not COMPANY_OWNER)
 */
export const listMyCompanies = async (req: Request, res: Response) => {
  try {
    const rows = await companyService.listCompanies(ownerId(req));
    return successResponse(res, 'Companies retrieved successfully', { companies: rows }, 200);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/company:
 *   post:
 *     summary: Create a company under the current owner
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, taxNumber, commercialRegister]
 *             properties:
 *               name:
 *                 type: string
 *               taxNumber:
 *                 type: string
 *               commercialRegister:
 *                 type: string
 *               reportedEmployeeCount:
 *                 type: integer
 *               monthlyAllowancePerEmployee:
 *                 type: string
 *                 description: Decimal amount per employee per month (wallet currency EUR)
 *               subscriptionPerEmployeeEur:
 *                 type: string
 *                 default: "1.75"
 *     responses:
 *       201:
 *         description: Company created
 *       400:
 *         description: Validation / business rule error
 */
export const createCompany = async (req: Request, res: Response) => {
  try {
    const c = await companyService.createCompany(ownerId(req), req.body);
    return successResponse(res, 'Company created successfully', { company: c }, 201);
  } catch (e) {
    if (e instanceof CompanyOwnerError) {
      return errorResponse(res, e.message, 400);
    }
    console.error(e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/company/{companyId}:
 *   get:
 *     summary: Get one company with employees and recent allowance months
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Company retrieved
 *       404:
 *         description: Not found
 */
export const getCompany = async (req: Request, res: Response) => {
  try {
    const companyId = String(req.params.companyId ?? '');
    const c = await companyService.getCompanyForOwner(ownerId(req), companyId);
    if (!c) return errorResponse(res, 'Company not found', 404);
    return successResponse(res, 'Company retrieved successfully', { company: c }, 200);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/company/{companyId}:
 *   put:
 *     summary: Update company profile fields
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               taxNumber: { type: string }
 *               commercialRegister: { type: string }
 *               reportedEmployeeCount: { type: integer }
 *               monthlyAllowancePerEmployee: { type: string }
 *               subscriptionPerEmployeeEur: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 *       404:
 *         description: Not found
 */
export const updateCompany = async (req: Request, res: Response) => {
  try {
    const companyId = String(req.params.companyId ?? '');
    const c = await companyService.updateCompany(ownerId(req), companyId, req.body);
    return successResponse(res, 'Company updated successfully', { company: c }, 200);
  } catch (e) {
    if (e instanceof CompanyOwnerError) {
      return errorResponse(res, e.message, 404);
    }
    console.error(e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/company/{companyId}/subscription:
 *   patch:
 *     summary: Set company subscription program status (DRAFT / ACTIVE / SUSPENDED / CANCELLED)
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [DRAFT, ACTIVE, SUSPENDED, CANCELLED]
 *     responses:
 *       200:
 *         description: Status updated
 */
export const patchCompanySubscription = async (req: Request, res: Response) => {
  try {
    const companyId = String(req.params.companyId ?? '');
    const { status } = req.body as { status?: string };
    const allowed = Object.values(CompanySubscriptionStatus) as string[];
    if (!status || !allowed.includes(status)) {
      return errorResponse(res, 'Invalid subscription status', 400);
    }
    const c = await companyService.setSubscriptionStatus(
      ownerId(req),
      companyId,
      status as CompanySubscriptionStatus,
    );
    return successResponse(res, 'Subscription status updated', { company: c }, 200);
  } catch (e) {
    if (e instanceof CompanyOwnerError) {
      return errorResponse(res, e.message, 404);
    }
    console.error(e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/company/{companyId}/employees:
 *   post:
 *     summary: Link an app user (role USER) as an employee of the company
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               email:
 *                 type: string
 *             description: Provide userId or email (exact match)
 *     responses:
 *       200:
 *         description: Employee linked
 *       400:
 *         description: Invalid employee
 */
export const addCompanyEmployee = async (req: Request, res: Response) => {
  try {
    const companyId = String(req.params.companyId ?? '');
    const { userId, userCode } = req.body as { userId?: string; userCode?: string };
    let uid = userId?.trim();
    const code = userCode?.trim();
    if (!uid && code) {
      const u = await prisma.user.findFirst({
        where: { qrCode: code },
        select: { id: true },
      });
      uid = u?.id;
    }
    if (!uid) {
      return errorResponse(res, 'userId or valid userCode (customer QR code) is required', 400);
    }
    const row = await companyService.addEmployee(ownerId(req), companyId, uid);
    return successResponse(res, 'Employee linked successfully', { employee: row }, 200);
  } catch (e) {
    if (e instanceof CompanyOwnerError) {
      const code = e.message === 'COMPANY_NOT_FOUND' ? 404 : 400;
      return errorResponse(res, e.message, code);
    }
    console.error(e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/company/{companyId}/employees/{userId}:
 *   delete:
 *     summary: Unlink an employee from the company
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 */
export const removeCompanyEmployee = async (req: Request, res: Response) => {
  try {
    const companyId = String(req.params.companyId ?? '');
    const userId = String(req.params.userId ?? '');
    await companyService.removeEmployee(ownerId(req), companyId, userId);
    return successResponse(res, 'Employee unlinked successfully', {}, 200);
  } catch (e) {
    if (e instanceof CompanyOwnerError) {
      return errorResponse(res, e.message, 404);
    }
    console.error(e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * @swagger
 * /client/company/{companyId}/resolve-user:
 *   get:
 *     summary: Resolve a user by app customer code (User.qrCode) for linking as employee
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 */
export const resolveUserByCode = async (req: Request, res: Response) => {
  try {
    const code = String(req.query.code ?? '').trim();
    if (!code) return errorResponse(res, 'code query is required', 400);
    const u = await prisma.user.findFirst({
      where: { qrCode: code },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, qrCode: true },
    });
    if (!u) return errorResponse(res, 'User not found', 404);
    if (u.role !== 'USER') {
      return errorResponse(res, 'Only app customers (USER) can be linked as employees', 400);
    }
    return successResponse(res, 'User resolved', { user: u }, 200);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Server error', 500);
  }
};

/** Internal / dev helper — production relies on scheduled job. */
/**
 * @swagger
 * /client/company/{companyId}/allowance/run:
 *   post:
 *     summary: Run monthly allowance processing for a company (manual/dev trigger)
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: yearMonth
 *         required: false
 *         schema:
 *           type: string
 *           pattern: ^\d{4}-\d{2}$
 *         description: Target month in format YYYY-MM. Defaults to current UTC month.
 *     responses:
 *       200:
 *         description: Allowance processing completed
 *       400:
 *         description: Invalid yearMonth
 *       404:
 *         description: Company not found
 */
export const runAllowanceDry = async (req: Request, res: Response) => {
  try {
    const ym = typeof req.query.yearMonth === 'string' ? req.query.yearMonth : yearMonthUTC();
    if (!/^\d{4}-\d{2}$/.test(ym)) {
      return errorResponse(res, 'yearMonth must be YYYY-MM', 400);
    }
    const companyId = String(req.params.companyId ?? '');
    const company = await prisma.company.findFirst({
      where: { id: companyId, ownerId: ownerId(req) },
    });
    if (!company) return errorResponse(res, 'Company not found', 404);
    const r = await companyService.processCompanyAllowanceMonth(companyId, ym);
    return successResponse(res, 'Allowance run finished', { result: r }, 200);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * List completed meal-allowance transfers to employees (ledger credits on user wallets).
 * Each row is one “invoice line” for an employee transfer.
 */
/**
 * @swagger
 * /client/company/{companyId}/allowance-transfers:
 *   get:
 *     summary: List company allowance transfers credited to employees
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: take
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 500
 *       - in: query
 *         name: skip
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 0
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Transfers retrieved
 *       400:
 *         description: Invalid filter values
 *       404:
 *         description: Company not found
 */
export const listCompanyAllowanceTransfers = async (req: Request, res: Response) => {
  try {
    const companyId = String(req.params.companyId ?? '');
    const company = await prisma.company.findFirst({
      where: { id: companyId, ownerId: ownerId(req) },
      select: { id: true },
    });
    if (!company) return errorResponse(res, 'Company not found', 404);

    const take = Math.min(parseInt(String(req.query.take ?? '100'), 10) || 100, 500);
    const skip = Math.max(parseInt(String(req.query.skip ?? '0'), 10) || 0, 0);
    const { start, end, error: drErr } = parseExportDateRange(req.query);
    if (drErr) return errorResponse(res, drErr, 400);

    const createdAt: Prisma.DateTimeFilter | undefined =
      start || end
        ? {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          }
        : undefined;

    const where: Prisma.WalletLedgerEntryWhereInput = {
      source: 'COMPANY_ALLOWANCE',
      referenceId: companyId,
      type: 'CREDIT',
      status: 'COMPLETED',
      ...(createdAt ? { createdAt } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.walletLedgerEntry.count({ where }),
      prisma.walletLedgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          wallet: { select: { ownerType: true, ownerId: true } },
        },
      }),
    ]);

    const userIds = [
      ...new Set(
        rows
          .filter((r) => r.wallet.ownerType === 'USER')
          .map((r) => r.wallet.ownerId),
      ),
    ];
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, fullName: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const items = rows.map((e) => {
      const uid = e.wallet.ownerType === 'USER' ? e.wallet.ownerId : null;
      const u = uid ? userMap.get(uid) : undefined;
      const meta = (e.metadata ?? {}) as { yearMonth?: string };
      return {
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        amount: formatWalletAmountForApi(e.amount),
        currency: 'EUR',
        employeeUserId: uid,
        employeeEmail: u?.email ?? null,
        employeeName: u?.fullName ?? null,
        yearMonth: meta.yearMonth ?? null,
        idempotencyKey: e.idempotencyKey,
      };
    });

    return successResponse(res, 'Allowance transfers', { items, total }, 200);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Server error', 500);
  }
};

/** CSV export of allowance transfers in a date range (invoice-style lines). */
/**
 * @swagger
 * /client/company/{companyId}/allowance-transfers/export:
 *   get:
 *     summary: Export allowance transfers as CSV
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: CSV file stream
 *       400:
 *         description: Missing or invalid date filters
 *       404:
 *         description: Company not found
 */
export const exportCompanyAllowanceTransfersCsv = async (req: Request, res: Response) => {
  try {
    const companyId = String(req.params.companyId ?? '');
    const company = await prisma.company.findFirst({
      where: { id: companyId, ownerId: ownerId(req) },
      select: { id: true, name: true },
    });
    if (!company) return errorResponse(res, 'Company not found', 404);

    const { start, end, error: drErr } = parseExportDateRange(req.query);
    if (drErr) return errorResponse(res, drErr, 400);
    if (!start && !end) {
      return errorResponse(res, 'Provide startDate and/or endDate (ISO)', 400);
    }

    const createdAt: Prisma.DateTimeFilter = {
      ...(start ? { gte: start } : {}),
      ...(end ? { lte: end } : {}),
    };

    const rows = await prisma.walletLedgerEntry.findMany({
      where: {
        source: 'COMPANY_ALLOWANCE',
        referenceId: companyId,
        type: 'CREDIT',
        status: 'COMPLETED',
        createdAt,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        wallet: { select: { ownerType: true, ownerId: true } },
      },
    });

    const userIds = [
      ...new Set(
        rows
          .filter((r) => r.wallet.ownerType === 'USER')
          .map((r) => r.wallet.ownerId),
      ),
    ];
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, fullName: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const header = [
      'date_utc',
      'employee_email',
      'employee_name',
      'amount_eur',
      'year_month',
      'ledger_id',
    ];
    const lines = rows.map((e) => {
      const uid = e.wallet.ownerType === 'USER' ? e.wallet.ownerId : null;
      const u = uid ? userMap.get(uid) : undefined;
      const meta = (e.metadata ?? {}) as { yearMonth?: string };
      return [
        csvEscape(e.createdAt.toISOString()),
        csvEscape(u?.email ?? ''),
        csvEscape(u?.fullName ?? ''),
        csvEscape(formatWalletAmountForApi(e.amount)),
        csvEscape(meta.yearMonth ?? ''),
        csvEscape(e.id),
      ].join(',');
    });

    const bom = '\ufeff';
    const csv = bom + [header.join(','), ...lines].join('\r\n') + '\r\n';
    const safeName = (company.name ?? 'company').replace(/[^\w\-]+/g, '_').slice(0, 80);
    const rangeLabel = `${start?.toISOString().slice(0, 10) ?? 'start'}_${end?.toISOString().slice(0, 10) ?? 'end'}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}_allowance_${rangeLabel}.csv"`,
    );
    return res.status(200).send(csv);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Server error', 500);
  }
};
