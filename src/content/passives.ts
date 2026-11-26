import type { PassiveSpec } from '@/core/content';

/**
 * Пассивные способности героев: работают всегда, без нажатия. 12 видов, у каждого героя свой —
 * по характеру и роли. value — сила (доля), остальное — параметры вида.
 */
export type PassiveKind = PassiveSpec['kind'];
// +value урона, пока своё HP ниже 50%

export interface PassiveDef extends PassiveSpec {
  name: { ru: string; en: string };
  desc: { ru: string; en: string };
}

const P = (
  kind: PassiveKind,
  ru: [string, string],
  en: [string, string],
  extra: Partial<PassiveDef> = {},
): PassiveDef => ({
  kind,
  ...extra,
  name: { ru: ru[0], en: en[0] },
  desc: { ru: ru[1], en: en[1] },
});

export const PASSIVES: Record<string, PassiveDef> = {
  // ——— Орден ———
  ardan: P(
    'guardian',
    ['Щит рассвета', 'Пока Ардан на ногах, союзники получают на 10% меньше урона.'],
    ['Dawn Shield', 'While Ardan stands, allies take 10% less damage.'],
    { value: 0.1 },
  ),
  selesta: P(
    'healBoost',
    ['Слепая вера', 'Лечение Селесты сильнее на 20%.'],
    ['Blind Faith', 'Celeste’s healing is 20% stronger.'],
    { value: 0.2 },
  ),
  mirna: P(
    'vsDebuffed',
    ['Рыбацкий глаз', '+20% урона по ослабленным целям.'],
    ['Fisher’s Eye', '+20% damage to debuffed targets.'],
    { value: 0.2 },
  ),
  rikht: P(
    'desperate',
    ['Упрямство', '+20% урона, пока Рихт ранен больше чем наполовину.'],
    ['Stubborn', '+20% damage while Rikht is below half HP.'],
    { value: 0.2 },
  ),
  valeria: P(
    'onHit',
    ['Кара', 'Обычная атака с шансом 30% снижает атаку цели.'],
    ['Smite', 'Basic attack has a 30% chance to lower the target’s attack.'],
    { status: 'atkDown', turns: 2, chance: 0.3 },
  ),
  tobias: P(
    'firstStrike',
    ['Взведённый арбалет', 'Начинает бой с 40% шкалы хода.'],
    ['Cocked Crossbow', 'Starts the battle with 40% turn meter.'],
    { value: 0.4 },
  ),
  aurel: P(
    'healBoost',
    ['Свет полудня', 'Лечение Аурэля сильнее на 25%.'],
    ['Noon Light', 'Aurel’s healing is 25% stronger.'],
    { value: 0.25 },
  ),
  solarion: P(
    'execute',
    ['Закат империи', '+30% урона по целям с HP ниже 35%.'],
    ['Empire’s Sunset', '+30% damage to targets below 35% HP.'],
    { value: 0.3 },
  ),
  ilia: P(
    'startStatus',
    ['Рассвет для всех', 'В начале боя все союзники получают усиление защиты.'],
    ['Dawn for All', 'At the start of battle all allies gain defense up.'],
    { status: 'defUp', turns: 2, allies: true },
  ),
  marina: P(
    'healBoost',
    ['Жемчужный свет', 'Лечение Марины сильнее на 15%.'],
    ['Pearl Light', 'Marina’s healing is 15% stronger.'],
    { value: 0.15 },
  ),
  // ——— Вечнолист ———
  liel: P(
    'onHit',
    ['Шип в стреле', 'Обычная атака с шансом 35% отравляет.'],
    ['Thorned Arrow', 'Basic attack has a 35% chance to poison.'],
    { status: 'poison', turns: 2, chance: 0.35 },
  ),
  saira: P(
    'firstStrike',
    ['Попутный ветер', 'Начинает бой с 35% шкалы хода.'],
    ['Tailwind', 'Starts the battle with 35% turn meter.'],
    { value: 0.35 },
  ),
  tirn: P(
    'thorns',
    ['Колючая кора', 'Возвращает 15% полученного урона.'],
    ['Thorny Bark', 'Returns 15% of damage taken.'],
    { value: 0.15 },
  ),
  ivy: P('healBoost', ['Роса', 'Лечение Ивушки сильнее на 15%.'], ['Dew', 'Ivy’s healing is 15% stronger.'], {
    value: 0.15,
  }),
  olkha: P(
    'lastStand',
    ['Медвежья ярость', 'Когда HP впервые падает ниже 35% — щит 25% и усиление атаки.'],
    ['Bear Fury', 'When HP first drops below 35% — a 25% shield and attack up.'],
    { value: 0.25 },
  ),
  fyu: P(
    'startStatus',
    ['Танец светлячков', 'В начале боя все союзники ускоряются.'],
    ['Firefly Dance', 'At the start of battle all allies gain haste.'],
    { status: 'haste', turns: 1, allies: true },
  ),
  iren: P(
    'vsDebuffed',
    ['Звёздная метка', '+20% урона по ослабленным целям.'],
    ['Star Mark', '+20% damage to debuffed targets.'],
    { value: 0.2 },
  ),
  verdis: P(
    'healBoost',
    ['Корни мира', 'Лечение Вердис сильнее на 25%.'],
    ['World Roots', 'Verdis’s healing is 25% stronger.'],
    { value: 0.25 },
  ),
  taira: P(
    'killRush',
    ['Охота прайда', 'За добивание — 50% шкалы хода.'],
    ['Pride Hunt', 'On a kill — 50% turn meter.'],
    { value: 0.5 },
  ),
  // ——— Тризна ———
  veila: P(
    'onHit',
    ['Песнь утопленницы', 'Обычная атака с шансом 30% замедляет.'],
    ['Drowned Song', 'Basic attack has a 30% chance to slow.'],
    { status: 'slow', turns: 2, chance: 0.3 },
  ),
  necro: P(
    'lifesteal',
    ['Пепел к пеплу', 'Лечит себя на 15% нанесённого урона.'],
    ['Ash to Ash', 'Heals himself for 15% of damage dealt.'],
    { value: 0.15 },
  ),
  karr: P(
    'vsDebuffed',
    ['Мор', '+25% урона по ослабленным целям.'],
    ['Pestilence', '+25% damage to debuffed targets.'],
    { value: 0.25 },
  ),
  grav: P(
    'lastStand',
    ['Кости не сдаются', 'Когда HP впервые падает ниже 35% — щит 30%.'],
    ['Bones Don’t Yield', 'When HP first drops below 35% — a 30% shield.'],
    { value: 0.3 },
  ),
  ragna: P(
    'lifesteal',
    ['Клятва мёртвой', 'Лечит себя на 15% нанесённого урона.'],
    ['Oath of the Dead', 'Heals herself for 15% of damage dealt.'],
    { value: 0.15 },
  ),
  whisper: P(
    'execute',
    ['Удар из тени', '+30% урона по целям с HP ниже 35%.'],
    ['Strike from Shadow', '+30% damage to targets below 35% HP.'],
    { value: 0.3 },
  ),
  morok: P(
    'startStatus',
    ['Маскарад', 'В начале боя все союзники усиливают атаку.'],
    ['Masquerade', 'At the start of battle all allies gain attack up.'],
    { status: 'atkUp', turns: 2, allies: true },
  ),
  thalassa: P(
    'guardian',
    ['Прилив хранит', 'Пока Таласса жива, союзники получают на 8% меньше урона.'],
    ['The Tide Protects', 'While Thalassa lives, allies take 8% less damage.'],
    { value: 0.08 },
  ),
  elvira: P(
    'lifesteal',
    ['Жажда', 'Лечит себя на 20% нанесённого урона.'],
    ['Thirst', 'Heals herself for 20% of damage dealt.'],
    { value: 0.2 },
  ),
  // ——— Бездна ———
  demon: P(
    'desperate',
    ['Ярость князя', '+25% урона, пока HP ниже половины.'],
    ['Prince’s Rage', '+25% damage while below half HP.'],
    { value: 0.25 },
  ),
  sirra: P(
    'onHit',
    ['Огненный хлыст', 'Обычная атака с шансом 35% поджигает (яд).'],
    ['Fire Whip', 'Basic attack has a 35% chance to set ablaze (poison).'],
    { status: 'poison', turns: 2, chance: 0.35 },
  ),
  azgar: P(
    'vsDebuffed',
    ['Око Бездны', '+20% урона по ослабленным целям.'],
    ['Eye of the Abyss', '+20% damage to debuffed targets.'],
    { value: 0.2 },
  ),
  chirk: P(
    'firstStrike',
    ['Шустрый бес', 'Начинает бой с 45% шкалы хода.'],
    ['Nimble Imp', 'Starts the battle with 45% turn meter.'],
    { value: 0.45 },
  ),
  ifrita: P(
    'startStatus',
    ['Огонь в крови', 'В начале боя все союзники усиливают атаку.'],
    ['Fire in the Blood', 'At the start of battle all allies gain attack up.'],
    { status: 'atkUp', turns: 2, allies: true },
  ),
  grom: P(
    'thorns',
    ['Шкура огра', 'Возвращает 15% полученного урона.'],
    ['Ogre Hide', 'Returns 15% of damage taken.'],
    { value: 0.15 },
  ),
  nocta: P(
    'execute',
    ['Чёрные раны', '+30% урона по целям с HP ниже 35%.'],
    ['Black Wounds', '+30% damage to targets below 35% HP.'],
    { value: 0.3 },
  ),
  skarn: P(
    'killRush',
    ['Голос четырёх', 'За добивание — 40% шкалы хода.'],
    ['Voice of Four', 'On a kill — 40% turn meter.'],
    { value: 0.4 },
  ),
  lilith: P(
    'onHit',
    ['Сладкий яд', 'Обычная атака с шансом 35% снижает атаку цели.'],
    ['Sweet Poison', 'Basic attack has a 35% chance to lower the target’s attack.'],
    { status: 'atkDown', turns: 2, chance: 0.35 },
  ),
  // ——— Горн ———
  torvald: P(
    'guardian',
    ['Печать горна', 'Пока Торвальд стоит, союзники получают на 10% меньше урона.'],
    ['Forge Seal', 'While Torvald stands, allies take 10% less damage.'],
    { value: 0.1 },
  ),
  grimsa: P(
    'execute',
    ['Калибр побольше', '+25% урона по целям с HP ниже 35%.'],
    ['Bigger Caliber', '+25% damage to targets below 35% HP.'],
    { value: 0.25 },
  ),
  dwarf: P(
    'thorns',
    ['Шипованный щит', 'Возвращает 20% полученного урона.'],
    ['Spiked Shield', 'Returns 20% of damage taken.'],
    { value: 0.2 },
  ),
  dorn: P(
    'healBoost',
    ['Крепкий эль', 'Лечение Дорна сильнее на 20%.'],
    ['Strong Ale', 'Dorn’s healing is 20% stronger.'],
    { value: 0.2 },
  ),
  sigrun: P(
    'lastStand',
    ['Не в этот раз', 'Когда HP впервые падает ниже 35% — щит 25%.'],
    ['Not This Time', 'When HP first drops below 35% — a 25% shield.'],
    { value: 0.25 },
  ),
  vint: P(
    'firstStrike',
    ['Разогретый котёл', 'Начинает бой с 30% шкалы хода.'],
    ['Warm Boiler', 'Starts the battle with 30% turn meter.'],
    { value: 0.3 },
  ),
  gorran: P(
    'guardian',
    ['Сердце горы', 'Пока Горран стоит, союзники получают на 12% меньше урона.'],
    ['Mountain’s Heart', 'While Gorran stands, allies take 12% less damage.'],
    { value: 0.12 },
  ),
  aerin: P(
    'desperate',
    ['Работа есть работа', '+20% урона, пока HP ниже половины.'],
    ['A Job’s a Job', '+20% damage while below half HP.'],
    { value: 0.2 },
  ),
};

/** Пассив героя по id героя или его арту (у части героев они различаются). */
export function passiveOf(heroId: string, art?: string): PassiveDef | undefined {
  return PASSIVES[heroId] ?? (art ? PASSIVES[art] : undefined);
}
