type PlanDescriptionFields = {
  description: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  descriptionDe: string | null;
  descriptionTr: string | null;
};

const SUPPORTED_PLAN_LANGS = ['en', 'ar', 'de', 'tr'] as const;

function emptyToNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = value.replace(/<[^>]*>/g, "").trim();
  if (!stripped || /^[.\u2022\-\s]+$/.test(stripped)) return null;
  return value;
}

export function resolvePlanDescriptions(
  body: Record<string, unknown>,
  existing?: Partial<PlanDescriptionFields> | null,
): PlanDescriptionFields {
  const pick = (
    key: keyof PlanDescriptionFields,
    extraFallback?: string | null,
  ): string | null => {
    if (body[key] !== undefined) return emptyToNull(body[key]);
    return existing?.[key] ?? extraFallback ?? null;
  };

  const fromLegacy = emptyToNull(body.description) ?? existing?.description ?? null;
  const descriptionEn = pick("descriptionEn", fromLegacy);
  const descriptionAr = pick("descriptionAr");
  const descriptionDe = pick("descriptionDe");
  const descriptionTr = pick("descriptionTr");
  const description =
    descriptionEn ?? fromLegacy ?? descriptionAr ?? descriptionDe ?? descriptionTr;

  return {
    description,
    descriptionEn,
    descriptionAr,
    descriptionDe,
    descriptionTr,
  };
}

export function normalizePlanLang(raw: unknown): string {
  const code = String(raw || "en")
    .toLowerCase()
    .split(/[-_]/)[0]
    ?.trim() ?? "en";
  return (SUPPORTED_PLAN_LANGS as readonly string[]).includes(code) ? code : "en";
}

export function pickLocalizedPlanDescription(
  plan: Partial<PlanDescriptionFields> | null | undefined,
  lang: string | undefined | null,
): string | null {
  const code = normalizePlanLang(lang);
  const byLang: Record<string, string | null> = {
    en: emptyToNull(plan?.descriptionEn) ?? emptyToNull(plan?.description),
    ar: emptyToNull(plan?.descriptionAr),
    de: emptyToNull(plan?.descriptionDe),
    tr: emptyToNull(plan?.descriptionTr),
  };

  return (
    byLang[code] ??
    byLang.en ??
    emptyToNull(plan?.description) ??
    byLang.ar ??
    byLang.de ??
    byLang.tr ??
    null
  );
}

export function localizePlan<T extends Partial<PlanDescriptionFields>>(
  plan: T,
  lang: string | undefined | null,
): T {
  return {
    ...plan,
    description: pickLocalizedPlanDescription(plan, lang),
  };
}
