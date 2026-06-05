type StudentWithUnit = {
  unit_id?: string | null;
  exam_date?: string | null;
  status?: string;
  classes?: { unit_id?: string } | null;
};

export type NextExamDatesByUnit = Record<string, string>;

/** Normaliza YYYY-MM-DD para comparação estável. */
export function normalizeExamDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return String(value).slice(0, 10);
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function getStudentUnitId(student: StudentWithUnit): string | undefined {
  return student.unit_id ?? student.classes?.unit_id ?? undefined;
}

/** Primeira data futura cadastrada em exam_dates, por unidade. */
export function buildEarliestExamDatesByUnit(
  rows: Array<{ unit_id: string; exam_date: string }>,
): NextExamDatesByUnit {
  const earliestByUnit: NextExamDatesByUnit = {};
  for (const row of rows) {
    if (!earliestByUnit[row.unit_id]) {
      const normalized = normalizeExamDate(row.exam_date);
      if (normalized) earliestByUnit[row.unit_id] = normalized;
    }
  }
  return earliestByUnit;
}

/**
 * Para unidades sem data em exam_dates, infere a próxima prova a partir
 * das datas futuras já atribuídas aos alunos.
 */
export function supplementNextExamDatesFromStudents<T extends StudentWithUnit>(
  students: T[],
  datesByUnit: NextExamDatesByUnit,
  today: string,
): NextExamDatesByUnit {
  const result = { ...datesByUnit };
  const todayNorm = normalizeExamDate(today);
  if (!todayNorm) return result;

  const futureDatesByUnit: Record<string, string[]> = {};

  for (const student of students) {
    const unitId = getStudentUnitId(student);
    const examDate = normalizeExamDate(student.exam_date);
    if (!unitId || !examDate || examDate < todayNorm) continue;
    if (!futureDatesByUnit[unitId]) futureDatesByUnit[unitId] = [];
    futureDatesByUnit[unitId].push(examDate);
  }

  for (const [unitId, dates] of Object.entries(futureDatesByUnit)) {
    if (!result[unitId]) {
      result[unitId] = [...dates].sort()[0];
    }
  }

  return result;
}

/** Alunos cuja data de prova coincide com a próxima da unidade. */
export function filterStudentsProximaProva<T extends StudentWithUnit>(
  students: T[],
  datesByUnit: NextExamDatesByUnit,
): T[] {
  return students.filter((student) => {
    if (student.status === 'cadastro_invalido') return false;

    const studentUnitId = getStudentUnitId(student);
    if (!studentUnitId) return false;

    const unitNextDate = datesByUnit[studentUnitId];
    if (!unitNextDate) return false;

    const studentExamDate = normalizeExamDate(student.exam_date);
    return !!studentExamDate && studentExamDate === unitNextDate;
  });
}

export function countStudentsProximaProva<T extends StudentWithUnit>(
  students: T[],
  datesByUnit: NextExamDatesByUnit,
): number {
  return filterStudentsProximaProva(students, datesByUnit).length;
}
