import {
  formatDate,
  getTodayDate,
  parseDate,
  toDateString,
  parseDateString,
} from './date';

export * from './date';

export const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export const MONTH_NAMES_GENITIVE_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

export const WEEKDAYS_RU = [
  { index: 1, short: 'Пн', full: 'Понедельник' },
  { index: 2, short: 'Вт', full: 'Вторник' },
  { index: 3, short: 'Ср', full: 'Среда' },
  { index: 4, short: 'Чт', full: 'Четверг' },
  { index: 5, short: 'Пт', full: 'Пятница' },
  { index: 6, short: 'Сб', full: 'Суббота' },
  { index: 0, short: 'Вс', full: 'Воскресенье' },
];

export function formatHumanDate(dateStr: string): string {
  const date = parseDate(dateStr);
  const day = date.getDate();
  const month = MONTH_NAMES_GENITIVE_RU[date.getMonth()];
  const year = date.getFullYear();
  const weekdayIndex = date.getDay();
  const weekday = WEEKDAYS_RU.find(w => w.index === weekdayIndex)?.full || '';
  return `${day} ${month} ${year}, ${weekday}`;
}

export function getMonthMatrix(year: number, month: number): Array<{
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayOfWeek: number;
}> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const todayStr = getTodayDate();

  // In RU, week starts on Monday (1). Sunday is 0 -> convert to 7
  let startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  const cells: Array<{
    dateStr: string;
    dayNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    dayOfWeek: number;
  }> = [];

  // Previous month trailing days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const dObj = new Date(year, month - 1, d);
    const dateStr = formatDate(dObj);
    cells.push({
      dateStr,
      dayNumber: d,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      dayOfWeek: dObj.getDay(),
    });
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dObj = new Date(year, month, d);
    const dateStr = formatDate(dObj);
    cells.push({
      dateStr,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      dayOfWeek: dObj.getDay(),
    });
  }

  // Next month leading days to complete full 35 or 42 grid
  const remaining = (7 - (cells.length % 7)) % 7;
  // Make it at least 35 or 42
  const targetLength = cells.length + remaining < 35 ? 35 : cells.length + remaining;
  const toFill = targetLength - cells.length;

  for (let d = 1; d <= toFill; d++) {
    const dObj = new Date(year, month + 1, d);
    const dateStr = formatDate(dObj);
    cells.push({
      dateStr,
      dayNumber: d,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      dayOfWeek: dObj.getDay(),
    });
  }

  return cells;
}

export function getWeekDays(referenceDate: Date): Array<{
  dateStr: string;
  dayNumber: number;
  monthName: string;
  isToday: boolean;
  dayOfWeek: number;
  weekdayShort: string;
}> {
  const curr = new Date(referenceDate);
  const todayStr = getTodayDate();
  // Normalize to Monday of this week
  const day = curr.getDay();
  const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(curr.setDate(diff));

  const result = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = formatDate(d);
    const wd = WEEKDAYS_RU.find(w => w.index === d.getDay());
    result.push({
      dateStr,
      dayNumber: d.getDate(),
      monthName: MONTH_NAMES_GENITIVE_RU[d.getMonth()],
      isToday: dateStr === todayStr,
      dayOfWeek: d.getDay(),
      weekdayShort: wd?.short || '',
    });
  }
  return result;
}
