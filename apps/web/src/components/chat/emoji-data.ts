// Curated sticker/emoji catalog for the in-chat sticker picker.
// Each entry: [emoji, keywords]. Free (unicode), no external service/key.

export interface StickerCategory {
  id: string;
  label: string;
  emoji: string;
  items: [string, string][];
}

export const STICKER_CATEGORIES: StickerCategory[] = [
  {
    id: 'smileys',
    label: 'Smileys',
    emoji: '😀',
    items: [
      ['😀', 'grin happy smile'], ['😃', 'smile happy mouth'], ['😄', 'laugh happy'],
      ['😁', 'beaming grin'], ['😆', 'laughing joy'], ['😅', 'sweat smile nervous'],
      ['😂', 'tears laugh funny'], ['🤣', 'rofl rolling'], ['😊', 'blush kind sweet'],
      ['😇', 'innocent halo angel'], ['🙂', 'slight smile'], ['🙃', 'upside down silly'],
      ['😉', 'wink flirty'], ['😌', 'relieved content'], ['😍', 'love heart eyes'],
      ['🥰', 'smile hearts adore'], ['😘', 'kiss blow'], ['😗', 'kiss pursed'], ['😙', 'kiss smiling'],
      ['😋', 'yummy taste'], ['😛', 'tongue playful'], ['😜', 'wink tongue silly'], ['🤪', 'crazy zany'],
      ['😝', 'tongue grin'], ['🤗', 'hug embrace'], ['🤭', 'giggle covering mouth shy'],
      ['🤫', 'shush secret hush'], ['🤔', 'thinking hmm'], ['😐', 'neutral plain'], ['😑', 'expressionless'],
      ['😶', 'no mouth silent'], ['😏', 'smirk sly'], ['😒', 'unamused bored'], ['🙄', 'eye roll'],
      ['😬', 'grimace awkward'], ['😮‍💨', 'whew sigh relief'], ['🙄', 'annoyed'],
    ],
  },
  {
    id: 'emo',
    label: 'Emotions',
    emoji: '😢',
    items: [
      ['😔', 'sad pensive'], ['😞', 'disappointed sad'], ['😟', 'worried concerned'],
      ['😕', 'confused unsure'], ['🙁', 'frowning sad'], ['😢', 'crying tear sad'],
      ['😭', 'crying sobbing loud'], ['😤', 'triumph steam angry'], ['😡', 'angry mad rage'],
      ['🤬', 'swear angry mad'], ['😳', 'flushed embarrassed shocked'], ['🥺', 'pleading puppy eyes'],
      ['😱', 'scream shocked fear'], ['😨', 'fearful scared'], ['😰', 'anxious cold sweat'],
      ['😓', 'sweat sad'], ['🤯', 'mind blown exploding'], ['😴', 'sleeping tired'], ['🤤', 'drooling sleepy'],
      ['😪', 'sleepy tired'], ['😵', 'dizzy spinning'], ['🥱', 'yawn bored tired'], ['😷', 'mask sick'],
      ['🤒', 'fever sick'], ['🤕', 'injured bandage'], ['🤢', 'sick nauseous'], ['🤮', 'vomit sick'],
      ['😎', 'cool sunglasses'], ['🤓', 'nerd glasses'], ['🥳', 'party celebrating'], ['😈', 'evil devil'],
    ],
  },
  {
    id: 'hands',
    label: 'Hands',
    emoji: '👍',
    items: [
      ['👍', 'thumbs up like'], ['👎', 'thumbs down dislike'], ['👌', 'ok perfect'], ['✌️', 'peace victory v'],
      ['🤞', 'crossed fingers luck'], ['🤟', 'love rock horn'], ['🤘', 'rock metal horn'], ['🤙', 'call me hang loose'],
      ['👈', 'point left'], ['👉', 'point right'], ['👆', 'point up'], ['👇', 'point down'],
      ['👋', 'wave hello bye'], ['🤚', 'raised back hand stop'], ['✋', 'hand raised stop'],
      ['🖖', 'vulcan live long star trek'], ['🫰', 'finger heart'], ['✊', 'fist power'], ['🤛', 'fist left'],
      ['🤜', 'fist right'], ['👏', 'clap applause'], ['🙌', 'raised celebrate hooray'], ['👐', 'open hands'],
      ['🤲', 'palms together thanks'], ['🤝', 'handshake deal'], ['🙏', 'pray thanks please'],
      ['💪', 'muscle strong flex'], ['🦾', 'mechanical arm'], ['🫶', 'hands heart love'], ['🤌', 'pinched chef kiss'],
    ],
  },
  {
    id: 'animals',
    label: 'Animals',
    emoji: '🐶',
    items: [
      ['🐶', 'dog puppy'], ['🐱', 'cat kitty'], ['🐭', 'mouse'], ['🐹', 'hamster'], ['🐰', 'rabbit bunny'],
      ['🦊', 'fox'], ['🐻', 'bear'], ['🐼', 'panda'], ['🐨', 'koala'], ['🐯', 'tiger'],
      ['🦁', 'lion'], ['🐮', 'cow'], ['🐷', 'pig'], ['🐸', 'frog'], ['🐵', 'monkey'],
      ['🐔', 'chicken'], ['🐧', 'penguin'], ['🐦', 'bird'], ['🦆', 'duck'], ['🦅', 'eagle'],
      ['🦉', 'owl'], ['🐸', 'frog'], ['🦋', 'butterfly'], ['🐝', 'bee'], ['🐞', 'ladybug'],
      ['🐢', 'turtle'], ['🐍', 'snake'], ['🦖', 'dinosaur t rex'], ['🐙', 'octopus'], ['🦄', 'unicorn'],
    ],
  },
  {
    id: 'food',
    label: 'Food',
    emoji: '🍕',
    items: [
      ['🍎', 'apple'], ['🍌', 'banana'], ['🍉', 'watermelon'], ['🍇', 'grapes'], ['🍓', 'strawberry'],
      ['🍑', 'peach'], ['🍒', 'cherry'], ['🥭', 'mango'], ['🍍', 'pineapple'], ['🥥', 'coconut'],
      ['🍔', 'burger'], ['🍕', 'pizza'], ['🌭', 'hotdog'], ['🥪', 'sandwich'], ['🌮', 'taco'],
      ['🍟', 'fries'], ['🍗', 'chicken drumstick'], ['🥓', 'bacon'], ['🍜', 'noodles ramen'],
      ['🍩', 'donut'], ['🍪', 'cookie'], ['🎂', 'cake birthday'], ['🍰', 'cake'], ['🧁', 'cupcake'],
      ['🍫', 'chocolate'], ['🍦', 'ice cream'], ['🍿', 'popcorn'], ['☕', 'coffee'], ['🍵', 'tea'],
      ['🧋', 'bubble tea'], ['🍺', 'beer'], ['🍷', 'wine'], ['🥂', 'cheers champagne toast'],
    ],
  },
  {
    id: 'objects',
    label: 'Objects',
    emoji: '🎉',
    items: [
      ['🎉', 'party popper celebrate'], ['🎊', 'confetti ball'], ['🎁', 'gift present'], ['🎈', 'balloon'],
      ['⭐', 'star'], ['🌟', 'glowing star'], ['✨', 'sparkles shiny'], ['⚡', 'lightning zap'],
      ['🔥', 'fire hot lit'], ['💥', 'collision boom explode'], ['💯', 'hundred perfect'], ['✅', 'check yes'],
      ['❌', 'cross no'], ['⏰', 'alarm time'], ['📅', 'calendar date'], ['📌', 'pin'], ['🔔', 'bell notify'],
      ['🔕', 'bell muted'], ['📢', 'loudspeaker announce'], ['💡', 'idea light bulb'], ['🔍', 'search magnify'],
      ['🛒', 'cart shopping'], ['💰', 'money bag'], ['💵', 'dollar cash'], ['📈', 'chart up growth'],
      ['🏆', 'trophy win'], ['🥇', 'gold medal'], ['🎮', 'game controller'], ['🎵', 'music note'],
      ['💎', 'diamond gem'], ['❤️', 'heart love red'], ['💜', 'purple heart'], ['💚', 'green heart'],
      ['💛', 'yellow heart'], ['🤍', 'white heart'], ['💔', 'broken heart'], ['❣️', 'heart exclamation'],
      ['💯', 'hundred'], ['👀', 'eyes look'], ['👑', 'crown king'], ['🚀', 'rocket launch'],
      ['🌙', 'moon night'], ['☀️', 'sun'], ['🌈', 'rainbow'], ['☔', 'rain'], ['💌', 'love letter'],
    ],
  },
];

/** Flatten to a searchable index. */
const FLAT: { e: string; keys: string }[] = STICKER_CATEGORIES.flatMap((c) =>
  c.items.map(([e, k]) => ({ e, keys: `${k} ${c.label}`.toLowerCase() })),
);

export function searchStickers(q: string): string[] {
  const s = q.trim().toLowerCase();
  if (!s) return STICKER_CATEGORIES.flatMap((c) => c.items.map(([e]) => e));
  // Token match: any search token must appear in a sticker's keywords.
  const tokens = s.split(/\s+/).filter(Boolean);
  return FLAT.filter((it) => tokens.every((t) => it.keys.includes(t)))
    .map((it) => it.e)
    .slice(0, 60);
}

/** Detect whether a message body is just a single sticker emoji (render large). */
const EMOJI_RE = /^[\p{Extended_Pictographic}\u200d\u{FE0F}]{1,4}$/u;

export function isSticker(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.trim();
  return t.length <= 8 && EMOJI_RE.test(t) && /[\p{Extended_Pictographic}\u{FE0F}]/u.test(t);
}
