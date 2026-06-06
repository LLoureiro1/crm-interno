
import { isSameDay } from 'date-fns';

// Utility functions for date formatting and parsing
export const formatDateForDisplay = (dateString: string | null | undefined): string => {
  // Verificar se a data é válida antes de processar
  if (!dateString || dateString === '') {
    return 'Não informado';
  }
  
  // Parse date string as local date to avoid timezone issues
  const date = new Date(dateString + 'T00:00:00');
  
  // Verificar se a data é válida
  if (isNaN(date.getTime())) {
    return 'Data inválida';
  }
  
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const formatDateTimeForDisplay = (dateString: string, timeString?: string): string => {
  const formattedDate = formatDateForDisplay(dateString);
  if (timeString) {
    return `${formattedDate} às ${timeString}`;
  }
  return formattedDate;
};

export const getCurrentDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatTimeForDisplay = (timeString: string): string => {
  return timeString.substring(0, 5); // Remove seconds if present
};

/** Horário local da inscrição a partir de created_at (ISO). */
export const formatRegistrationTimeForDisplay = (
  dateTimeString: string | null | undefined
): string => {
  if (!dateTimeString) return '';
  const date = new Date(dateTimeString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

// Função para converter uma data para string no formato YYYY-MM-DD usando fuso horário local
export const dateToLocalString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Horários no dia atual anteriores ao momento de referência não podem ser agendados. */
export function isAppointmentSlotAvailableForDate(
  slotTime: string,
  selectedDate: Date,
  referenceDate: Date = new Date()
): boolean {
  if (!isSameDay(selectedDate, referenceDate)) {
    return true;
  }

  const normalizedTime = slotTime.substring(0, 5);
  const [hours, minutes] = normalizedTime.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return false;
  }

  const slotMinutes = hours * 60 + minutes;
  const nowMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();
  return slotMinutes >= nowMinutes;
}
