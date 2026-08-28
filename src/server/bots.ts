// Halaqi bot engine — 100 bot accounts that autonomously generate realistic
// activity (text/image posts, likes, Iraqi-Arabic comments, follows/unfollows,
// and direct messages) using the existing data layer. Bots never book salons.
//
// Lifecycle:
//   startBotEngine()  -> ensures tables, seeds up to 100 bots (idempotent),
//                        reads global enabled flag, and starts the scheduler.
//   The global flag (bot_control row 'global') is toggled by the admin API.
import { createClient } from '@supabase/supabase-js';
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

// Bot media pipeline.
// Images are NOT served from external CDNs (DiceBear / Picsum) because those are
// unreliable in production (broken/black images) and DiceBear is not a real
// human photo. Instead we fetch real photos once and upload them into Halaqi's
// own Supabase Storage bucket (already CSP-allowed and used for message media),
// then persist the resulting Supabase URLs in `bot_media`. The browser always
// loads from Halaqi's own infra, so images render reliably.
const FEMALE_NAMES = new Set([
  'زين العراق', 'سارة الحلوة', 'نور الزهراء', 'ليلى الشرقية', 'مريم البصريه',
  'رنا الناصرية', 'دلع العراق', 'جنى بغداد', 'هبة الكاظمية', 'لمى الفرات',
  'شهد النجف', 'رؤى الكربلائية', 'إيمان الحيدري', 'تالا البصريه', 'نورهان الساهر',
  'ريم العبيدي', 'أمل الحكيم', 'بشرى الزبيدي', 'لجين الباجه جي', 'دعاء العراقية',
  'فاطمة الحسيني', 'سلمى الدجيلي', 'يارا العبيدي', 'غدير الفلوجه',
]);

const FALLBACK_AVATAR_MEN = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop';
const FALLBACK_AVATAR_WOMEN = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop';
const FALLBACK_POST = 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=600&h=750&fit=crop';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function botGender(name: string): 'men' | 'women' {
  const base = name.replace(/\s+\d+$/, '');
  return FEMALE_NAMES.has(base) ? 'women' : 'men';
}

// --- Supabase upload (reuses Halaqi's existing storage infra) -----------------
let supabaseClient: any = null;
function getSupabaseClient(): any {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SECRET_KEY || '',
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    );
  }
  return supabaseClient;
}

const BOT_MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || 'avatars';

async function uploadImageFromUrl(sourceUrl: string, folder: string, fileName: string): Promise<string | null> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl || !/^https:\/\/.+\.supabase\.co$/.test(supabaseUrl) || !process.env.SUPABASE_SECRET_KEY) {
      return null;
    }
    const res = await fetch(sourceUrl);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || 'image/jpeg';
    if (!ct.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    const ext = (ct.split('/')[1] || 'jpg').replace('x-', '');
    const finalExt = ext === 'jpeg' ? 'jpg' : ext;
    const name = `${folder}/${fileName}.${finalExt}`; // e.g. bot/avatars/men_1.jpg
    const client = getSupabaseClient();
    const { error } = await client.storage
      .from(BOT_MEDIA_BUCKET)
      .upload(name, buf, { contentType: ct, upsert: true, cacheControl: '31536000' });
    if (error) {
      console.error('[BOTS] media upload failed for', sourceUrl, error);
      return null;
    }
    return client.storage.from(BOT_MEDIA_BUCKET).getPublicUrl(name).data.publicUrl;
  } catch (e: any) {
    console.error('[BOTS] uploadImageFromUrl error', e?.message || e);
    return null;
  }
}

let AVATAR_POOL_MEN: string[] = [];
let AVATAR_POOL_WOMEN: string[] = [];
let POST_IMAGE_POOL: string[] = [];

async function buildBotMediaPools(): Promise<void> {
  const stored = await db.loadBotMedia();
  if (stored && (stored.men.length || stored.women.length || stored.posts.length)) {
    AVATAR_POOL_MEN = stored.men;
    AVATAR_POOL_WOMEN = stored.women;
    POST_IMAGE_POOL = stored.posts;
    return;
  }
  // Real human portraits (server-side fetch; only the uploaded Supabase URL
  // reaches the browser, so the source host need not be CSP-allowed).
  const menSources = Array.from({ length: 12 }, (_, i) => `https://randomuser.me/api/portraits/men/${i + 1}.jpg`);
  const womenSources = Array.from({ length: 12 }, (_, i) => `https://randomuser.me/api/portraits/women/${i + 1}.jpg`);
  // Real photos for posts, from a few reliable sources (first that fetches wins).
  const postSources = [
    ...Array.from({ length: 10 }, (_, i) => `https://picsum.photos/seed/halaqipost${i + 1}/600/600`),
    ...Array.from({ length: 6 }, (_, i) => `https://loremflickr.com/600/600/iraq,baghdad,city,night?lock=${i + 1}`),
  ];
  const men = (await Promise.all(menSources.map((u, i) => uploadImageFromUrl(u, 'bot/avatars', `men_${i + 1}`)))).filter(Boolean) as string[];
  const women = (await Promise.all(womenSources.map((u, i) => uploadImageFromUrl(u, 'bot/avatars', `women_${i + 1}`)))).filter(Boolean) as string[];
  const posts = (await Promise.all(postSources.map((u, i) => uploadImageFromUrl(u, 'bot/posts', `post_${i + 1}`)))).filter(Boolean) as string[];
  const finalMen = men.length ? men : [FALLBACK_AVATAR_MEN];
  const finalWomen = women.length ? women : [FALLBACK_AVATAR_WOMEN];
  const finalPosts = posts.length ? posts : [FALLBACK_POST];
  AVATAR_POOL_MEN = finalMen;
  AVATAR_POOL_WOMEN = finalWomen;
  POST_IMAGE_POOL = finalPosts;
  await db.saveBotMedia(finalMen, finalWomen, finalPosts);
}

function avatarForBot(name: string): string {
  const pool = botGender(name) === 'women' ? AVATAR_POOL_WOMEN : AVATAR_POOL_MEN;
  return pool.length ? pick(pool) : FALLBACK_AVATAR_MEN;
}

function postImageForBot(): string {
  return POST_IMAGE_POOL.length ? pick(POST_IMAGE_POOL) : FALLBACK_POST;
}


let engineStarted = false;
let schedulerHandle: ReturnType<typeof setInterval> | null = null;
// isEnabled is only a cache for the dev scheduler; production ticks always
// read the persisted flag from the database (see runBotTick).
let isEnabled = false;
const BOTS_PER_CRON = 15; // bots acted upon per Vercel Cron invocation

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
      avatar: avatarForBot(name),
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
    { imageUrl: postImageForBot(), caption: pick(CAPTIONS) },
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

// --- One-time backfill of pre-existing bot media (robust + idempotent) -------
// Re-points ANY bot avatar / bot post image that is NOT hosted on Halaqi's own
// Supabase Storage to a real, validated Supabase URL from `bot_media`. It never
// writes DiceBear / Picsum / Unsplash again. Safe to call on every cold start:
// it records a completion flag so the heavy work runs only once per deployment
// lifecycle and is guarded by an in-process promise to prevent concurrency.
let mediaMigrationPromise: Promise<void> | null = null;

function botGenderForName(name: string): 'men' | 'women' {
  return FEMALE_NAMES.has(name.replace(/\s+\d+$/, '')) ? 'women' : 'men';
}

async function migrateExistingBotMedia(force = false): Promise<void> {
  // Load the validated Supabase media pools directly (self-contained; does not
  // depend on the in-memory pools being populated yet).
  const stored = await db.loadBotMedia();
  const men = stored?.men?.length ? stored!.men : [];
  const women = stored?.women?.length ? stored!.women : [];
  const posts = stored?.posts?.length ? stored!.posts : [];
  if (!men.length && !women.length && !posts.length) {
    console.log('[BOTS] migrateExistingBotMedia: no Supabase pool available, skipping');
    return;
  }

  if (!force) {
    try {
      if (await db.getBotMediaMigrationFlag()) {
        console.log('[BOTS] migrateExistingBotMedia: already completed, skipping');
        return;
      }
    } catch {
      /* fall through and attempt */
    }
  }

  // 1) Bot avatars: any non-Supabase avatar -> real human Supabase photo.
  const bots = await db.getAllBotsForMedia();
  let avatarsUpdated = 0;
  for (const b of bots) {
    if (!b.avatar || !b.avatar.includes('supabase')) {
      const pool = botGenderForName(b.name) === 'women' ? women : men;
      const target = pool.length ? pick(pool) : women[0] || men[0];
      if (target) {
        await db.updateUserAvatarColumn(b.id, target);
        avatarsUpdated++;
      }
    }
  }

  // 2) Bot post images: any non-Supabase image -> valid Supabase photo.
  const postIds = await db.getBrokenBotPostIds();
  let postsUpdated = 0;
  for (const id of postIds) {
    const target = posts.length ? pick(posts) : null;
    if (target) {
      await db.updateUserPostImage(id, target);
      postsUpdated++;
    }
  }

  try { await db.setBotMediaMigrationFlag(); } catch { /* ignore */ }
  console.log(`[BOTS] migrateExistingBotMedia: done (avatars=${avatarsUpdated}, posts=${postsUpdated})`);
}

/** Idempotent, concurrency-safe entry point used by the engine. */
export async function runBotMediaMigration(force = false): Promise<void> {
  if (!mediaMigrationPromise) {
    mediaMigrationPromise = migrateExistingBotMedia(force).finally(() => {
      mediaMigrationPromise = null;
    });
  }
  return mediaMigrationPromise;
}

let seedingPromise: Promise<void> | null = null;
function ensureAndSeed(): Promise<void> {
  if (!seedingPromise) {
    seedingPromise = (async () => {
      await db.ensureBotTables();
      await buildBotMediaPools();
      await seedBotsIfNeeded();
      await runBotMediaMigration();
    })().catch((e: any) => {
      console.error('[BOTS] ensureAndSeed failed:', e?.message || e);
      seedingPromise = null; // reset so a later tick can retry
    });
  }
  return seedingPromise;
}

/**
 * Perform a single batch of bot activity. The persisted START/STOP flag is
 * read from the database on EVERY call, so this is safe to trigger from a
 * Vercel Cron job (no long-lived process / no browser required) and always
 * reflects the latest admin setting — even if START was pressed after the
 * serverless function booted.
 */
export async function runBotTick(batchSize: number = BOTS_PER_TICK): Promise<void> {
  try {
    const enabled = await db.getBotControl();
    if (!enabled) return;
    await ensureAndSeed(); // idempotent: seeds any missing bots
    const bots = await db.getActiveBots(batchSize);
    await Promise.all(bots.map((b) => actAsBot(b.id)));
  } catch (e: any) {
    console.error('[BOTS] tick error:', e?.message || e);
  }
}

/** Convenience wrapper used by the cron endpoint (larger per-invocation batch). */
export async function runCronTick(): Promise<void> {
  await runBotTick(BOTS_PER_CRON);
}

/**
 * Idempotent initialization for the serverless entry: ensures bot tables,
 * seeds up to 100 bots, and starts the scheduler ONCE at cold start.
 *
 * The scheduler runs at module scope (server/container start) — NOT inside a
 * request and NOT in the browser — so bot activity is completely independent
 * of the Admin page, React state, navigation, or any client timer. Vercel Cron
 * additionally hits /api/cron/bots-tick as a backup trigger for idle (frozen)
 * containers. Each tick reads the persisted START/STOP flag from the database.
 */
export async function initBotEngine(): Promise<void> {
  if (engineStarted) return;
  engineStarted = true;
  try {
    // Kick off seeding/media-upload in the background so the serverless cold
    // start (module load) returns immediately and is never blocked by the
    // ~100 bot inserts + media uploads. Bot activity begins as soon as the
    // background work finishes; each tick also awaits ensureAndSeed (idempotent).
    void ensureAndSeed();
    if (!schedulerHandle) {
      schedulerHandle = setInterval(() => {
        void runBotTick(BOTS_PER_TICK);
      }, TICK_MS);
    }
    console.log(`[BOTS] engine initialized + scheduler started (target=${BOT_COUNT})`);
  } catch (e: any) {
    engineStarted = false; // allow retry on next call
    console.error('[BOTS] init failed:', e?.message || e);
  }
}

/** Dev/server entry: ensure the engine (and its server-side scheduler) is running. */
export async function startBotEngine(): Promise<void> {
  await initBotEngine();
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
