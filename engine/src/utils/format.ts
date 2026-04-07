export function formatCash(amount: number): string {
  if (amount >= 10000) return `${Math.floor(amount / 1000)}k doubloons`;
  return `${Math.floor(amount)} doubloons`;
}

export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDistance(nm: number): string {
  if (nm >= 1000) return `${(nm / 1000).toFixed(1)}k nm`;
  return `${Math.round(nm)} nm`;
}

export function formatDuration(ticks: number): string {
  if (ticks < 24) return `${ticks} hours`;
  const days = Math.floor(ticks / 24);
  const hours = ticks % 24;
  return hours > 0 ? `${days}d ${hours}h` : `${days} days`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}
