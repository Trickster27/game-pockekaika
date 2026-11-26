import { tr } from '@/i18n';
import { useEffect, useState } from 'react';

/** Текущее время, обновляемое раз в intervalMs (для таймеров энергии и idle). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  if (h >= 48) return tr('time.dh', { d: Math.floor(h / 24), h: h % 24 });
  if (h > 0) return tr('time.hm', { h, m });
  return `${m}:${String(sec).padStart(2, '0')}`;
}
