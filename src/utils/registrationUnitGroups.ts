export type RegistrationUnitGroup = {
  slug: string;
  unitSlugs: string[];
  label: string;
};

/** Grupos de unidades que compartilham a mesma URL de inscrição interna. */
export const REGISTRATION_UNIT_GROUPS: RegistrationUnitGroup[] = [
  {
    slug: 'uba',
    unitSlugs: ['uba-1', 'uba-2'],
    label: 'UBA — Unidades 1 e 2',
  },
];

export function getRegistrationGroupBySlug(slug: string): RegistrationUnitGroup | undefined {
  return REGISTRATION_UNIT_GROUPS.find((group) => group.slug === slug);
}

export function getRegistrationGroupForUnitSlug(
  unitSlug: string | null | undefined
): RegistrationUnitGroup | undefined {
  if (!unitSlug) return undefined;
  return REGISTRATION_UNIT_GROUPS.find((group) => group.unitSlugs.includes(unitSlug));
}

export function getRegistrationLinkForUnit(
  unitSlug: string | null | undefined,
  isCentral: boolean
): string {
  if (isCentral || !unitSlug) return '/inscricao';
  const group = getRegistrationGroupForUnitSlug(unitSlug);
  if (group) return `/inscricao/${group.slug}`;
  return `/inscricao/${unitSlug}`;
}
