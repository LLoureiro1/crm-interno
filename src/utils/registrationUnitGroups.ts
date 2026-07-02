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
    label: 'UBÁ',
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

/** Retorna a unidade quando só uma do grupo possui turmas para a série. */
export function getGroupAutoSelectedUnitId(
  classesInGroup: Array<{ unit_id: string | null }>
): string | null {
  const unitIds = [
    ...new Set(classesInGroup.map((cls) => cls.unit_id).filter((id): id is string => !!id)),
  ];
  return unitIds.length === 1 ? unitIds[0] : null;
}
