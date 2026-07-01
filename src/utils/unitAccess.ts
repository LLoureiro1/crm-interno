import type { Tables } from '@/integrations/supabase/types';

type Unit = Tables<'units'>;

export const filterVisibleUnits = (
  units: Unit[],
  fullAccess: boolean,
  allowedUnitIds: string[],
): Unit[] => {
  if (fullAccess) return units;
  if (allowedUnitIds.length === 0) return [];
  const allowed = new Set(allowedUnitIds);
  return units.filter((unit) => allowed.has(unit.id));
};
