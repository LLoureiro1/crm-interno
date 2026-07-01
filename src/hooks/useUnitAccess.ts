import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/integrations/supabase/types';
import { filterVisibleUnits } from '@/utils/unitAccess';

type Unit = Tables<'units'>;

type UnitAccessState = {
  fullAccess: boolean;
  unitIds: string[];
  loading: boolean;
};

const EMPTY_ACCESS: UnitAccessState = {
  fullAccess: false,
  unitIds: [],
  loading: true,
};

export const useUnitAccess = () => {
  const { profile } = useAuth();
  const [access, setAccess] = useState<UnitAccessState>(EMPTY_ACCESS);

  useEffect(() => {
    if (!profile) {
      setAccess({ fullAccess: false, unitIds: [], loading: false });
      return;
    }

    let cancelled = false;

    const load = async () => {
      setAccess((prev) => ({ ...prev, loading: true }));

      const { data, error } = await supabase.rpc('get_my_unit_access');

      if (cancelled) return;

      if (error) {
        console.error('Erro ao carregar acesso por unidade:', error);
        setAccess({
          fullAccess: profile.profile === 'admin',
          unitIds: profile.unit_id ? [profile.unit_id] : [],
          loading: false,
        });
        return;
      }

      const payload = data as { full_access?: boolean; unit_ids?: string[] } | null;
      setAccess({
        fullAccess: !!payload?.full_access,
        unitIds: (payload?.unit_ids ?? []).map(String),
        loading: false,
      });
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.profile, profile?.unit_id]);

  const getVisibleUnits = useCallback(
    (units: Unit[]) => filterVisibleUnits(units, access.fullAccess, access.unitIds),
    [access.fullAccess, access.unitIds],
  );

  const canAccessUnit = useCallback(
    (unitId: string | null | undefined) => {
      if (!unitId) return false;
      if (access.fullAccess) return true;
      return access.unitIds.includes(unitId);
    },
    [access.fullAccess, access.unitIds],
  );

  return {
    fullAccess: access.fullAccess,
    allowedUnitIds: access.unitIds,
    loading: access.loading,
    getVisibleUnits,
    canAccessUnit,
  };
};
