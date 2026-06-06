import { supabase } from '@/integrations/supabase/client';

const ENROLLMENT_STATUS_PATTERN = /status alterado para:\s*matriculado/i;

export function isEnrollmentInteraction(
  interactionType: string,
  comments: string | null | undefined
): boolean {
  if (interactionType === 'matricula') return true;
  if (interactionType === 'mudanca_status') {
    return ENROLLMENT_STATUS_PATTERN.test(comments || '');
  }
  return false;
}

/** Data em que o aluno passou ao status matriculado (interação de mudança ou matrícula). */
export async function fetchEnrollmentDatesByStudentIds(
  studentIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (studentIds.length === 0) return map;

  const chunkSize = 200;
  for (let i = 0; i < studentIds.length; i += chunkSize) {
    const chunk = studentIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('student_interactions')
      .select('student_id, created_at, interaction_type, comments')
      .in('student_id', chunk)
      .in('interaction_type', ['matricula', 'mudanca_status']);

    if (error) {
      console.error('Erro ao buscar datas de matrícula:', error);
      continue;
    }

    (data || []).forEach((row) => {
      if (!row.student_id || !isEnrollmentInteraction(row.interaction_type, row.comments)) {
        return;
      }
      const prev = map.get(row.student_id);
      if (!prev || new Date(row.created_at) < new Date(prev)) {
        map.set(row.student_id, row.created_at);
      }
    });
  }

  return map;
}

export function resolveEnrollmentDate(
  studentId: string,
  enrollmentDates: Map<string, string>,
  updatedAt: string | null | undefined,
  createdAt: string | null | undefined
): string | null {
  return enrollmentDates.get(studentId) || updatedAt || createdAt || null;
}
