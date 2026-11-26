/**
 * Сюжет кампании «Каэлмор: Осколки зари».
 *
 * Сто лет назад Солнце раскололось. Его осколки — осколки зари — упали на землю, и с тех пор
 * люди живут у костров, зажжённых от этих осколков. Всё, что остаётся без света, съедает Мгла.
 * Хранитель — тот, кто может держать осколок голыми руками и звать на его свет героев прошлого.
 *
 * Главная тайна, которая раскрывается по главам: Солнце не раскололось само. Его разбили,
 * чтобы спрятать Каэлмор от Пожирателя звёзд. Мгла — его щупальца: она собирает осколки,
 * а кто-то в небе хочет собрать Солнце обратно — и тем самым зажечь маяк для Пожирателя.
 *
 * Сцены: intro — перед первым этапом главы, boss — перед боем с боссом (первая попытка),
 * outro — после первой победы над боссом.
 */
import type { SceneKey } from '@/render/pixi/battle/background';

export type StorySpeaker =
  | 'narrator'
  | 'warden'
  | 'selesta'
  | 'rikht'
  | 'veila'
  | 'abbess'
  | 'kharras'
  | 'emberlord'
  | 'torvald'
  | 'morok'
  | 'aurel'
  | 'nocta'
  | 'eclipse_queen'
  | 'solarion'
  | 'storm_king'
  | 'valeria'
  | 'star_devourer'
  | 'void_herald'
  | 'colossus';

export interface StoryLine {
  who: StorySpeaker;
  ru: string;
  en: string;
}

export interface StoryScene {
  id: string;
  chapter: number;
  trigger: 'intro' | 'boss' | 'outro';
  /** Этап, к которому привязана сцена. */
  stage: string;
  scene: SceneKey | 'rift';
  title: { ru: string; en: string };
  lines: StoryLine[];
}

const L = (who: StorySpeaker, ru: string, en: string): StoryLine => ({ who, ru, en });

export const STORY: StoryScene[] = [
  // ═════════════ Глава 1. Мглистые пустоши ═════════════
  {
    id: 'c1-intro',
    chapter: 1,
    trigger: 'intro',
    stage: '1-1',
    scene: 'mist',
    title: { ru: 'Пролог. Тот, кого не жжёт свет', en: 'Prologue. The One the Light Does Not Burn' },
    lines: [
      L(
        'narrator',
        'Сто лет назад Солнце раскололось. Его осколки упали на землю, а из трещины в небе пришла Мгла.',
        'A hundred years ago the Sun shattered. Its shards fell to the earth, and through the crack in the sky came the Mist.',
      ),
      L(
        'narrator',
        'С тех пор люди живут у костров, зажжённых от осколков зари. Всё, что остаётся во тьме, Мгла съедает без следа.',
        'Since then people have lived around fires lit from dawn shards. Whatever is left in the dark, the Mist devours without a trace.',
      ),
      L(
        'selesta',
        'Ты держишь осколок голыми руками — и он не жжёт тебя. Я слышу это: твоя кожа поёт, как струна.',
        'You hold a shard with bare hands — and it does not burn you. I can hear it: your skin sings like a string.',
      ),
      L(
        'selesta',
        'Так звучат только Хранители. Последнего из них Мгла забрала, когда я была ребёнком.',
        'Only Wardens sound like that. The Mist took the last of them when I was a child.',
      ),
      L(
        'rikht',
        'Хранитель? Настоящий? Тогда мы наконец можем дать сдачи! Я… я понесу ваш щит. Или ваш мешок. Что угодно!',
        'A Warden? A real one? Then we can finally hit back! I… I’ll carry your shield. Or your bag. Anything!',
      ),
      L(
        'selesta',
        'Мгла стала смелее, Хранитель. Раньше она обходила костры стороной, а теперь гасит их. Что-то её зовёт.',
        'The Mist has grown bolder, Warden. It used to shy away from the fires; now it puts them out. Something is calling it.',
      ),
      L(
        'selesta',
        'Пройди за Врата Мглы. Узнай, что там. А свет осколков позовёт к тебе тех, кто ещё помнит, как сражаться.',
        'Go beyond the Gates of Mist. Learn what waits there. The light of the shards will call to you those who still remember how to fight.',
      ),
    ],
  },
  {
    id: 'c1-boss',
    chapter: 1,
    trigger: 'boss',
    stage: '1-10',
    scene: 'mist',
    title: { ru: 'Сердце Колосса', en: 'The Colossus’s Heart' },
    lines: [
      L(
        'narrator',
        'В самом сердце пустошей Мгла сгустилась в великана из камня и тумана. В его груди горит свет.',
        'In the heart of the wastes the Mist has thickened into a giant of stone and fog. A light burns in its chest.',
      ),
      L(
        'rikht',
        'Это… осколок? У Мглы внутри осколок зари?!',
        'Is that… a shard? The Mist has a dawn shard inside it?!',
      ),
      L(
        'selesta',
        'Не может быть. Мгла гасит свет, а не носит его в себе. Если только она не собирает осколки… для кого-то.',
        'That cannot be. The Mist puts out light, it does not carry it. Unless it is gathering the shards… for someone.',
      ),
      L(
        'colossus',
        'СВЕТ… К СВЕТУ… СОБРАТЬ… ВЕРНУТЬ… ГЛАЗУ…',
        'LIGHT… TO THE LIGHT… GATHER… RETURN… TO THE EYE…',
      ),
      L(
        'selesta',
        'Хранитель, вырви этот осколок из его груди. Что бы ни шептала эта тварь — она шепчет чужими словами.',
        'Warden, tear that shard from its chest. Whatever this thing whispers, it speaks with someone else’s words.',
      ),
    ],
  },
  {
    id: 'c1-outro',
    chapter: 1,
    trigger: 'outro',
    stage: '1-10',
    scene: 'mist',
    title: { ru: 'Видение под водой', en: 'A Vision Beneath the Water' },
    lines: [
      L(
        'narrator',
        'Колосс рассыпается. Осколок из его груди ложится в ладонь Хранителя — и в нём, как в окне, проступает видение.',
        'The Colossus crumbles. The shard from its chest settles into the Warden’s palm — and in it, as in a window, a vision appears.',
      ),
      L(
        'narrator',
        'Затонувший собор. Тусклый фонарь. Женщина в белом молится под толщей воды, прижимая к груди огромный осколок.',
        'A sunken cathedral. A dim lantern. A woman in white prays beneath the depths, a great shard pressed to her chest.',
      ),
      L(
        'selesta',
        '…Я знаю этот голос. Это настоятельница Ирма. Моя наставница.',
        '…I know that voice. That is Abbess Irma. My teacher.',
      ),
      L(
        'selesta',
        'Тридцать лет назад собор ушёл под воду вместе с ней. Мы думали, это было наводнение.',
        'Thirty years ago the cathedral sank, and she went with it. We thought it was a flood.',
      ),
      L(
        'rikht',
        'А если не наводнение? Вдруг она утопила собор нарочно — чтобы спрятать этот осколок?',
        'And if it wasn’t a flood? What if she drowned the cathedral on purpose — to hide that shard?',
      ),
      L(
        'selesta',
        'Тогда нам нужно узнать, от кого она его прятала. Идём к собору, Хранитель.',
        'Then we must learn whom she was hiding it from. To the cathedral, Warden.',
      ),
    ],
  },

  // ═════════════ Глава 2. Затонувший собор ═════════════
  {
    id: 'c2-intro',
    chapter: 2,
    trigger: 'intro',
    stage: '2-1',
    scene: 'cathedral',
    title: { ru: 'Песня утонувших', en: 'The Song of the Drowned' },
    lines: [
      L(
        'narrator',
        'Собор стоит на дне холодного озера. Сквозь окно-розу падает зеленоватый свет, в нефах медленно плавают угри.',
        'The cathedral stands at the bottom of a cold lake. Greenish light falls through the rose window; eels drift slowly through the naves.',
      ),
      L(
        'veila',
        'Не бойтесь воды, живые. Бойтесь тишины. Здесь каждый утопленник ещё помнит, как его звали.',
        'Do not fear the water, living ones. Fear the silence. Every drowned soul here still remembers its name.',
      ),
      L(
        'veila',
        'Я пою им, чтобы они не забыли. Настоятельнице тоже пою. Но она давно не отвечает.',
        'I sing to them so they do not forget. I sing to the Abbess too. But she stopped answering long ago.',
      ),
      L('selesta', 'Вейла… ты знала Ирму?', 'Veila… you knew Irma?'),
      L(
        'veila',
        'Я была первой, кто утонул вместе с ней. Добровольно. Мы держали свет под водой, чтобы небо его не увидело.',
        'I was the first to drown with her. Willingly. We held the light beneath the water so the sky would not see it.',
      ),
      L(
        'veila',
        'Но вода тяжела, а сто лет — долгий срок. Её разум уходит. Идите. Я буду петь вам в спину.',
        'But water is heavy, and a hundred years is long. Her mind is fading. Go. I will sing at your backs.',
      ),
    ],
  },
  {
    id: 'c2-boss',
    chapter: 2,
    trigger: 'boss',
    stage: '2-10',
    scene: 'cathedral',
    title: { ru: 'Утопленная Настоятельница', en: 'The Drowned Abbess' },
    lines: [
      L(
        'abbess',
        'Кто несёт свет в мою обитель? Погасите. ПОГАСИТЕ. Он увидит.',
        'Who brings light into my sanctuary? Put it out. PUT IT OUT. He will see.',
      ),
      L(
        'selesta',
        'Матушка Ирма, это я. Селеста. Ты учила меня читать молитвы на ощупь — помнишь?',
        'Mother Irma, it is me. Celeste. You taught me to read prayers by touch — remember?',
      ),
      L(
        'abbess',
        'Я помню только глаз. Огромный глаз за краем неба. Пока свет под водой — он слеп. Уходите, дети. Или станьте водой.',
        'I remember only the eye. A vast eye beyond the edge of the sky. While the light lies under water, it is blind. Leave, children. Or become water.',
      ),
      L(
        'selesta',
        'Хранитель… она не слышит. Освободи её. Пожалуйста, бережно.',
        'Warden… she cannot hear. Free her. Please — gently.',
      ),
    ],
  },
  {
    id: 'c2-outro',
    chapter: 2,
    trigger: 'outro',
    stage: '2-10',
    scene: 'cathedral',
    title: { ru: 'Солнце не раскололось', en: 'The Sun Did Not Shatter' },
    lines: [
      L(
        'abbess',
        'Селеста… девочка моя. Ты выросла. И ты… ослепла. Как я велела тебе в ту ночь.',
        'Celeste… my girl. You grew up. And you… went blind. As I told you to, that night.',
      ),
      L(
        'selesta',
        'Я посмотрела в небо, когда оно треснуло. И увидела там что-то. Ты сказала — забудь.',
        'I looked at the sky when it cracked. And I saw something there. You told me to forget.',
      ),
      L(
        'abbess',
        'Нельзя забыть Пожирателя звёзд. Можно только спрятаться от него. Слушайте, пока вода меня отпускает.',
        'One cannot forget the Star Devourer. One can only hide from it. Listen, while the water still lets me go.',
      ),
      L(
        'abbess',
        'Солнце не раскололось само. Его разбили. Мы разбили. Целое Солнце светит слишком ярко — его видно из пустоты за небом.',
        'The Sun did not shatter on its own. It was broken. We broke it. A whole Sun shines too brightly — it can be seen from the void beyond the sky.',
      ),
      L(
        'abbess',
        'А Мгла — его щупальца. Она собирает осколки. Кто-то хочет собрать Солнце обратно… Ищите Горнило. Демоны куют ключ.',
        'And the Mist is its tendrils. It gathers the shards. Someone wants to make the Sun whole again… Seek the Crucible. The demons are forging a key.',
      ),
      L(
        'narrator',
        'Настоятельница улыбается — впервые за сто лет — и растворяется в воде, как соль. Над озером пахнет весной.',
        'The Abbess smiles — for the first time in a hundred years — and dissolves into the water like salt. Above the lake, the air smells of spring.',
      ),
    ],
  },

  // ═════════════ Глава 3. Горнило Бездны ═════════════
  {
    id: 'c3-intro',
    chapter: 3,
    trigger: 'intro',
    stage: '3-1',
    scene: 'forge',
    title: { ru: 'Князь, который ушёл', en: 'The Prince Who Walked Away' },
    lines: [
      L(
        'narrator',
        'Горнило Бездны дышит жаром. По земле текут лавовые реки, и в каждой кузне стучат молоты — днём и ночью.',
        'The Crucible of the Abyss breathes heat. Rivers of lava flow across the ground, and in every forge the hammers ring — day and night.',
      ),
      L(
        'kharras',
        'Не смотри на меня так, жрица. Да, я демон. Да, это мой дом. Я ушёл отсюда, когда понял, что Мгла сожрёт и его.',
        'Don’t look at me like that, priestess. Yes, I’m a demon. Yes, this is my home. I left when I understood the Mist would devour it too.',
      ),
      L(
        'kharras',
        'Мой отец, Владыка Углей, уже год не выходит из главной кузни. Он куёт что-то из осколков. Что-то, чего боится даже Бездна.',
        'My father, the Lord of Embers, hasn’t left the great forge in a year. He is forging something from shards. Something even the Abyss fears.',
      ),
      L(
        'torvald',
        'Я пойду с вами. Сто лет назад я выковал первую печать против Мглы. Если демоны тронули мою работу — я хочу это видеть своими глазами.',
        'I’m coming with you. A hundred years ago I forged the first seal against the Mist. If the demons touched my work, I want to see it with my own eyes.',
      ),
    ],
  },
  {
    id: 'c3-boss',
    chapter: 3,
    trigger: 'boss',
    stage: '3-10',
    scene: 'forge',
    title: { ru: 'Владыка в цепях', en: 'The Lord in Chains' },
    lines: [
      L(
        'torvald',
        'Клянусь горном… Это моя руна. Моя печать. Только вывернутая наизнанку — она не запирает, а отпирает.',
        'By the forge… That’s my rune. My seal. Only turned inside out — it doesn’t lock, it unlocks.',
      ),
      L(
        'emberlord',
        'Он приходит каждую ночь, сын. Во сне. Огромный. Тёплый. Он обещает: соберите Солнце — и Мгла уйдёт навсегда.',
        'He comes every night, son. In my dreams. Vast. Warm. He promises: make the Sun whole, and the Mist will leave forever.',
      ),
      L(
        'kharras',
        'Отец, это ложь! Посмотри на свои руки — ты прикован к наковальне собственными цепями!',
        'Father, it’s a lie! Look at your hands — you are chained to the anvil with your own chains!',
      ),
      L(
        'emberlord',
        'Цепи — чтобы не уйти, пока работа не закончена. Уйди с дороги, Кхаррас. Или сгори вместе с гостями.',
        'The chains are so I can’t leave until the work is done. Step aside, Kharras. Or burn with your guests.',
      ),
    ],
  },
  {
    id: 'c3-outro',
    chapter: 3,
    trigger: 'outro',
    stage: '3-10',
    scene: 'forge',
    title: { ru: 'Ключ увезли на север', en: 'The Key Was Taken North' },
    lines: [
      L(
        'narrator',
        'Цепи лопаются. Владыка Углей падает на колени, и впервые за год в его глазах — не пламя, а усталость.',
        'The chains snap. The Lord of Embers falls to his knees, and for the first time in a year there is no flame in his eyes — only weariness.',
      ),
      L(
        'emberlord',
        'Ключ… Я выковал его. Корону из семи осколков. Её забрали неделю назад. Люди в небесных доспехах. С молниями в руках.',
        'The key… I forged it. A crown of seven shards. They took it a week ago. Men in sky-armor. With lightning in their hands.',
      ),
      L(
        'emberlord',
        'Они увезли её на север, за край света. Туда, где солнце застыло и не может ни взойти, ни сесть.',
        'They carried it north, past the edge of the world. To where the sun has frozen and can neither rise nor set.',
      ),
      L(
        'torvald',
        'Моя печать держит Мглу снаружи. А этот ключ откроет её изнутри. Если корону наденут на собранное Солнце…',
        'My seal keeps the Mist outside. That key will open it from within. If the crown is set upon a reassembled Sun…',
      ),
      L(
        'kharras',
        'Тогда и мне есть за что драться. Веди, Хранитель. Я задолжал этому миру за отца.',
        'Then I have something to fight for too. Lead on, Warden. I owe this world for my father.',
      ),
    ],
  },

  // ═════════════ Глава 4. Сумрачный предел ═════════════
  {
    id: 'c4-intro',
    chapter: 4,
    trigger: 'intro',
    stage: '4-1',
    scene: 'dusk',
    title: { ru: 'Край, где не бывает утра', en: 'The Edge Where Morning Never Comes' },
    lines: [
      L(
        'narrator',
        'На краю мира солнце висит в небе чёрным диском, окружённым огненным кольцом. Затмение длится сто лет.',
        'At the edge of the world the sun hangs in the sky as a black disk ringed with fire. The eclipse has lasted a hundred years.',
      ),
      L(
        'morok',
        'Добро пожаловать в Сумрачный предел! Здесь утро не наступает уже сто лет. И знаете — никто не жалуется.',
        'Welcome to the Twilight Reach! Morning hasn’t come here in a hundred years. And you know what — nobody complains.',
      ),
      L(
        'aurel',
        'Не слушайте шута. Я храню последний полдень мира в этой лампе. Знаете, зачем? Чтобы помнить, от чего мы отказались.',
        'Don’t listen to the jester. I keep the world’s last noon in this lamp. Do you know why? To remember what we gave up.',
      ),
      L(
        'nocta',
        'Королева Затмения держит небо закрытым. Мы — её стража. Были. Пока не поняли, что люди с молниями уже прошли мимо нас.',
        'The Eclipse Queen keeps the sky closed. We are her guard. We were. Until we realized the men with lightning had already slipped past us.',
      ),
    ],
  },
  {
    id: 'c4-boss',
    chapter: 4,
    trigger: 'boss',
    stage: '4-10',
    scene: 'dusk',
    title: { ru: 'Та, что разбила Солнце', en: 'She Who Broke the Sun' },
    lines: [
      L(
        'eclipse_queen',
        'Ещё один огонёк пришёл к моему трону. Ты несёшь свет, Хранитель. Ты не понимаешь, что приводишь Его к нам.',
        'Another little flame has come to my throne. You carry light, Warden. You don’t understand that you are leading Him to us.',
      ),
      L(
        'selesta',
        'Это ты. Это ты разбила Солнце сто лет назад.',
        'It was you. You broke the Sun a hundred years ago.',
      ),
      L(
        'eclipse_queen',
        'Я его дочь. Я любила его больше всех. И я ударила первой, когда увидела, кто смотрит на нас из пустоты. Потом закрыла небо собой.',
        'I am its daughter. I loved it more than anyone. And I struck first when I saw who was watching us from the void. Then I closed the sky with my own body.',
      ),
      L(
        'eclipse_queen',
        'Свет — это приманка. Отдай мне свои осколки, Хранитель, и живи в темноте. Живи.',
        'Light is bait. Give me your shards, Warden, and live in darkness. Live.',
      ),
    ],
  },
  {
    id: 'c4-outro',
    chapter: 4,
    trigger: 'outro',
    stage: '4-10',
    scene: 'dusk',
    title: { ru: 'Тень не удержится', en: 'The Shadow Will Not Hold' },
    lines: [
      L(
        'eclipse_queen',
        'Ты сильнее, чем я думала. Значит, у Каэлмора ещё есть шанс. Слушай внимательно — у меня мало времени.',
        'You are stronger than I thought. Then Kaelmor still has a chance. Listen closely — I have little time.',
      ),
      L(
        'eclipse_queen',
        'Король Бурь собирает Солнце обратно в своей небесной цитадели. Он верит, что целое Солнце сожжёт Мглу. Он хочет спасти вас.',
        'The Storm King is reassembling the Sun in his sky citadel. He believes a whole Sun will burn the Mist away. He wants to save you.',
      ),
      L(
        'eclipse_queen',
        'Но когда Солнце засияет целым, Пожиратель увидит Каэлмор, как маяк в ночи. И придёт.',
        'But when the Sun shines whole, the Devourer will see Kaelmor like a beacon in the night. And it will come.',
      ),
      L(
        'narrator',
        'Огненное кольцо вокруг чёрного диска дрожит. Впервые за сто лет над Сумрачным пределом сереет край неба.',
        'The ring of fire around the black disk trembles. For the first time in a hundred years, the edge of the sky above the Twilight Reach turns grey.',
      ),
      L(
        'eclipse_queen',
        'Я больше не удержу тень. Иди наверх, Хранитель. Останови его — даже если он прав во всём, кроме одного.',
        'I can no longer hold the shadow. Go up, Warden. Stop him — even if he is right about everything but one thing.',
      ),
    ],
  },

  // ═════════════ Глава 5. Небесная цитадель ═════════════
  {
    id: 'c5-intro',
    chapter: 5,
    trigger: 'intro',
    stage: '5-1',
    scene: 'sky',
    title: { ru: 'Песня собранного Солнца', en: 'The Song of the Gathered Sun' },
    lines: [
      L(
        'narrator',
        'Цитадель Короля Бурь парит над облаками. По облачным мостам ходят часовые, и в каждом шпиле гудят молнии.',
        'The Storm King’s citadel floats above the clouds. Sentries walk the cloud bridges, and lightning hums in every spire.',
      ),
      L(
        'selesta',
        'Я слышу его. Солнце. Оно поёт, как колокол, у которого почти не осталось трещин. Оно почти целое.',
        'I can hear it. The Sun. It sings like a bell with almost no cracks left. It is almost whole.',
      ),
      L(
        'solarion',
        'Когда-то я был его императором. Я носил последний луч в своей короне. Я пойду с вами — и я хочу, чтобы Король Бурь посмотрел мне в глаза.',
        'Once I was its emperor. I wore its last ray in my crown. I will go with you — and I want the Storm King to look me in the eye.',
      ),
      L(
        'valeria',
        'Орден поклялся защищать свет. Никто не говорил нам, что однажды придётся защищать тьму. Но если так нужно — значит, так.',
        'The Order swore to protect the light. No one told us that one day we would have to protect the dark. But if that is what it takes — so be it.',
      ),
    ],
  },
  {
    id: 'c5-boss',
    chapter: 5,
    trigger: 'boss',
    stage: '5-10',
    scene: 'sky',
    title: { ru: 'Король Бурь', en: 'The Storm King' },
    lines: [
      L(
        'storm_king',
        'Соларион. Значит, и ты пришёл мне мешать. Сто лет мы живём в темноте из страха перед тем, чего никто не видел!',
        'Solarion. So you too have come to stop me. For a hundred years we have lived in the dark, afraid of something no one has seen!',
      ),
      L(
        'selesta',
        'Я видела. Я ослепла, потому что видела.',
        'I have seen it. I went blind because I saw it.',
      ),
      L(
        'storm_king',
        'Тогда пусть приходит! Я верну Каэлмору свет и встречу Пожирателя лицом к лицу, с молнией в руке. Лучше умереть при свете, чем гнить во тьме!',
        'Then let it come! I will give Kaelmor back its light and meet the Devourer face to face, lightning in hand. Better to die in the light than rot in the dark!',
      ),
      L(
        'solarion',
        'Ты не умрёшь один, глупец. Ты умрёшь вместе со всеми, кто живёт у костров. Хранитель — сними с него корону.',
        'You will not die alone, fool. You will die along with everyone who lives by the fires. Warden — take the crown from him.',
      ),
    ],
  },
  {
    id: 'c5-outro',
    chapter: 5,
    trigger: 'outro',
    stage: '5-10',
    scene: 'sky',
    title: { ru: 'Две луны', en: 'Two Moons' },
    lines: [
      L(
        'narrator',
        'Король Бурь падает, и корона из семи осколков катится по мраморному полу. На одно мгновение она вспыхивает — ярко, как полдень.',
        'The Storm King falls, and the crown of seven shards rolls across the marble floor. For a single moment it blazes — bright as noon.',
      ),
      L('narrator', 'Одного мгновения хватило.', 'One moment was enough.'),
      L('star_devourer', '…ВИЖУ…', '…I SEE…'),
      L(
        'selesta',
        'Он нас увидел. Хранитель… небо. Посмотри на небо — и расскажи мне, что там.',
        'It has seen us. Warden… the sky. Look at the sky and tell me what is there.',
      ),
      L(
        'narrator',
        'В ту ночь над Каэлмором впервые за сто лет взошли две луны. Одна из них моргнула.',
        'That night, for the first time in a hundred years, two moons rose over Kaelmor. One of them blinked.',
      ),
      L(
        'narrator',
        'Из трещины в небе на землю упали Стражи Разлома — каменные великаны с огнём стихий в груди. А Пожиратель звёзд начал свой путь к миру.',
        'From the crack in the sky the Rift Wardens fell to earth — stone giants with elemental fire in their chests. And the Star Devourer began its journey toward the world.',
      ),
      L(
        'storm_king',
        'Я… хотел света. Простите меня. Если сможете — закройте трещину. Путь в Разлом лежит за моим троном.',
        'I… wanted light. Forgive me. If you can — close the crack. The way into the Rift lies behind my throne.',
      ),
    ],
  },

  // ═════════════ Глава 6. Звёздный разлом ═════════════
  {
    id: 'c6-intro',
    chapter: 6,
    trigger: 'intro',
    stage: '6-1',
    scene: 'rift',
    title: { ru: 'Внутри трещины', en: 'Inside the Crack' },
    lines: [
      L(
        'narrator',
        'За троном Короля Бурь небо разорвано, как старая ткань. Внутри — пустота, полная мёртвых звёзд и шипастых теней.',
        'Behind the Storm King’s throne the sky is torn like old cloth. Within lies a void full of dead stars and thorned shadows.',
      ),
      L(
        'selesta',
        'Здесь всё отражает удар. Твари Разлома сотканы из чужой боли — бей их, и боль вернётся к тебе. Будь осторожен.',
        'Everything here strikes back. The Rift’s creatures are woven from borrowed pain — strike them, and the pain returns to you. Be careful.',
      ),
      L(
        'kharras',
        'Отражают удар? Отлично. Значит, бить надо один раз — но так, чтобы второго не понадобилось.',
        'They strike back? Fine. Then we hit once — hard enough that there’s no need for a second.',
      ),
      L(
        'eclipse_queen',
        'Я пойду с вами тенью — сколько смогу. Пожиратель ещё далеко, но его Глашатай уже здесь. Он держит трещину открытой.',
        'I will walk with you as a shadow — as long as I can. The Devourer is still far away, but its Herald is already here. It is holding the crack open.',
      ),
    ],
  },
  {
    id: 'c6-boss',
    chapter: 6,
    trigger: 'boss',
    stage: '6-10',
    scene: 'rift',
    title: { ru: 'Глашатай Пожирателя', en: 'The Devourer’s Herald' },
    lines: [
      L(
        'void_herald',
        'Маленький огонёк. Ты пришёл закрыть дверь, которую сам же и открыл. Господин благодарит тебя за маяк.',
        'Little flame. You came to close a door you opened yourself. My master thanks you for the beacon.',
      ),
      L(
        'selesta',
        'Мы не впустим его. Мы сто лет учились прятаться. Научимся и закрывать двери.',
        'We will not let it in. We spent a hundred years learning to hide. We can learn to close doors.',
      ),
      L(
        'void_herald',
        'Каждый твой удар — мой удар. Каждая твоя рана — моя пища. Бей, Хранитель. Бей сильнее.',
        'Every blow of yours is a blow of mine. Every wound of yours is my food. Strike, Warden. Strike harder.',
      ),
    ],
  },
  {
    id: 'c6-outro',
    chapter: 6,
    trigger: 'outro',
    stage: '6-10',
    scene: 'rift',
    title: { ru: 'Свет, который прячут вместе', en: 'A Light Hidden Together' },
    lines: [
      L(
        'narrator',
        'Глашатай рассыпается звёздной пылью, и края трещины медленно сходятся, как края раны.',
        'The Herald scatters into star dust, and the edges of the crack slowly draw together like the edges of a wound.',
      ),
      L(
        'eclipse_queen',
        'Трещина закроется не до конца. Пожиратель знает, где мы. Он будет возвращаться — каждую неделю, пока стоит небо.',
        'The crack will not close completely. The Devourer knows where we are. It will return — every week, for as long as the sky stands.',
      ),
      L(
        'selesta',
        'Значит, каждую неделю мы будем встречать его вместе. Хранитель… я вижу свет. Совсем чуть-чуть. Твой.',
        'Then every week we will meet it together. Warden… I can see light. Just a little. Yours.',
      ),
      L(
        'narrator',
        'Они не победили Пожирателя звёзд. Они просто снова научились прятать свет. Но теперь — не каждый у своего костра, а все вместе.',
        'They did not defeat the Star Devourer. They simply learned once more to hide the light. But now — not each by their own fire, but all together.',
      ),
      L('narrator', 'Конец первой книги «Осколков зари».', 'The end of the first book of “Dawn Shards”.'),
    ],
  },
];

/** Сцена по этапу и моменту. */
export function storyFor(stage: string, trigger: StoryScene['trigger']): StoryScene | undefined {
  return STORY.find((s) => s.stage === stage && s.trigger === trigger);
}
