// Halaqi bot engine — 100 bot accounts that autonomously generate realistic
// activity (text/image posts, likes, Iraqi-Arabic comments, follows/unfollows,
// and direct messages) using the existing data layer. Bots never book salons.
//
// Lifecycle:
//   startBotEngine()  -> ensures tables, seeds up to 100 bots (idempotent),
//                        reads global enabled flag, and starts the scheduler.
//   The global flag (bot_control row 'global') is toggled by the admin API.
import { db } from './db';

const BOT_COUNT = 100;
const TICK_MS = 4000; // scheduler cadence
const BOTS_PER_TICK = 6; // max active bots acting each tick (rate limiting)

const CITIES = ['baghdad', 'basra', 'mosul', 'erbil', 'karbala', 'najaf', 'kirkuk', 'hillah', 'nasiriyah', 'diwaniyah'];

const NAMES = [
  'أبو يوسف', 'زين العراق', 'سارة الحلوة', 'كوفي بغداد', 'المصمم العراقي', 'نور الزهراء',
  'حسين الموسوي', 'ليلى الشرقية', 'علي الكرخي', 'مريم البصريه', 'فهد الجميل', 'رنا الناصرية',
  'أبو علي', 'دلع العراق', 'سيف الحي', 'جنى بغداد', 'وليد الرشيد', 'هبة الكاظمية',
  'كرار العماري', 'لمى الفرات', 'باسم السماوة', 'شهد النجف', 'ياسر الدليمي', 'رؤى الكربلائية',
  'مصطفى الشمري', 'إيمان الحيدري', 'زيدون العامري', 'تالا البصريه', 'عدي الجبوري', 'نورهان الساهر',
  'صفاء العكيلي', 'ماجد الفيلي', 'ريم العبيدي', 'كاظم الرصافي', 'أمل الحكيم', 'سرمد الطائي',
  'بشرى الزبيدي', 'هيثم العتابي', 'لجين الباجه جي', 'وسام القيسي', 'دعاء العراقية', 'فاطمة الحسيني',
  'أحمد العاني', 'سلمى الدجيلي', 'طارق البياتي', 'يارا العبيدي', 'نبراس الكرخ', 'غدير الفلوجه',
];

const PERSONALITIES = [
  'شخصية اجتماعية تحب الحديث عن قصات الشعر والعناية بالبشرة، دائماً تشجع الناس على تجربة صالونات جديدة.',
  'خجوله بس تحب تشارك لحظاتها الجميلة وتتعرف على ناس جدد من بغداد والبصرة.',
  'مهتمة بالموضة والستايل العراقي، تحب تكتب كومنتات داعمة ولطيفة.',
  'شاب طموح يحب الرياضة والظهور بمظهر مرتب، يعلق بنكت خفيفة.',
  'فتاة تحب الجمال والطبيعة، تعليقاتها دافئة وبسيطة.',
  'هاوي تصوير يحب ينشر صور من شوارع العراق ويحكي قصص صغيرة.',
  'شخصية نشيطة تتابع كل المنشورات وتدعم أصحاب الصالونات الصغيرة.',
  'محب للتجارب الجديدة، دائماً أول واحد يجرب خدمة ويكتب رأيه بصدق.',
];

const INTERESTS = [
  ['hair', 'beard', 'style'],
  ['skincare', 'makeup', 'beauty'],
  ['barber', 'grooming', 'fashion'],
  ['selfcare', 'health', 'fitness'],
  ['iraq', 'culture', 'photography'],
  ['salon', 'nails', 'spa'],
  ['community', 'friends', 'chat'],
  ['trends', 'looks', 'confidence'],
];

const CAPTIONS = [
  'يوم جديد وستايل أحلى 😍',
  'جربت هالقصة وصار شكلي غير! شنو رأيكم؟',
  'العناية بنفسك أهم من أي شي 💪',
  'من أجمل لحظات اليوم، شكراً للصالونات العراقية ❤️',
  'ثقة بالنفس تبدأ من مظهرك 🌟',
  'صباح الخير يا أهل العراق ☀️',
  'قصة شعر بسيطة بس أنيقة، جربوها أكيد تعجبكم',
  'أحلى فترة لأنك تهتم بنفسك 💇‍♂️',
  'الجمال العراقي بكل تفاصيله 🇮🇶',
  'لا تنسون تحجزون موعدكم وتهتمون بشكلكم',
];

const COMMENTS = [
  'شكد حلو 🥰',
  'والله قصة فخمة!',
  'يعجبني ذوقك دائماً 👌',
  'أنا جربت وصار ممتاز، أنصح الكل',
  'صورة بطل 😍',
  'اللهم بارك، أنيقة جداً',
  'هذا أحلى منشور شفته اليوم',
  'تسلم إيدك على الفكرة 🌹',
  'أكو صالون يوفر هالخدمة؟',
  'بصراحة ستايل رهيب 🔥',
  'دائماً إبداع منك ❤️',
  'حلو بس جربتي تغيري اللون شوية؟',
];

const MESSAGES = [
  'هلا والله! شكو أخبارك؟',
  'شفت منشورك و عجبني كثير 😍',
  'هل تعرفين صالون زين بمنطقتك؟',
  'أنصحج تجربين قصة الشعر هاي، تليقج',
  'بالتوفيق دائماً يا رب 🌟',
  'أحب أتعرف على ناس جديدة من العراق',
  'شنو رأيك نتبادل تجارب الصالونات؟',
  'يومك سعيد إن شاء الله 💛',
  'أكثر شي يحمسني إنك تهتمين بنفسج',
  'هلا حبيبتي، كاعد أتصفح وأنتِ مميزة',
];

const REPLIES = [
  'هههه فعلاً!',
  'شكراً على الرسالة، أسعدتيني 🌸',
  'تتفق معج، أكو صالونات رهيبة ببغداد',
  'إن شاء الله أجرب وأخبرج',
  'حبيبتي والله تضحكيني 😄',
  'هلا بالطيبين، أهلاً وسهلا',
];

const PICS = [
  'https://picsum.photos/seed/halaqi1/600/600',
  'https://picsum.photos/seed/halaqi2/600/600',
  'https://picsum.photos/seed/halaqi3/600/600',
  'https://picsum.photos/seed/halaqi4/600/600',
  'https://picsum.photos/seed/halaqi5/600/600',
  'https://picsum.photos/seed/halaqi6/600/600',
  'https://picsum.photos/seed/halaqi7/600/600',
  'https://picsum.photos/seed/halaqi8/600/600',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function avatarFor(name: string): string {
  const seed = encodeURIComponent(name) + randInt(1, 9999);
  return `https://api.dicebear.com/9.x/bottts/png?seed=${seed}&backgroundColor=transparent`;
}

let engineStarted = false;
let schedulerHandle: ReturnType<typeof setInterval> | null = null;
let isEnabled = false;

async function seedBotsIfNeeded(): Promise<void> {
  const existing = await db.countBots();
  if (existing >= BOT_COUNT) return;
  const need = BOT_COUNT - existing;
  for (let i = 0; i < need; i++) {
    const name = `${pick(NAMES)} ${randInt(2, 99)}`;
    const city = pick(CITIES);
    const bioPool = pick([
      'بوت تجريبي من مجتمع هلاقي 🤖',
      'حساب تجريبي يحب يشارك الجمال العراقي',
      'بوت يدعم أصحاب الصالونات والمظهر المرتب',
      'حساب تجريبي من فريق هلاقي للاختبار',
    ]);
    await db.createBot({
      name,
      avatar: avatarFor(name),
      bio: `${bioPool} · ${name}`,
      city,
      personality: `${pick(PERSONALITIES)} (${name})`,
      interests: pick(INTERESTS),
    });
  }
  console.log(`[BOTS] seeded ${need} bot(s), total now ${await db.countBots()}`);
}

async function createTextPost(botId: string): Promise<void> {
  await db.createUserPost({ caption: pick(CAPTIONS) }, { id: botId } as any);
}

async function createImagePost(botId: string): Promise<void> {
  await db.createUserPost(
    { imageUrl: pick(PICS), caption: pick(CAPTIONS) },
    { id: botId } as any
  );
}

async function likeRandomPost(botId: string): Promise<void> {
  const posts = await db.getRandomUserPosts(1);
  if (!posts.length) return;
  await db.togglePostLike(posts[0].id, { id: botId } as any, 'user');
}

async function commentRandomPost(botId: string): Promise<void> {
  const posts = await db.getRandomUserPosts(1);
  if (!posts.length) return;
  await db.addPostComment({ postId: posts[0].id, comment: pick(COMMENTS) }, { id: botId } as any);
}

async function followRandom(botId: string): Promise<void> {
  const targets = await db.getRandomHumanUsers(1, botId);
  if (!targets.length) return;
  await db.followUser(botId, targets[0].id);
}

async function unfollowRandom(botId: string): Promise<void> {
  const targets = await db.getRandomHumanUsers(1, botId);
  if (!targets.length) return;
  await db.unfollowUser(botId, targets[0].id);
}

async function messageRandom(botId: string): Promise<void> {
  const targets = await db.getRandomHumanUsers(1, botId);
  if (!targets.length) return;
  const text = pick(MESSAGES);
  await db.sendDirectMessage(botId, targets[0].id, text);
}

async function actAsBot(botId: string): Promise<void> {
  // Stagger each bot's actions slightly to avoid thundering-herd writes.
  await sleep(randInt(0, 1200));
  const actions = randInt(1, 2);
  for (let i = 0; i < actions; i++) {
    const choice = randInt(1, 7);
    switch (choice) {
      case 1:
        await createTextPost(botId);
        break;
      case 2:
        await createImagePost(botId);
        break;
      case 3:
        await likeRandomPost(botId);
        break;
      case 4:
        await commentRandomPost(botId);
        break;
      case 5:
        await followRandom(botId);
        break;
      case 6:
        await unfollowRandom(botId);
        break;
      case 7:
        await messageRandom(botId);
        break;
    }
    if (i < actions - 1) await sleep(randInt(200, 800));
  }
}

async function tick(): Promise<void> {
  if (!isEnabled) return;
  try {
    const bots = await db.getActiveBots(BOTS_PER_TICK);
    await Promise.all(bots.map((b) => actAsBot(b.id)));
  } catch (e: any) {
    console.error('[BOTS] tick error:', e?.message || e);
  }
}

/** Boot the engine. Safe to call once at server start. */
export async function startBotEngine(): Promise<void> {
  if (engineStarted) return;
  engineStarted = true;
  try {
    await db.ensureBotTables();
    await seedBotsIfNeeded();
    isEnabled = await db.getBotControl();
    schedulerHandle = setInterval(() => {
      void tick();
    }, TICK_MS);
    console.log(`[BOTS] engine started (enabled=${isEnabled}, target=${BOT_COUNT})`);
  } catch (e: any) {
    console.error('[BOTS] failed to start engine:', e?.message || e);
  }
}

/** Admin: enable all bot activity. */
export async function startAllBots(): Promise<void> {
  isEnabled = true;
  await db.setBotControl(true);
  console.log('[BOTS] START ALL issued');
}

/** Admin: stop all bot activity (data is preserved). */
export async function stopAllBots(): Promise<void> {
  isEnabled = false;
  await db.setBotControl(false);
  console.log('[BOTS] STOP ALL issued');
}

export function isBotEngineEnabled(): boolean {
  return isEnabled;
}
