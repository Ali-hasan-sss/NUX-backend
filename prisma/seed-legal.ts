import { LegalDocumentType, PrismaClient } from '@prisma/client';
import { DEFAULT_LEGAL_CONTENT } from './legal-default-content';
import { LEGAL_LOCALES } from '../src/controllers/legal/legal.constants';

const prisma = new PrismaClient();

/** Insert or refresh default legal HTML. --force overwrites all; otherwise only empty rows. */
export async function seedLegalDocuments(force = false): Promise<void> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const locale of LEGAL_LOCALES) {
    for (const [slug, type] of [
      ['privacy', LegalDocumentType.PRIVACY_POLICY],
      ['terms', LegalDocumentType.TERMS_OF_USE],
    ] as const) {
      const defaultContent =
        slug === 'privacy'
          ? DEFAULT_LEGAL_CONTENT.privacy[locale]
          : DEFAULT_LEGAL_CONTENT.terms[locale];

      const existing = await prisma.legalDocument.findUnique({
        where: { type_locale: { type, locale } },
      });

      if (!existing) {
        await prisma.legalDocument.create({
          data: { type, locale, content: defaultContent },
        });
        created++;
        continue;
      }

      if (force || !existing.content.trim()) {
        await prisma.legalDocument.update({
          where: { type_locale: { type, locale } },
          data: { content: defaultContent },
        });
        updated++;
      } else {
        skipped++;
      }
    }
  }

  console.log(
    `✅ Legal seed done — created: ${created}, updated: ${updated}, skipped: ${skipped}`
  );
}

async function main() {
  const force = process.argv.includes('--force');
  await seedLegalDocuments(force);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ seed-legal error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
