type PlanDescriptionFields = {
  description: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  descriptionDe: string | null;
  descriptionTr: string | null;
};

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
