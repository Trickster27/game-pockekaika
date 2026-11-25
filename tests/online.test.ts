import { describe, expect, it } from 'vitest';
import { decideSync, OnlineError, validateNickname, isOnline } from '@/online';
import { DemoOnlineBackend } from '@/online/demo';

const mem = () => {
  const m = new Map<string, string>();
  return { get: (k: string) => m.get(k) ?? null, set: (k: string, v: string) => void m.set(k, v) };
};

describe('решение о синхронизации', () => {
  it('нет облачной копии — отправляем', () => expect(decideSync(100, null, 0)).toBe('push'));
  it('одинаковые — ничего', () => expect(decideSync(100, 100, 50)).toBe('none'));
  it('изменилась только локальная — отправляем', () => expect(decideSync(200, 100, 100)).toBe('push'));
  it('изменилась только облачная — загружаем', () => expect(decideSync(100, 300, 100)).toBe('pull'));
  it('изменились обе — конфликт', () => expect(decideSync(200, 300, 100)).toBe('conflict'));
  it('первая синхронизация на устройстве с разными копиями — конфликт', () =>
    expect(decideSync(200, 300, 0)).toBe('conflict'));
});

describe('ники', () => {
  it('2–20 символов, буквы, цифры, пробел, _.-', () => {
    expect(validateNickname('Хранитель')).toBe(true);
    expect(validateNickname('a')).toBe(false);
    expect(validateNickname('x'.repeat(21))).toBe(false);
    expect(validateNickname('<script>')).toBe(false);
  });
});

describe('демо-сервер', () => {
  it('регистрация, вход и выход', async () => {
    const b = new DemoOnlineBackend(mem(), { botDelayMs: 0 });
    await b.signUp('me@test.ru', 'secret1', 'Мирон');
    expect(await b.currentUserId()).toBeTruthy();
    expect((await b.myProfile()).nickname).toBe('Мирон');
    await b.signOut();
    expect(await b.currentUserId()).toBeNull();
    await expect(b.signIn('me@test.ru', 'wrong!!')).rejects.toBeInstanceOf(OnlineError);
    await b.signIn('ME@test.ru', 'secret1');
    expect(await b.currentUserId()).toBeTruthy();
  });

  it('ник и почта уникальны', async () => {
    const kv = mem();
    const b = new DemoOnlineBackend(kv, { botDelayMs: 0 });
    await b.signUp('a@a.ru', 'secret1', 'Первый');
    await b.signOut();
    await expect(b.signUp('a@a.ru', 'secret1', 'Другой')).rejects.toMatchObject({ code: 'already' });
    await expect(b.signUp('b@a.ru', 'secret1', 'первый')).rejects.toMatchObject({ code: 'nickname_taken' });
  });

  it('два игрока: заявка, принятие, переписка, непрочитанные', async () => {
    const kv = mem();
    const a = new DemoOnlineBackend(kv, { botDelayMs: 0 });
    await a.signUp('a@a.ru', 'secret1', 'Алиса');
    const aliceId = (await a.currentUserId())!;
    const aliceCode = (await a.myProfile()).friendCode;
    await a.signOut();
    await a.signUp('b@b.ru', 'secret1', 'Борис');
    const bobId = (await a.currentUserId())!;
    // Писать не-другу нельзя.
    await expect(a.sendMessage(aliceId, 'привет')).rejects.toMatchObject({ code: 'not_friends' });
    const found = await a.findPlayers(aliceCode);
    expect(found.map((p) => p.id)).toEqual([aliceId]);
    await a.requestFriend(aliceId);
    await expect(a.requestFriend(aliceId)).rejects.toMatchObject({ code: 'already' });
    await a.signOut();
    await a.signIn('a@a.ru', 'secret1');
    const req = (await a.friends()).find((f) => f.profile.id === bobId)!;
    expect(req.status).toBe('incoming');
    await a.acceptFriend(req.friendshipId);
    await a.sendMessage(bobId, 'Привет, Борис!');
    await a.signOut();
    await a.signIn('b@b.ru', 'secret1');
    expect((await a.unreadCounts())[aliceId]).toBe(1);
    const msgs = await a.messages(aliceId);
    expect(msgs.at(-1)!.body).toBe('Привет, Борис!');
    await a.markRead(aliceId);
    expect((await a.unreadCounts())[aliceId]).toBeUndefined();
  });

  it('облачный сейв сохраняется у аккаунта', async () => {
    const kv = mem();
    const b = new DemoOnlineBackend(kv, { botDelayMs: 0 });
    await b.signUp('c@c.ru', 'secret1', 'Сейвер');
    expect(await b.pullSave()).toBeNull();
    await b.pushSave({ json: '{"version":6}', version: 6, updatedAt: 123 });
    const again = new DemoOnlineBackend(kv);
    expect((await again.pullSave())!.updatedAt).toBe(123);
  });

  it('новичка встречает бот-друг и заявка от второго бота', async () => {
    const b = new DemoOnlineBackend(mem(), { botDelayMs: 0 });
    await b.signUp('d@d.ru', 'secret1', 'Новичок');
    const fr = await b.friends();
    expect(fr.some((f) => f.status === 'accepted' && f.profile.nickname === 'Агата')).toBe(true);
    expect(fr.some((f) => f.status === 'incoming')).toBe(true);
    await b.touch();
    const agata = fr.find((f) => f.profile.nickname === 'Агата')!;
    expect(isOnline((await b.friends()).find((f) => f.friendshipId === agata.friendshipId)!.profile)).toBe(
      true,
    );
  });
});
