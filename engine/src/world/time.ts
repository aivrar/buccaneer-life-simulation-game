import type { GameTime } from '../runtime/types.js';
import { Season } from '../runtime/types.js';

export function createInitialGameTime(year = 1715, month = 1, day = 1): GameTime {
  return {
    year,
    month,
    day,
    hour: 8,
    season: getSeason(month),
    isDay: true,
    ticksElapsed: 0,
  };
}

export function getSeason(month: number): Season {
  if (month >= 3 && month <= 5) return Season.SPRING;
  if (month >= 6 && month <= 8) return Season.SUMMER;
  if (month >= 9 && month <= 11) return Season.AUTUMN;
  return Season.WINTER;
}

export function isHurricaneSeason(gameTime: GameTime): boolean {
  return gameTime.month >= 6 && gameTime.month <= 11;
}

export function formatGameDate(gt: GameTime): string {
  const months = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const timeOfDay = gt.isDay ? 'day' : 'night';
  return `${months[gt.month]} ${gt.day}, ${gt.year} (${gt.hour}:00, ${timeOfDay})`;
}

export function getTimeOfDay(hour: number): string {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  return 'night';
}

export function getDaysBetween(a: GameTime, b: GameTime): number {
  // Rough approximation
  return Math.abs(
    (b.year - a.year) * 365 +
    (b.month - a.month) * 30 +
    (b.day - a.day)
  );
}

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function getDayOfYear(gameTime: GameTime): number {
  let day = 0;
  for (let m = 1; m < gameTime.month; m++) {
    day += DAYS_IN_MONTH[m]!;
  }
  return day + gameTime.day;
}

export function getMonthProgress(gameTime: GameTime): number {
  const daysInMonth = DAYS_IN_MONTH[gameTime.month] ?? 30;
  return (gameTime.day - 1 + gameTime.hour / 24) / daysInMonth;
}

// Hurricane season probability curve (0.0-1.0) based on historical distribution.
// Interpolated within month for a smooth curve.
const HURRICANE_MONTH_WEIGHTS: Record<number, number> = {
  1: 0, 2: 0, 3: 0, 4: 0,
  5: 0.01, 6: 0.04, 7: 0.08,
  8: 0.25, 9: 0.35, 10: 0.20,
  11: 0.06, 12: 0.01,
};

export function hurricaneSeasonCurve(month: number, day: number): number {
  const currentWeight = HURRICANE_MONTH_WEIGHTS[month] ?? 0;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextWeight = HURRICANE_MONTH_WEIGHTS[nextMonth] ?? 0;
  const daysInMonth = DAYS_IN_MONTH[month] ?? 30;
  const progress = (day - 1) / daysInMonth;
  return currentWeight + (nextWeight - currentWeight) * progress;
}
