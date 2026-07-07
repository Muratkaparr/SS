const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** "15m", "7d" gibi JWT TTL string'lerini milisaniyeye çevirir. */
export function parseTtlMs(ttl: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(ttl);
  if (!match) return 0;
  return Number(match[1]) * UNIT_MS[match[2]];
}
