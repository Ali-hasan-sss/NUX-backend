import { LegalDocumentType } from '@prisma/client';

export const LEGAL_LOCALES = ['en', 'ar', 'de'] as const;
export type LegalLocale = (typeof LEGAL_LOCALES)[number];

export function parseLegalLocale(raw: unknown): LegalLocale {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (LEGAL_LOCALES.includes(s as LegalLocale)) return s as LegalLocale;
  return 'en';
}

export function parsePublicLegalType(raw: string): LegalDocumentType | null {
  const t = raw.trim().toLowerCase();
  if (t === 'privacy' || t === 'privacy-policy') return LegalDocumentType.PRIVACY_POLICY;
  if (t === 'terms' || t === 'terms-of-use') return LegalDocumentType.TERMS_OF_USE;
  return null;
}

export function publicTypeSlug(type: LegalDocumentType): 'privacy' | 'terms' {
  return type === LegalDocumentType.PRIVACY_POLICY ? 'privacy' : 'terms';
}

export type LegalContentMap = {
  privacy: Record<LegalLocale, string>;
  terms: Record<LegalLocale, string>;
};

export function emptyLegalContentMap(): LegalContentMap {
  return {
    privacy: { en: '', ar: '', de: '' },
    terms: { en: '', ar: '', de: '' },
  };
}
