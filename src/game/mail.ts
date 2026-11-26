import type { MailItem, SaveData } from '@/save/schema';
import { grantReward, periodKey, type ShopReward } from './shop';

/**
 * Почта: письма от игры. Заголовок и текст — ключи перевода (с параметрами), награда забирается кнопкой.
 * Системные письма (приветствие, новости обновлений, возвращение, сезон арены) отправляются один раз
 * по своему ключу — повторный вызов ничего не делает.
 */
export const MAIL_KEEP = 60;
const DAY = 86_400_000;

export function sendMail(
  save: SaveData,
  m: { key?: string; title: string; body: string; params?: MailItem['params']; reward?: ShopReward },
  now = Date.now(),
): MailItem | null {
  if (m.key && save.mail.sent.includes(m.key)) return null;
  save.mail.seq += 1;
  const item: MailItem = {
    id: `m${save.mail.seq}`,
    title: m.title,
    body: m.body,
    ...(m.params ? { params: m.params } : {}),
    ...(m.reward ? { reward: m.reward } : {}),
    at: now,
  };
  save.mail.items.push(item);
  if (m.key) save.mail.sent.push(m.key);
  // Старые прочитанные письма без наград уходят первыми.
  while (save.mail.items.length > MAIL_KEEP) {
    const i = save.mail.items.findIndex((x) => x.read && (!x.reward || x.claimed));
    save.mail.items.splice(i >= 0 ? i : 0, 1);
  }
  return item;
}

export function unreadMail(save: SaveData): number {
  return save.mail.items.filter((m) => !m.read || (m.reward && !m.claimed)).length;
}

export function readMail(save: SaveData, id: string) {
  const m = save.mail.items.find((x) => x.id === id);
  if (m) m.read = true;
}

export function claimMail(save: SaveData, id: string, now = Date.now()): ShopReward | null {
  const m = save.mail.items.find((x) => x.id === id);
  if (!m || !m.reward || m.claimed) return null;
  grantReward(save, m.reward, now);
  m.claimed = true;
  m.read = true;
  return m.reward;
}

export function claimAllMail(save: SaveData, now = Date.now()): ShopReward[] {
  return save.mail.items
    .filter((m) => m.reward && !m.claimed)
    .map((m) => claimMail(save, m.id, now)!)
    .filter(Boolean);
}

export function deleteReadMail(save: SaveData) {
  save.mail.items = save.mail.items.filter((m) => !m.read || (m.reward && !m.claimed));
}

/** Подарок за возвращение: от 3 дней отсутствия, растёт до 14 дней. */
export function comebackGift(days: number): ShopReward {
  const d = Math.min(14, days);
  return {
    gold: 6_000 * d,
    shards: 25 * d,
    energy: 60,
    materials: {
      xpTome: 2 * d,
      ...(d >= 7 ? { ancientScroll: 1 } : {}),
      ...(d >= 14 ? { skillBook: 2 } : {}),
    },
  };
}

/** Системные письма при запуске игры. lastSeen — когда игрок был в игре в прошлый раз. */
export function systemMail(save: SaveData, lastSeen: number, now = Date.now()) {
  sendMail(
    save,
    {
      key: 'welcome-book1',
      title: 'mail.welcome.title',
      body: 'mail.welcome.body',
      reward: { shards: 200, materials: { ancientScroll: 1, skillBook: 2 } },
    },
    now,
  );
  const away = Math.floor((now - lastSeen) / DAY);
  if (lastSeen > 0 && away >= 3)
    sendMail(
      save,
      {
        key: `comeback-${periodKey('day', lastSeen)}`,
        title: 'mail.comeback.title',
        body: 'mail.comeback.body',
        params: { n: away },
        reward: comebackGift(away),
      },
      now,
    );
}
