import { getCurrentDate } from '@/utils/dateUtils';

export type ReportDateFilterType = 'default' | 'all' | 'today' | '7days' | '30days' | 'custom';

export interface ReportDateFilterState {
  dateFilterType: ReportDateFilterType;
  customStartDate: string;
  customEndDate: string;
}

export function getDateYYYYMMDD(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  if (dateStr.includes('T')) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return dateStr.substring(0, 10);
}

export function shouldApplyDateFilter(filter: ReportDateFilterState): boolean {
  return filter.dateFilterType !== 'default' && filter.dateFilterType !== 'all';
}

export function isDateInReportPeriod(
  dateStr: string | null | undefined,
  filter: ReportDateFilterState
): boolean {
  const yyyymmdd = getDateYYYYMMDD(dateStr);
  if (!yyyymmdd) return false;

  const todayStr = getCurrentDate();

  if (filter.dateFilterType === 'default' || filter.dateFilterType === 'all') return true;
  if (filter.dateFilterType === 'today') return yyyymmdd === todayStr;

  const today = new Date(todayStr + 'T00:00:00');
  const targetDate = new Date(yyyymmdd + 'T00:00:00');

  if (filter.dateFilterType === '7days') {
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    return targetDate >= sevenDaysAgo && targetDate <= today;
  }
  if (filter.dateFilterType === '30days') {
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return targetDate >= thirtyDaysAgo && targetDate <= today;
  }
  if (filter.dateFilterType === 'custom') {
    if (filter.customStartDate && filter.customEndDate) {
      return yyyymmdd >= filter.customStartDate && yyyymmdd <= filter.customEndDate;
    }
    return true;
  }
  return true;
}

export function isCreatedInReportPeriod(
  dateStr: string | null | undefined,
  filter: ReportDateFilterState
): boolean {
  return isDateInReportPeriod(dateStr, filter);
}

export function isActivityInReportPeriod(
  createdAt: string | null | undefined,
  updatedAt: string | null | undefined,
  filter: ReportDateFilterState
): boolean {
  return isDateInReportPeriod(updatedAt || createdAt, filter);
}

export function getReportPeriodBounds(filter: ReportDateFilterState): { start: string; end: string } | null {
  const todayStr = getCurrentDate();

  if (filter.dateFilterType === 'default' || filter.dateFilterType === 'all') {
    return null;
  }
  if (filter.dateFilterType === 'today') {
    return { start: todayStr, end: todayStr };
  }
  if (filter.dateFilterType === '7days') {
    const start = new Date(todayStr + 'T00:00:00');
    start.setDate(start.getDate() - 7);
    return { start: start.toISOString().substring(0, 10), end: todayStr };
  }
  if (filter.dateFilterType === '30days') {
    const start = new Date(todayStr + 'T00:00:00');
    start.setDate(start.getDate() - 30);
    return { start: start.toISOString().substring(0, 10), end: todayStr };
  }
  if (filter.dateFilterType === 'custom' && filter.customStartDate && filter.customEndDate) {
    return { start: filter.customStartDate, end: filter.customEndDate };
  }
  return null;
}
