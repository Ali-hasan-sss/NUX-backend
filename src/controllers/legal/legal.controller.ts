import { Request, Response } from 'express';
import { LegalDocumentType, PrismaClient } from '@prisma/client';
import { errorResponse, successResponse } from '../../utils/response';
import {
  LEGAL_LOCALES,
  emptyLegalContentMap,
  parseLegalLocale,
  parsePublicLegalType,
  publicTypeSlug,
  type LegalContentMap,
  type LegalLocale,
} from './legal.constants';

const prisma = new PrismaClient();

function mapRowsToContentMap(
  rows: { type: LegalDocumentType; locale: string; content: string }[]
): LegalContentMap {
  const out = emptyLegalContentMap();
  for (const row of rows) {
    const locale = parseLegalLocale(row.locale);
    const slug = publicTypeSlug(row.type);
    out[slug][locale] = row.content ?? '';
  }
  return out;
}

async function resolveLegalContent(
  type: LegalDocumentType,
  locale: LegalLocale
): Promise<{ type: LegalDocumentType; locale: LegalLocale; content: string; updatedAt: string | null }> {
  let doc = await prisma.legalDocument.findUnique({
    where: { type_locale: { type, locale } },
  });
  if (!doc && locale !== 'en') {
    doc = await prisma.legalDocument.findUnique({
      where: { type_locale: { type, locale: 'en' } },
    });
  }
  return {
    type,
    locale: doc ? parseLegalLocale(doc.locale) : locale,
    content: doc?.content ?? '',
    updatedAt: doc?.updatedAt?.toISOString() ?? null,
  };
}

/** GET /api/public/legal/:type?locale=en */
export const getPublicLegalDocument = async (req: Request, res: Response) => {
  try {
    const type = parsePublicLegalType(req.params.type ?? '');
    if (!type) {
      return errorResponse(res, 'Invalid legal document type', 400);
    }
    const locale = parseLegalLocale(req.query.locale);
    const data = await resolveLegalContent(type, locale);
    return successResponse(res, 'Legal document fetched', data);
  } catch (err) {
    console.error('getPublicLegalDocument:', err);
    return errorResponse(res, 'Internal server error', 500);
  }
};

/** GET /api/admin/legal */
export const getAdminLegalDocuments = async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.legalDocument.findMany();
    return successResponse(res, 'Legal documents fetched', mapRowsToContentMap(rows));
  } catch (err) {
    console.error('getAdminLegalDocuments:', err);
    return errorResponse(res, 'Internal server error', 500);
  }
};

function normalizeContentMap(body: unknown): LegalContentMap | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const privacy = b.privacy;
  const terms = b.terms;
  if (!privacy || typeof privacy !== 'object' || !terms || typeof terms !== 'object') {
    return null;
  }
  const out = emptyLegalContentMap();
  for (const locale of LEGAL_LOCALES) {
    const p = (privacy as Record<string, unknown>)[locale];
    const t = (terms as Record<string, unknown>)[locale];
    out.privacy[locale] = typeof p === 'string' ? p : '';
    out.terms[locale] = typeof t === 'string' ? t : '';
  }
  return out;
}

/** PUT /api/admin/legal */
export const updateAdminLegalDocuments = async (req: Request, res: Response) => {
  try {
    const map = normalizeContentMap(req.body);
    if (!map) {
      return errorResponse(res, 'Invalid body: expected { privacy: { en, ar, de }, terms: { en, ar, de } }', 400);
    }

    const upserts: Promise<unknown>[] = [];
    for (const locale of LEGAL_LOCALES) {
      upserts.push(
        prisma.legalDocument.upsert({
          where: {
            type_locale: { type: LegalDocumentType.PRIVACY_POLICY, locale },
          },
          create: {
            type: LegalDocumentType.PRIVACY_POLICY,
            locale,
            content: map.privacy[locale],
          },
          update: { content: map.privacy[locale] },
        })
      );
      upserts.push(
        prisma.legalDocument.upsert({
          where: {
            type_locale: { type: LegalDocumentType.TERMS_OF_USE, locale },
          },
          create: {
            type: LegalDocumentType.TERMS_OF_USE,
            locale,
            content: map.terms[locale],
          },
          update: { content: map.terms[locale] },
        })
      );
    }
    await Promise.all(upserts);

    const rows = await prisma.legalDocument.findMany();
    return successResponse(res, 'Legal documents updated', mapRowsToContentMap(rows));
  } catch (err) {
    console.error('updateAdminLegalDocuments:', err);
    return errorResponse(res, 'Internal server error', 500);
  }
};
