
// Utility functions for date formatting and parsing
export const formatDateForDisplay = (dateString: string): string => {
  // Parse date string as local date to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
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
