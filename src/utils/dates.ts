import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns';

/** Canonical day key used across meals, plans and logs. */
export function dayKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

export function weekDays(anchor: Date = new Date()): string[] {
  const monday = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => dayKey(addDays(monday, i)));
}

/** 14 day keys: the current week plus the next, so Sun→Mon stays visible. */
export function twoWeekDays(anchor: Date = new Date()): string[] {
  const monday = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 14 }, (_, i) => dayKey(addDays(monday, i)));
}

/** The Monday (week start) that a given `YYYY-MM-DD` day belongs to. */
export function mondayOf(dayKeyStr: string): string {
  return dayKey(startOfWeek(parseISO(dayKeyStr), { weekStartsOn: 1 }));
}

/** Days until an ISO date (negative if past). */
export function daysUntil(isoDate: string): number {
  return differenceInCalendarDays(parseISO(isoDate), new Date());
}

export function timeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 20) return 'afternoon';
  return 'evening';
}

/** Default meal type suggestion based on current time. */
export function suggestedMealType(): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}
