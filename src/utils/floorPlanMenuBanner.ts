/** Menu banner stored inside Restaurant.floorPlan JSON (no schema migration). */

export type FloorPlanData = {
  walls: unknown[];
  elements: unknown[];
  menuBanner?: { message: string };
};

export function parseFloorPlan(raw: unknown): FloorPlanData {
  const fp = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const walls = Array.isArray(fp.walls) ? fp.walls : [];
  const elements = Array.isArray(fp.elements) ? fp.elements : [];
  const menuBanner = extractMenuBanner(fp);
  return menuBanner ? { walls, elements, menuBanner } : { walls, elements };
}

export function extractMenuBanner(fp: Record<string, unknown>): { message: string } | undefined {
  const banner = fp.menuBanner;
  if (!banner || typeof banner !== 'object') return undefined;
  const message = String((banner as { message?: unknown }).message ?? '').trim();
  return message ? { message } : undefined;
}

export function getMenuBannerMessage(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const banner = extractMenuBanner(raw as Record<string, unknown>);
  return banner?.message ?? null;
}

export function mergeFloorPlanWithMenuBanner(
  existing: unknown,
  message: string | null | undefined
): FloorPlanData {
  const base = parseFloorPlan(existing);
  const trimmed = (message ?? '').trim();
  if (!trimmed) {
    return { walls: base.walls, elements: base.elements };
  }
  return {
    walls: base.walls,
    elements: base.elements,
    menuBanner: { message: trimmed },
  };
}
