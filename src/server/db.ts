import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { moderateContent } from "./moderation";

const sql = neon(process.env.DATABASE_URL!);
import crypto from 'crypto';
import {
  Salon,
  Barber,
  Service,
  Booking,
  Review,
  Coupon,
  Notification,
  City,
  PlatformSettings,
  BlockedTime,
  User,
  AuditLog,
  UserRole,
  SalonPost,
  PostComment,
  PostLike,
  UserPost
} from '../types';

async function ensureCommentReactionsTables(): Promise<void> {
  await sql`
    ALTER TABLE post_comments
      ADD COLUMN IF NOT EXISTS likes INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS dislikes INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS comment_reactions (
      comment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (comment_id, user_id)
    )
  `;
}

/* =========================================================
   INTEREST LEARNING
   Auto-learns per-user interest weights from real interactions
   (likes / comments / follows) and decays topics the user stops
   engaging with. Combined with the user's manually selected
   interests for Feed Ranking and Discover recommendations.
========================================================= */

const LEARN_LIKE_STEP = 0.6;
const LEARN_COMMENT_STEP = 0.9;
const LEARN_FOLLOW_STEP = 0.8;
const LEARN_DECAY = 0.85; // every learning event decays all other learned weights
const LEARN_MAX = 3.0;
const LEARN_MIN_DELETE = 0.05;
const MANUAL_INTEREST_WEIGHT = 1.0;
const COMBINED_MATCH_THRESHOLD = 0.3; // learned weight >= this counts as a match

async function ensureLearnedInterestsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS learned_interests (
      user_id TEXT NOT NULL,
      interest TEXT NOT NULL,
      weight NUMERIC NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, interest)
    )
  `;
}

export async function recordInterestLearning(
  userId: string,
  interests: string[],
  delta: number
): Promise<void> {
  if (!userId || !interests || interests.length === 0) return;
  await ensureLearnedInterestsTable();

  // Decay all existing learned weights for this user (topics they keep
  // engaging with get re-boosted below; ignored ones fade toward 0).
  await sql`
    UPDATE learned_interests
    SET weight = weight * ${LEARN_DECAY}, updated_at = NOW()
    WHERE user_id = ${userId}
  `;

  for (const interest of interests) {
    if (!interest) continue;
    await sql`
      INSERT INTO learned_interests (user_id, interest, weight, updated_at)
      VALUES (${userId}, ${interest}, ${delta}, NOW())
      ON CONFLICT (user_id, interest)
      DO UPDATE SET
        weight = GREATEST(0, LEAST(${LEARN_MAX}, learned_interests.weight + ${delta})),
        updated_at = NOW()
    `;
  }

  // Drop weights that have decayed below the threshold.
  await sql`
    DELETE FROM learned_interests
    WHERE user_id = ${userId} AND weight < ${LEARN_MIN_DELETE}
  `;
}

export async function getCombinedInterests(
  userId?: string
): Promise<{ interest: string; weight: number }[]> {
  if (!userId) return [];
  await ensureLearnedInterestsTable();

  const manualRows = await sql`
    SELECT interests FROM users WHERE id = ${userId} LIMIT 1
  `;
  const manual: string[] = Array.isArray(manualRows[0]?.interests)
    ? manualRows[0].interests
    : [];

  const learnedRows = await sql`
    SELECT interest, weight FROM learned_interests WHERE user_id = ${userId}
  `;

  const map = new Map<string, number>();
  for (const i of manual) {
    map.set(i, (map.get(i) || 0) + MANUAL_INTEREST_WEIGHT);
  }
  for (const r of learnedRows as any[]) {
    const w = Number(r.weight || 0);
    map.set(r.interest, (map.get(r.interest) || 0) + w);
  }

  return Array.from(map.entries()).map(([interest, weight]) => ({
    interest,
    weight,
  }));
}

export interface UserWithAuth extends User {
  passwordHash?: string;
  salt?: string;
}

export interface DatabaseState {
  users: UserWithAuth[];
  salons: Salon[];
  barbers: Barber[];
  services: Service[];
  bookings: Booking[];
  reviews: Review[];
  salonPosts: SalonPost[];
  postComments: PostComment[];
  postLikes: PostLike[];
  coupons: Coupon[];
  notifications: Notification[];
  cities: City[];
  blockedTimes: BlockedTime[];
  favorites: { userId: string; salonId: string }[];
  settings: PlatformSettings;
  auditLogs: AuditLog[];
}

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

export function verifyPassword(password: string, hash?: string, salt?: string): boolean {
  if (!hash || !salt) return false;
  const computed = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Pre-compute salt & hash for initial users
const defaultSalt = 'halaqi_secure_salt_2026';
const adminHash = hashPassword(process.env.HALAQI_ADMIN_PASSWORD || '', defaultSalt);
const ownerHash = hashPassword('Owner@Royal2026!', defaultSalt);
const customerHash = hashPassword('Customer@2026!', defaultSalt);

const defaultWorkingHours = {
  saturday: { open: '10:00', close: '23:00', isOpen: true },
  sunday: { open: '10:00', close: '23:00', isOpen: true },
  monday: { open: '10:00', close: '23:00', isOpen: true },
  tuesday: { open: '10:00', close: '23:00', isOpen: true },
  wednesday: { open: '10:00', close: '23:00', isOpen: true },
  thursday: { open: '10:00', close: '00:00', isOpen: true },
  friday: { open: '14:00', close: '00:00', isOpen: true },
};

export const initialCities: City[] = [
  { id: 'baghdad', nameAr: 'بغداد', nameEn: 'Baghdad', lat: 33.3152, lng: 44.3661, active: true, salonCount: 14 },
  { id: 'erbil', nameAr: 'أربيل', nameEn: 'Erbil', lat: 36.1912, lng: 44.0092, active: true, salonCount: 8 },
  { id: 'basra', nameAr: 'البصرة', nameEn: 'Basra', lat: 30.5081, lng: 47.7835, active: true, salonCount: 6 },
  { id: 'nasiriyah', nameAr: 'الناصرية', nameEn: 'Nasiriyah', lat: 31.0539, lng: 46.2573, active: true, salonCount: 5 },
  { id: 'najaf', nameAr: 'النجف', nameEn: 'Najaf', lat: 32.0003, lng: 44.3364, active: true, salonCount: 5 },
  { id: 'karbala', nameAr: 'كربلاء', nameEn: 'Karbala', lat: 32.6160, lng: 44.0249, active: true, salonCount: 4 },
  { id: 'sulaymaniyah', nameAr: 'السليمانية', nameEn: 'Sulaymaniyah', lat: 35.5558, lng: 45.4351, active: true, salonCount: 4 },
  { id: 'mosul', nameAr: 'الموصل', nameEn: 'Mosul', lat: 36.3400, lng: 43.1300, active: true, salonCount: 3 },
  { id: 'hilla', nameAr: 'الحلة', nameEn: 'Hilla', lat: 32.4842, lng: 44.4312, active: true, salonCount: 3 },
  { id: 'kirkuk', nameAr: 'كركوك', nameEn: 'Kirkuk', lat: 35.4681, lng: 44.3922, active: true, salonCount: 3 },
];

export const initialUsers: UserWithAuth[] = [
  {
    id: 'user_cust_1',
    name: 'أحمد الموسوي',
    email: 'ahmed@halaqi.iq',
    phone: '+9647801234567',
    role: 'customer',
    city: 'baghdad',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    isActive: true,
    isBanned: false,
    salt: defaultSalt,
    passwordHash: customerHash,
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'user_owner_1',
    name: 'وسام الذهبي (صاحب صالون)',
    email: 'wissam@royalbarber.iq',
    phone: '+9647709876543',
    role: 'salon_owner',
    city: 'baghdad',
    salonId: 'salon_1',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    isActive: true,
    isBanned: false,
    salt: defaultSalt,
    passwordHash: ownerHash,
    createdAt: '2026-01-05T12:00:00Z',
  },
  {
    id: 'user_admin_1',
    name: 'مصطفى الإداري (مدير المنصة)',
    email: 'admin@halaqi.iq',
    phone: '+9647712345678',
    role: 'admin',
    city: 'baghdad',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
    isActive: true,
    isBanned: false,
    salt: defaultSalt,
    passwordHash: adminHash,
    createdAt: '2026-01-01T08:00:00Z',
  },
];

export const initialAuditLogs: AuditLog[] = [
  {
    id: 'log_init_1',
    userId: 'user_admin_1',
    userEmail: 'admin@halaqi.iq',
    userRole: 'admin',
    action: 'SYSTEM_BOOTSTRAP',
    targetType: 'system',
    details: 'تهيئة بيئة الحماية وتثبيت حساب مدير المنصة المحمي وتفعيل التحقق الأمني',
    ip: '127.0.0.1',
    status: 'success',
    timestamp: '2026-01-01T08:00:00Z',
  },
  {
    id: 'log_init_2',
    userId: 'user_admin_1',
    userEmail: 'admin@halaqi.iq',
    userRole: 'admin',
    action: 'SALON_APPROVE',
    targetType: 'salon',
    targetId: 'salon_1',
    details: 'الموافقة على تفعيل صالون رويال لاونج بعد التحقق من السجل والتراخيص',
    ip: '127.0.0.1',
    status: 'success',
    timestamp: '2026-01-02T10:00:00Z',
  },
];

export const initialSalons: Salon[] = [
  {
    id: 'salon_1',
    name: 'رويال لاونج للحلاقة الرجالية',
    nameEn: 'Royal Lounge Barber & Spa',
    slug: 'royal-lounge-baghdad',
    type: 'men',
    city: 'baghdad',
    area: 'المنصور',
    address: 'شارع 14 رمضان، مقابل مول المنصور، بغداد',
    lat: 33.3120,
    lng: 44.3540,
    phone: '+9647701122334',
    whatsapp: '+9647701122334',
    description: 'تجربة حلاقة ملكية راقية تجمع بين فن الحلاقة الكلاسيكي والخدمات الحديثة، مع جناح VIP ومشروبات ضيافة فاخرة.',
    descriptionEn: 'A luxury royal grooming experience blending classic artisan barbering with modern styling, private VIP suites and premium hospitality.',
    rating: 4.9,
    reviewCount: 184,
    startingPrice: 15000,
    coverImage: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200&auto=format&fit=crop&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&auto=format&fit=crop&q=80',
    ],
    isVerified: true,
    isFeatured: true,
    status: 'approved',
    workingHours: defaultWorkingHours,
    features: ['جناح VIP خاص', 'خدمة صف السيارات (فاليه)', 'قهوة ومشروبات مجانية', 'تكييف مركزي', 'دفع إلكتروني ونقدي', 'واي فاي عالي السرعة'],
    commissionRate: 10,
    ownerId: 'user_owner_1',
    createdAt: '2026-01-02T10:00:00Z',
  },
  {
    id: 'salon_2',
    name: 'ميزون دو بوتيه للتجميل النسائي',
    nameEn: 'Maison de Beauté Luxury Salon',
    slug: 'maison-de-beaute-erbil',
    type: 'women',
    city: 'erbil',
    area: 'إمباير ورلد',
    address: 'شارع كولان، أبراج إمباير، أربيل',
    lat: 36.2025,
    lng: 43.9920,
    phone: '+9647504433221',
    whatsapp: '+9647504433221',
    description: 'صالون ومركز تجميل نسائي عالمي يقدم أرقى تسريحات ومكياج العرائس، العناية بالبشرة والأظافر وعلاجات الشعر المتطورة بأحدث المنتجات الفرنسية والإيطالية.',
    descriptionEn: 'World-class luxury beauty lounge offering haute coiffure, bridal artistry, advanced skin therapies and organic hair treatments in Erbil.',
    rating: 4.95,
    reviewCount: 230,
    startingPrice: 25000,
    coverImage: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&auto=format&fit=crop&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&auto=format&fit=crop&q=80',
    ],
    isVerified: true,
    isFeatured: true,
    status: 'approved',
    workingHours: defaultWorkingHours,
    features: ['قسم خاص للعرائس', 'أخصائيات تجميل دوليات', 'خصوصية تامة 100%', 'مواقف خاصة', 'سبا وعناية متكاملة', 'مشروبات فاخرة'],
    commissionRate: 10,
    ownerId: 'user_owner_2',
    createdAt: '2026-01-05T10:00:00Z',
  },
  {
    id: 'salon_3',
    name: 'إيليت باربر شوب',
    nameEn: 'Elite Barber Shop',
    slug: 'elite-barber-baghdad',
    type: 'men',
    city: 'baghdad',
    area: 'الكرادة',
    address: 'الكرادة داخل، تقاطع سبع قصور، بغداد',
    lat: 33.3050,
    lng: 44.4250,
    phone: '+9647805566778',
    whatsapp: '+9647805566778',
    description: 'أحدث صيحات قص الشعر وتشذيب اللحية مع جلسات تنظيف بشرة بالبخار وأقنعة الذهب لرجال الأعمال والشباب.',
    descriptionEn: 'Trendy cuts, bespoke beard sculpting, steam facials and 24k gold masks tailored for the modern gentleman.',
    rating: 4.8,
    reviewCount: 142,
    startingPrice: 12000,
    coverImage: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=1200&auto=format&fit=crop&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1512690459411-b9245aed614b?w=800&auto=format&fit=crop&q=80',
    ],
    isVerified: true,
    isFeatured: false,
    status: 'approved',
    workingHours: defaultWorkingHours,
    features: ['تنظيف بشرة هيدرافيشل', 'تشذيب لحية احترافي', 'موسيقى هادئة', 'دفع زين كاش وكي كارد'],
    commissionRate: 10,
    ownerId: 'user_owner_3',
    createdAt: '2026-01-12T10:00:00Z',
  },
  {
    id: 'salon_4',
    name: 'لونا بيوتي سنتر',
    nameEn: 'Luna Beauty & Spa Center',
    slug: 'luna-beauty-baghdad',
    type: 'women',
    city: 'baghdad',
    area: 'الجادرية',
    address: 'قرب مجمع الوزراء، شارع الجامعة، الجادرية، بغداد',
    lat: 33.2840,
    lng: 44.3850,
    phone: '+9647718899001',
    whatsapp: '+9647718899001',
    description: 'مركز تجميل متكامل للعناية بالبشرة والشعر، ميكب آرتست معتمدات، مانيكير وباديكير، وتجهيز العرائس بأجمل الإطلالات.',
    descriptionEn: 'Full-service beauty and spa center offering signature hair transformations, certified bridal makeup, nail art and holistic skin therapies.',
    rating: 4.88,
    reviewCount: 195,
    startingPrice: 20000,
    coverImage: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=1200&auto=format&fit=crop&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?w=800&auto=format&fit=crop&q=80',
    ],
    isVerified: true,
    isFeatured: true,
    status: 'approved',
    workingHours: defaultWorkingHours,
    features: ['ميكب آرتست محترفات', 'أحدث أجهزة العناية بالبشرة', 'باقات عرائس شاملة', 'مواقف خاصة', 'أجواء استرخاء هادئة'],
    commissionRate: 10,
    ownerId: 'user_owner_4',
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'salon_5',
    name: 'صالون الأكابر للرجال',
    nameEn: 'Al-Akaber Gentlemen Salon',
    slug: 'alakaber-basra',
    type: 'men',
    city: 'basra',
    area: 'البريهية',
    address: 'شارع 14 تموز، قرب الكورنيش، البصرة',
    lat: 30.5120,
    lng: 47.8300,
    phone: '+9647812233445',
    whatsapp: '+9647812233445',
    description: 'الصالون الأرقى في البصرة لقصات الشعر الكلاسيكية والحديثة وتصميم اللحى والعناية المتكاملة بالوجه.',
    descriptionEn: 'The premier gentlemen grooming destination in Basra for refined cuts, beard grooming and facial care.',
    rating: 4.78,
    reviewCount: 96,
    startingPrice: 10000,
    coverImage: 'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?w=1200&auto=format&fit=crop&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?w=800&auto=format&fit=crop&q=80',
    ],
    isVerified: true,
    isFeatured: false,
    status: 'approved',
    workingHours: defaultWorkingHours,
    features: ['جلسات مساج للرأس والكتف', 'حلاقة ذقن بالمنشفة الساخنة', 'مكان انتظار مريح'],
    commissionRate: 10,
    ownerId: 'user_owner_5',
    createdAt: '2026-01-20T10:00:00Z',
  },
  {
    id: 'salon_6',
    name: 'صالون تاج الحلاقة الملكي',
    nameEn: 'Crown Barber Studio',
    slug: 'crown-barber-nasiriyah',
    type: 'men',
    city: 'nasiriyah',
    area: 'شارع الحبوبي',
    address: 'شارع الحبوبي، قرب ساحة الحبوبي، الناصرية، ذي قار',
    lat: 31.0560,
    lng: 46.2610,
    phone: '+9647809988776',
    whatsapp: '+9647809988776',
    description: 'أفضل صالون حلاقة رجالي في الناصرية، خدمات حلاقة راقية مع تنظيف بشرة عميق وتصفيف شعر بأعلى المعايير.',
    descriptionEn: 'Top-tier gentlemen barber studio in Nasiriyah offering master haircuts, luxury hot towel shaves and skin rejuvenation.',
    rating: 4.85,
    reviewCount: 112,
    startingPrice: 10000,
    coverImage: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=1200&auto=format&fit=crop&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&auto=format&fit=crop&q=80',
    ],
    isVerified: true,
    isFeatured: true,
    status: 'approved',
    workingHours: defaultWorkingHours,
    features: ['حلاقة ذقن احترافية', 'أحدث منتجات العناية بالبشرة', 'سرعة ودقة في المواعيد', 'موقع مركزي'],
    commissionRate: 10,
    ownerId: 'user_owner_6',
    createdAt: '2026-01-22T10:00:00Z',
  },
  {
    id: 'salon_7',
    name: 'فلور بيوتي لاونج',
    nameEn: 'Fleur Beauty Lounge',
    slug: 'fleur-beauty-nasiriyah',
    type: 'women',
    city: 'nasiriyah',
    area: 'حي أور',
    address: 'شارع النيل، مجاور مجمع النخيل، الناصرية',
    lat: 31.0480,
    lng: 46.2520,
    phone: '+9647803344556',
    whatsapp: '+9647803344556',
    description: 'صالون نسائي راقي يقدم أحدث صيحات صبغ الشعر، المعالجات الملكية للشعر (بروتين وفيلر)، مكياج وتجهيز عرائس.',
    descriptionEn: 'Exclusive ladies beauty lounge in Nasiriyah specializing in hair color masterpieces, organic hair fillers, and bridal packages.',
    rating: 4.9,
    reviewCount: 88,
    startingPrice: 18000,
    coverImage: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1200&auto=format&fit=crop&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=800&auto=format&fit=crop&q=80',
    ],
    isVerified: true,
    isFeatured: false,
    status: 'approved',
    workingHours: defaultWorkingHours,
    features: ['علاجات بروتين وفيلر للشعر', 'تجهيز عرائس كامل', 'جلسات أظافر ومانيكير', 'خصوصية تامة'],
    commissionRate: 10,
    ownerId: 'user_owner_7',
    createdAt: '2026-01-25T10:00:00Z',
  },
  {
    id: 'salon_8',
    name: 'صالون وسبا فيرونا الفاخر',
    nameEn: 'Verona Luxury Spa & Salon',
    slug: 'verona-najaf',
    type: 'women',
    city: 'najaf',
    area: 'حي الغدير',
    address: 'شارع الروان، النجف الأشرف',
    lat: 32.0150,
    lng: 44.3480,
    phone: '+9647814455667',
    whatsapp: '+9647814455667',
    description: 'صالون تجميل نسائي فاخر يقدم خدمات العناية بالبشرة، تسريحات السهرات، تركيب الأظافر ومساج الاسترخاء.',
    descriptionEn: 'Luxury ladies spa and salon in Najaf offering holistic skincare, evening hairstyles, nail sculpting and relaxing massages.',
    rating: 4.82,
    reviewCount: 75,
    startingPrice: 20000,
    coverImage: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=1200&auto=format&fit=crop&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&auto=format&fit=crop&q=80',
    ],
    isVerified: true,
    isFeatured: false,
    status: 'approved',
    workingHours: defaultWorkingHours,
    features: ['مساج استرخائي', 'تنظيف بشرة ملكي', 'أحدث ألوان صبغات الشعر'],
    commissionRate: 10,
    ownerId: 'user_owner_8',
    createdAt: '2026-02-01T10:00:00Z',
  }
];

export const initialBarbers: Barber[] = [
  // Royal Lounge Barbers (Salon 1)
  {
    id: 'barber_1_1',
    salonId: 'salon_1',
    name: 'حيدر الكوافير',
    nameEn: 'Haider Al-Kawafeir',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    title: 'ماستر باربر وخبير قصات VIP',
    titleEn: 'Master Barber & VIP Stylist',
    experienceYears: 12,
    rating: 4.95,
    reviewCount: 98,
    specializations: ['قصات كلاسيكية ومودرن', 'تشذيب اللحية الملكي', 'صبغات وتصفيف شعر'],
    isAvailable: true,
    phone: '+9647701122334',
  },
  {
    id: 'barber_1_2',
    salonId: 'salon_1',
    name: 'عمر التميمي',
    nameEn: 'Omar Al-Tamimi',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    title: 'أخصائي قص ولحية وتنظيف بشرة',
    titleEn: 'Senior Barber & Facialist',
    experienceYears: 8,
    rating: 4.85,
    reviewCount: 65,
    specializations: ['تنظيف بشرة هيدرافيشل', 'تدريج الشعر الفيد', 'معالجة اللحية بالزيوت'],
    isAvailable: true,
  },
  {
    id: 'barber_1_3',
    salonId: 'salon_1',
    name: 'علي السامرائي',
    nameEn: 'Ali Al-Samarrai',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
    title: 'مصفف شعر العرسان',
    titleEn: 'Bridal & Groom Hair Specialist',
    experienceYears: 6,
    rating: 4.9,
    reviewCount: 42,
    specializations: ['باقات العريس', 'بروتين وتمليس الشعر', 'رسم وتحديد اللحية'],
    isAvailable: true,
  },

  // Maison de Beauté Specialists (Salon 2)
  {
    id: 'barber_2_1',
    salonId: 'salon_2',
    name: 'سارة لوران (ميكب آرتست)',
    nameEn: 'Sara Laurent',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
    title: 'خبيرة تجميل وميكب عرائس دولية',
    titleEn: 'Lead Makeup Artist & Bridal Director',
    experienceYears: 10,
    rating: 4.98,
    reviewCount: 130,
    specializations: ['مكياج سينمائي وعرائس', 'كونتور ونحت الوجه', 'رموش واكستنشن'],
    isAvailable: true,
  },
  {
    id: 'barber_2_2',
    salonId: 'salon_2',
    name: 'ديانا الجاف (مصففة شعر)',
    nameEn: 'Diana Al-Jaff',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
    title: 'أخصائية صبغات وتسريحات ملكية',
    titleEn: 'Senior Colorist & Hair Sculptor',
    experienceYears: 7,
    rating: 4.9,
    reviewCount: 88,
    specializations: ['بالياج وأومبري فرنسي', 'تسريحات سهرات وعرائس', 'معالجة الشعر بالكولاجين'],
    isAvailable: true,
  },

  // Elite Barber (Salon 3)
  {
    id: 'barber_3_1',
    salonId: 'salon_3',
    name: 'كرم البغدادي',
    nameEn: 'Karam Al-Baghdadi',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80',
    title: 'حلاق محترف وستايلست',
    titleEn: 'Lead Stylist',
    experienceYears: 9,
    rating: 4.88,
    reviewCount: 78,
    specializations: ['حلاقة ذقن إيطالية', 'قصات حديثة', 'ماسك فحم وتنظيف'],
    isAvailable: true,
  },

  // Crown Barber Nasiriyah (Salon 6)
  {
    id: 'barber_6_1',
    salonId: 'salon_6',
    name: 'سجاد الغراوي',
    nameEn: 'Sajjad Al-Gharrawi',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
    title: 'كبير حلاقي تاج الحلاقة',
    titleEn: 'Senior Master Barber',
    experienceYears: 11,
    rating: 4.92,
    reviewCount: 94,
    specializations: ['قصات شبابية وكلاسيكية', 'تحديد اللحية بالشفرة الحادة', 'بخار وجه وسيروم'],
    isAvailable: true,
  }
];

export const initialServices: Service[] = [
  // Salon 1: Royal Lounge (Men)
  {
    id: 'srv_1_1',
    salonId: 'salon_1',
    name: 'قص شعر ملكي + استشوار + غسيل',
    nameEn: 'Royal Haircut, Styling & Wash',
    category: 'haircut',
    categoryEn: 'Haircut',
    description: 'قص شعر احترافي مع تدريج دقيق وغسيل بشامبو أرغان طبيعي وتصفيف بالاستشوار والواكس الفاخر.',
    price: 15000,
    durationMinutes: 30,
    isPopular: true,
    image: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'srv_1_2',
    salonId: 'salon_1',
    name: 'حلاقة وتشذيب اللحية بالمنشفة الساخنة',
    nameEn: 'Hot Towel Beard Grooming & Razor Line',
    category: 'beard',
    categoryEn: 'Beard',
    description: 'تحديد اللحية بدقة فائقة مع مساج بالزيوت الطبيعية والمنشفة الساخنة لفتح المسام وتنعيم البشرة.',
    price: 8000,
    durationMinutes: 20,
    isPopular: true,
    image: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'srv_1_3',
    salonId: 'salon_1',
    name: 'باقة رويال الشاملة (قص + ذقن + تنظيف بشرة)',
    nameEn: 'Royal Full Package (Cut + Beard + Facial)',
    category: 'packages',
    categoryEn: 'Packages',
    description: 'الباقة الأكثر طلباً: قص شعر + حلاقة ذقن بالبخار + ماسك كولاجين للوجه + تدليك الرأس والكتفين.',
    price: 30000,
    durationMinutes: 60,
    isPopular: true,
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'srv_1_4',
    salonId: 'salon_1',
    name: 'جلسة تنظيف بشرة هيدرافيشل وماسك الذهب',
    nameEn: 'HydraFacial Deep Clean & 24K Gold Mask',
    category: 'skincare',
    categoryEn: 'Skin Care',
    description: 'تنظيف عميق للمسامات بجهاز الهيدرافيشل وسيروم الهيالورونيك مع قناع الذهب لإنعاش البشرة وإزالة الرؤوس السوداء.',
    price: 25000,
    durationMinutes: 45,
    image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'srv_1_5',
    salonId: 'salon_1',
    name: 'صبغة وتغطية الشيب مع بروتين مقوي',
    nameEn: 'Beard / Hair Color & Protein Blend',
    category: 'color',
    categoryEn: 'Hair Color',
    description: 'صبغة طبيعية بلون مطابق تماماً تدوم طويلاً خالية من الأمونيا مع معالج لحماية ألياف الشعر.',
    price: 20000,
    durationMinutes: 40,
    image: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&auto=format&fit=crop&q=80',
  },

  // Salon 2: Maison de Beauté (Women)
  {
    id: 'srv_2_1',
    salonId: 'salon_2',
    name: 'قص شعر وتصفيف سشوار إيطالي',
    nameEn: 'Haute Cut & Italian Blowout',
    category: 'haircut',
    categoryEn: 'Haircut',
    description: 'قص وتدريج الشعر حسب شكل الوجه مع غسيل بحمام زيت الأرغان وتصفيف سشوار حريري.',
    price: 35000,
    durationMinutes: 45,
    isPopular: true,
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'srv_2_2',
    salonId: 'salon_2',
    name: 'مكياج سهرة ومناسبات VIP',
    nameEn: 'VIP Glam Makeup & Lashes',
    category: 'makeup',
    categoryEn: 'Makeup',
    description: 'مكياج احترافي بأرقى الماركات العالمية (Dior, Charlotte Tilbury) مع تركيب رموش 3D طبيعية.',
    price: 60000,
    durationMinutes: 60,
    isPopular: true,
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'srv_2_3',
    salonId: 'salon_2',
    name: 'صبغة بالياج وأولابلكس متطور',
    nameEn: 'French Balayage & Olaplex Therapy',
    category: 'color',
    categoryEn: 'Hair Color',
    description: 'صبغة متدرجة طبيعية مع معالج أولابلكس لحماية الشعر من التلف وإعطائه لمعاناً ساحراً.',
    price: 90000,
    durationMinutes: 120,
    isPopular: true,
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'srv_2_4',
    salonId: 'salon_2',
    name: 'مانيكير وباديكير مع جل نيل آرت',
    nameEn: 'Spa Manicure & Pedicure with Gel Art',
    category: 'nails',
    categoryEn: 'Nails',
    description: 'تقشير وترطيب اليدين والقدمين مع مساج دافئ وإزالة الجلد الميت وطلاء جل يدوم 4 أسابيع.',
    price: 30000,
    durationMinutes: 50,
    image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'srv_2_5',
    salonId: 'salon_2',
    name: 'باقة العروس الملكية الكاملة',
    nameEn: 'Royal Bridal Full Suite',
    category: 'bridal',
    categoryEn: 'Bridal',
    description: 'تجهيز كامل للعروس: مكياج عرائس ملكي + تسريحة شعر فخمة + عناية بالبشرة + مانيكير وباديكير + جناح استرخاء خاص.',
    price: 300000,
    durationMinutes: 240,
    image: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=400&auto=format&fit=crop&q=80',
  },

  // Salon 6: Crown Barber Nasiriyah
  {
    id: 'srv_6_1',
    salonId: 'salon_6',
    name: 'قص شعر وشعر اللحية + ماسك بخار',
    nameEn: 'Nasiriyah Crown Cut & Hot Steam',
    category: 'haircut',
    categoryEn: 'Haircut',
    description: 'قص شعر وتحديد اللحية بدقة مع جلسة بخار سريعة وماسك النعناع المنعش.',
    price: 15000,
    durationMinutes: 40,
    isPopular: true,
    image: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=400&auto=format&fit=crop&q=80',
  }
];

export const initialBookings: Booking[] = [
  {
    id: 'bk_1',
    bookingNumber: 'HLQ-2026-9842',
    salonId: 'salon_1',
    salonName: 'رويال لاونج للحلاقة الرجالية',
    salonAddress: 'شارع 14 رمضان، المنصور، بغداد',
    salonPhone: '+9647701122334',
    salonType: 'men',
    serviceId: 'srv_1_3',
    serviceName: 'باقة رويال الشاملة (قص + ذقن + تنظيف بشرة)',
    barberId: 'barber_1_1',
    barberName: 'حيدر الكوافير',
    customerId: 'user_cust_1',
    customerName: 'أحمد الموسوي',
    customerPhone: '+9647801234567',
    date: '2026-08-20',
    timeSlot: '17:00',
    durationMinutes: 60,
    price: 30000,
    discountAmount: 3000,
    finalPrice: 27000,
    commissionAmount: 2700,
    salonPayout: 24300,
    status: 'confirmed',
    paymentMethod: 'cash',
    paymentStatus: 'unpaid',
    createdAt: '2026-08-19T06:00:00Z',
    notes: 'يرجى التجهيز في جناح VIP إن أمكن',
  },
  {
    id: 'bk_2',
    bookingNumber: 'HLQ-2026-9104',
    salonId: 'salon_1',
    salonName: 'رويال لاونج للحلاقة الرجالية',
    salonAddress: 'شارع 14 رمضان، المنصور، بغداد',
    salonPhone: '+9647701122334',
    salonType: 'men',
    serviceId: 'srv_1_1',
    serviceName: 'قص شعر ملكي + استشوار + غسيل',
    barberId: 'barber_1_2',
    barberName: 'عمر التميمي',
    customerId: 'user_cust_1',
    customerName: 'أحمد الموسوي',
    customerPhone: '+9647801234567',
    date: '2026-08-12',
    timeSlot: '15:30',
    durationMinutes: 30,
    price: 15000,
    finalPrice: 15000,
    commissionAmount: 1500,
    salonPayout: 13500,
    status: 'completed',
    paymentMethod: 'zain_cash',
    paymentStatus: 'paid',
    createdAt: '2026-08-11T12:00:00Z',
    rated: true,
  },
];

export const initialReviews: Review[] = [
  {
    id: 'rev_1',
    salonId: 'salon_1',
    salonName: 'رويال لاونج للحلاقة الرجالية',
    bookingId: 'bk_2',
    customerId: 'user_cust_1',
    customerName: 'أحمد الموسوي',
    customerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    rating: 5,
    comment: 'أفضل تجربة حلاقة في بغداد بلا منازع! الكابتن حيدر فنان واستقبال رائع وضيافة تليق بالمكان. أنصح به بشدة.',
    createdAt: '2026-08-12T17:00:00Z',
    reply: 'شكراً جزيلاً أستاذ أحمد، شرفتنا دائماً ويسعدنا تقديم الأفضل لكم.',
    replyDate: '2026-08-12T18:30:00Z',
  },
  {
    id: 'rev_2',
    salonId: 'salon_1',
    salonName: 'رويال لاونج للحلاقة الرجالية',
    bookingId: 'bk_demo_1',
    customerId: 'user_demo_2',
    customerName: 'سيف العبيدي',
    rating: 5,
    comment: 'النظافة والتعقيم عالي جداً والمواعيد دقيقة بالدقيقة عبر تطبيق حلاقي. لا يوجد أي انتظار.',
    createdAt: '2026-08-14T14:15:00Z',
  },
  {
    id: 'rev_3',
    salonId: 'salon_2',
    salonName: 'ميزون دو بوتيه للتجميل النسائي',
    bookingId: 'bk_demo_3',
    customerId: 'user_demo_3',
    customerName: 'مريم الكردي',
    rating: 5,
    comment: 'صالون فخم جداً وميكب ديانا كان ساحر في يوم خطوبتي. شكراً من القلب لكل الكادر.',
    createdAt: '2026-08-16T19:00:00Z',
  }
];

export const initialCoupons: Coupon[] = [
  {
    id: 'cp_1',
    code: 'HALAQI10',
    discountPercent: 10,
    maxDiscount: 10000,
    minBookingAmount: 10000,
    validUntil: '2026-12-31',
    usageCount: 148,
    maxUsage: 1000,
    isActive: true,
  },
  {
    id: 'cp_2',
    code: 'BAGHDAD20',
    discountPercent: 20,
    maxDiscount: 20000,
    minBookingAmount: 25000,
    validUntil: '2026-09-30',
    usageCount: 76,
    maxUsage: 200,
    isActive: true,
  },
  {
    id: 'cp_3',
    code: 'VIPBEAUTY',
    discountPercent: 15,
    maxDiscount: 35000,
    minBookingAmount: 50000,
    validUntil: '2026-10-31',
    usageCount: 39,
    maxUsage: 150,
    isActive: true,
  },
];

export const initialNotifications: Notification[] = [
  {
    id: 'notif_1',
    userId: 'user_cust_1',
    title: 'تأكيد الحجز بنجاح',
    titleEn: 'Booking Confirmed',
    message: 'تم تأكيد حجزك رقم HLQ-2026-9842 في رويال لاونج غداً الساعة 05:00 م.',
    messageEn: 'Your booking HLQ-2026-9842 at Royal Lounge is confirmed for tomorrow at 05:00 PM.',
    type: 'booking_confirmed',
    read: false,
    createdAt: '2026-08-19T06:00:00Z',
    link: '/bookings',
  },
  {
    id: 'notif_2',
    userId: 'user_cust_1',
    title: 'عرض ترويجي حصري: خصم 20%',
    titleEn: 'Exclusive Promo: 20% Off',
    message: 'استخدم الكود BAGHDAD20 للحصول على خصم 20% على حجوزات باقات VIP.',
    messageEn: 'Use promo code BAGHDAD20 for 20% off on VIP packages.',
    type: 'offer',
    read: true,
    createdAt: '2026-08-18T10:00:00Z',
    link: '/offers',
  },
];

export const initialSettings: PlatformSettings = {
  commissionRate: 10,
  currency: 'IQD',
  currencySymbol: 'د.ع',
  supportPhone: '+9647800000000',
  supportEmail: 'support@halaqi.iq',
  termsAr: `مرحباً بك في منصة "حلاقي | HALAQI". باستخدامك للمنصة، فإنك توافق على الشروط والأحكام التالية:
1. الالتزام بمواعيد الحجوزات والحضور قبل الموعد بـ 10 دقائق على الأقل.
2. يحق للزبون إلغاء الحجز مجاناً قبل ساعتين على الأقل من موعد الحجز.
3. تلتزم الصالونات المعتمدة بتقديم الخدمات بنفس الأسعار والمواصفات المحددة بالمنصة.
4. تخضع العمولات لسياسة المنصة الرسمية ويتم اقتطاعها تلقائياً من المبيعات.`,
  termsEn: `Welcome to HALAQI. By using the platform, you agree to comply with all platform terms, attendance punctuality and cancellation rules.`,
  privacyAr: `خصوصية بياناتك أولويتنا في حلاقي:
1. نحن نستخدم بيانات رقم الهاتف والاسم فقط لتأكيد وتنسيق المواعيد مع الصالون.
2. لا يتم مشاركة بيانات الدفع أو معلوماتك الشخصية مع أي طرف ثالث.
3. يتم استخدام الموقع الجغرافي فقط لعرض أقرب الصالونات إليك بدقة.`,
  privacyEn: `Your privacy is our priority. We only use your location to calculate nearby salon distances and your contact to facilitate your appointment confirmation.`,
  cancellationAr: `سياسة الإلغاء في حلاقي:
- يمكن إلغاء أي حجز قادم مجاناً قبل موعد الحجز بساعتين.
- عند الإلغاء، يتم تحرير الوقت فوراً ليتاح لزبائن آخرين.
- في حال تكرار عدم الحضور بدون إلغاء مسبق، قد يتم تقييد الحجز المباشر.`,
  cancellationEn: `Cancellation is free up to 2 hours prior to the scheduled slot. Upon cancellation, the time slot is automatically released.`,
  refundAr: `سياسة الاسترجاع:
- في حال الدفع الإلكتروني المسبق وإلغاء الحجز وفق الشروط، يُعاد المبلغ كاملاً إلى المحفظة الإلكترونية خلال 24 ساعة عمل.`,
  refundEn: `Refunds for eligible pre-payments are processed back to the original method within 24 hours.`,
};

// In-memory atomic state store
class DatabaseStore {
  private state: DatabaseState;

  constructor() {
    this.state = {
      users: [...initialUsers],
      salons: [...initialSalons],
      barbers: [...initialBarbers],
      services: [...initialServices],
      bookings: [...initialBookings],
      reviews: [...initialReviews],
      salonPosts: [],
      postComments: [],
      postLikes: [],
      coupons: [...initialCoupons],
      notifications: [...initialNotifications],
      cities: [...initialCities],
      blockedTimes: [],
      favorites: [
        { userId: 'user_cust_1', salonId: 'salon_1' },
        { userId: 'user_cust_1', salonId: 'salon_2' },
      ],
      settings: { ...initialSettings },
      auditLogs: [...initialAuditLogs],
    };
  }

  // Neon salon operations
  // Find an existing pending/approved salon directly in Neon.
  // This prevents duplicate requests even after refresh/restart.


  async getAllSalonsFromNeon(): Promise<Salon[]> {
    const rows = await sql`
      SELECT *
      FROM salons
      ORDER BY created_at DESC
    `;

    return rows.map((s: any) => ({
      id: s.id,
      name: s.name,
      nameEn: s.name_en,
      slug: s.slug,
      type: s.type,
      city: s.city,
      area: s.area,
      address: s.address,
      lat: Number(s.lat || 0),
      lng: Number(s.lng || 0),
      phone: s.phone,
      whatsapp: s.whatsapp,
      description: s.description,
      descriptionEn: s.description_en,
      rating: Number(s.rating || 0),
      reviewCount: Number(s.review_count || 0),
      startingPrice: Number(s.starting_price || 0),
      coverImage: s.cover_image,
      gallery: s.gallery || [],
      isVerified: s.is_verified ?? false,
      isFeatured: s.is_featured ?? false,
      status: s.status,
      ownerId: s.owner_id,
      workingHours: s.working_hours || defaultWorkingHours,
      features: s.features || [],
      createdAt: new Date(s.created_at).toISOString(),
    }));
  }

  async getServicesBySalonFromNeon(salonId: string): Promise<Service[]> {
    const rows = await sql`
      SELECT *
      FROM services
      WHERE salon_id = ${salonId}
      ORDER BY id ASC
    `;

    return rows.map((sv: any) => ({
      id: sv.id,
      salonId: sv.salon_id,
      name: sv.name,
      nameEn: sv.name_en,
      category: sv.category,
      categoryEn: sv.category_en,
      description: sv.description,
      price: Number(sv.price || 0),
      durationMinutes: Number(sv.duration_minutes || 0),
      image: sv.image || undefined,
      barberIds: sv.barber_ids || [],
      isPopular: sv.is_popular ?? false,
    }));
  }

  async createServiceInNeon(service: Service): Promise<Service | undefined> {
    try {
      const rows = await sql`
        INSERT INTO services (
          id,
          salon_id,
          name,
          name_en,
          category,
          category_en,
          description,
          price,
          duration_minutes,
          image,
          barber_ids,
          is_popular
        )
        VALUES (
          ${service.id},
          ${service.salonId},
          ${service.name},
          ${service.nameEn ?? null},
          ${service.category ?? null},
          ${service.categoryEn ?? null},
          ${service.description ?? null},
          ${service.price ?? 0},
          ${service.durationMinutes ?? 0},
          ${service.image ?? null},
          ${JSON.stringify(service.barberIds ?? [])}::jsonb,
          ${service.isPopular ?? false}
        )
        RETURNING *
      `;

      const s: any = rows[0];
      if (!s) return undefined;

      return {
        id: s.id,
        salonId: s.salon_id,
        name: s.name,
        nameEn: s.name_en ?? '',
        category: s.category ?? '',
        categoryEn: s.category_en ?? '',
        description: s.description ?? '',
        price: Number(s.price || 0),
        durationMinutes: Number(s.duration_minutes || 0),
        image: s.image ?? undefined,
        barberIds: s.barber_ids || [],
        isPopular: s.is_popular ?? false,
      };
    } catch (error: any) {
      console.error('[SERVICE_CREATE] Failed to save service to Neon:', error);
      return undefined;
    }
  }

  async updateServiceInNeon(
    serviceId: string,
    updates: Partial<Service>
  ): Promise<Service | undefined> {
    try {
      const current = await this.getServiceByIdFromNeon(serviceId);
      if (!current) return undefined;

      const next = {
        ...current,
        ...updates,
        id: current.id,
        salonId: current.salonId,
      };

      const rows = await sql`
        UPDATE services
        SET
          name = ${next.name},
          name_en = ${next.nameEn ?? null},
          category = ${next.category ?? null},
          category_en = ${next.categoryEn ?? null},
          description = ${next.description ?? null},
          price = ${next.price ?? 0},
          duration_minutes = ${next.durationMinutes ?? 0},
          image = ${next.image ?? null},
          barber_ids = ${JSON.stringify(next.barberIds ?? [])}::jsonb,
          is_popular = ${next.isPopular ?? false}
        WHERE id = ${serviceId}
        RETURNING *
      `;

      const sv: any = rows[0];
      if (!sv) return undefined;

      return {
        id: sv.id,
        salonId: sv.salon_id,
        name: sv.name,
        nameEn: sv.name_en ?? '',
        category: sv.category ?? '',
        categoryEn: sv.category_en ?? '',
        description: sv.description ?? '',
        price: Number(sv.price || 0),
        durationMinutes: Number(sv.duration_minutes || 0),
        image: sv.image ?? undefined,
        barberIds: sv.barber_ids || [],
        isPopular: sv.is_popular ?? false,
      };
    } catch (error: any) {
      console.error(
        '[SERVICE_UPDATE] Failed to update service in Neon:',
        error?.message || error
      );
      return undefined;
    }
  }

  async deleteServiceFromNeon(serviceId: string): Promise<boolean> {
    try {
      const rows = await sql`
        DELETE FROM services
        WHERE id = ${serviceId}
        RETURNING id
      `;

      return rows.length > 0;
    } catch (error: any) {
      console.error(
        '[SERVICE_DELETE] Failed to delete service from Neon:',
        error?.message || error
      );
      return false;
    }
  }

  async getServiceByIdFromNeon(serviceId: string): Promise<Service | undefined> {
    const rows = await sql`
      SELECT *
      FROM services
      WHERE id = ${serviceId}
      LIMIT 1
    `;

    if (!rows.length) return undefined;

    const sv: any = rows[0];

    return {
      id: sv.id,
      salonId: sv.salon_id,
      name: sv.name,
      nameEn: sv.name_en,
      category: sv.category,
      categoryEn: sv.category_en,
      description: sv.description,
      price: Number(sv.price || 0),
      durationMinutes: Number(sv.duration_minutes || 0),
      image: sv.image || undefined,
      barberIds: sv.barber_ids || [],
      isPopular: sv.is_popular ?? false,
    };
  }

  async getSalonByIdFromNeon(salonId: string): Promise<Salon | undefined> {
    const rows = await sql`
      SELECT *
      FROM salons
      WHERE id = ${salonId}
      LIMIT 1
    `;

    if (!rows.length) return undefined;

    const s: any = rows[0];

    return {
      id: s.id,
      name: s.name,
      nameEn: s.name_en,
      slug: s.slug,
      type: s.type,
      city: s.city,
      area: s.area,
      address: s.address,
      lat: Number(s.lat || 0),
      lng: Number(s.lng || 0),
      phone: s.phone,
      whatsapp: s.whatsapp,
      description: s.description,
      descriptionEn: s.description_en,
      rating: Number(s.rating || 0),
      reviewCount: Number(s.review_count || 0),
      startingPrice: Number(s.starting_price || 0),
      coverImage: s.cover_image,
      gallery: s.gallery || [],
      isVerified: s.is_verified ?? false,
      isFeatured: s.is_featured ?? false,
      status: s.status,
      ownerId: s.owner_id,
      workingHours: s.working_hours || defaultWorkingHours,
      features: s.features || [],
      createdAt: new Date(s.created_at).toISOString(),
    };
  }

  async getApprovedSalonsFromNeon(): Promise<Salon[]> {
    const rows = await sql`
      SELECT *
      FROM salons
      WHERE status = 'approved'
      ORDER BY created_at DESC
    `;

    return rows.map((s: any) => ({
      id: s.id,
      name: s.name,
      nameEn: s.name_en,
      slug: s.slug,
      type: s.type,
      city: s.city,
      area: s.area,
      address: s.address,
      lat: Number(s.lat || 0),
      lng: Number(s.lng || 0),
      phone: s.phone,
      whatsapp: s.whatsapp,
      description: s.description,
      descriptionEn: s.description_en,
      rating: Number(s.rating || 0),
      reviewCount: Number(s.review_count || 0),
      startingPrice: Number(s.starting_price || 0),
      coverImage: s.cover_image,
      gallery: s.gallery || [],
      isVerified: s.is_verified ?? false,
      isFeatured: s.is_featured ?? false,
      status: s.status,
      ownerId: s.owner_id,
      workingHours: s.working_hours || defaultWorkingHours,
      features: s.features || [],
      createdAt: new Date(s.created_at).toISOString(),
    }));
  }

  async getBannedSalonByOwnerFromNeon(userId: string): Promise<Salon | undefined> {
    const rows = await sql`
      SELECT *
      FROM salons
      WHERE owner_id = ${userId}
        AND status = 'banned'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!rows.length) return undefined;

    const s: any = rows[0];

    return {
      id: s.id,
      name: s.name,
      nameEn: s.name_en,
      slug: s.slug,
      type: s.type,
      city: s.city,
      area: s.area,
      address: s.address,
      lat: Number(s.lat || 0),
      lng: Number(s.lng || 0),
      phone: s.phone,
      whatsapp: s.whatsapp,
      description: s.description,
      descriptionEn: s.description_en,
      rating: Number(s.rating || 0),
      reviewCount: Number(s.review_count || 0),
      startingPrice: Number(s.starting_price || 0),
      coverImage: s.cover_image,
      gallery: s.gallery || [],
      isVerified: s.is_verified ?? false,
      isFeatured: s.is_featured ?? false,
      status: s.status,
      ownerId: s.owner_id,
      workingHours: s.working_hours || defaultWorkingHours,
      features: s.features || [],
      createdAt: new Date(s.created_at).toISOString(),
    };
  }

  async getSalonByOwnerFromNeon(userId: string): Promise<Salon | undefined> {
    const rows = await sql`
      SELECT *
      FROM salons
      WHERE owner_id = ${userId}
        AND status IN ('pending', 'approved')
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!rows.length) return undefined;

    const s: any = rows[0];

    return {
      id: s.id,
      name: s.name,
      nameEn: s.name_en,
      slug: s.slug,
      type: s.type,
      city: s.city,
      area: s.area,
      address: s.address,
      lat: Number(s.lat || 0),
      lng: Number(s.lng || 0),
      phone: s.phone,
      whatsapp: s.whatsapp,
      description: s.description,
      descriptionEn: s.description_en,
      rating: Number(s.rating || 0),
      reviewCount: Number(s.review_count || 0),
      startingPrice: Number(s.starting_price || 0),
      coverImage: s.cover_image,
      gallery: s.gallery || [],
      isVerified: s.is_verified ?? false,
      isFeatured: s.is_featured ?? false,
      status: s.status,
      ownerId: s.owner_id,
      workingHours: s.working_hours || defaultWorkingHours,
      features: s.features || [],
      createdAt: new Date(s.created_at).toISOString(),
    };
  }

  async createSalonInNeon(salon: Salon): Promise<Salon | undefined> {
    const rows = await sql`
      INSERT INTO salons (
        id,
        name,
        name_en,
        slug,
        type,
        city,
        area,
        address,
        lat,
        lng,
        phone,
        whatsapp,
        description,
        description_en,
        rating,
        review_count,
        starting_price,
        cover_image,
        gallery,
        is_verified,
        is_featured,
        status,
        owner_id,
        working_hours,
        features,
        created_at
      )
      VALUES (
        ${salon.id},
        ${salon.name},
        ${salon.nameEn},
        ${salon.slug},
        ${salon.type},
        ${salon.city},
        ${salon.area},
        ${salon.address},
        ${salon.lat},
        ${salon.lng},
        ${salon.phone},
        ${salon.whatsapp},
        ${salon.description},
        ${salon.descriptionEn},
        ${salon.rating},
        ${salon.reviewCount},
        ${salon.startingPrice},
        ${salon.coverImage},
        ${JSON.stringify(salon.gallery || [])}::jsonb,
        ${salon.isVerified},
        ${salon.isFeatured ?? false},
        ${salon.status},
        ${salon.ownerId},
        ${JSON.stringify(salon.workingHours || defaultWorkingHours)}::jsonb,
        ${JSON.stringify(salon.features || [])}::jsonb,
        ${salon.createdAt}
      )
      RETURNING *
    `;

    if (!rows.length) return undefined;

    const s: any = rows[0];

    return {
      id: s.id,
      name: s.name,
      nameEn: s.name_en,
      slug: s.slug,
      type: s.type,
      city: s.city,
      area: s.area,
      address: s.address,
      lat: Number(s.lat || 0),
      lng: Number(s.lng || 0),
      phone: s.phone,
      whatsapp: s.whatsapp,
      description: s.description,
      descriptionEn: s.description_en,
      rating: Number(s.rating || 0),
      reviewCount: Number(s.review_count || 0),
      startingPrice: Number(s.starting_price || 0),
      coverImage: s.cover_image,
      gallery: s.gallery || [],
      isVerified: s.is_verified ?? false,
      isFeatured: s.is_featured ?? false,
      status: s.status,
      ownerId: s.owner_id,
      workingHours: s.working_hours || defaultWorkingHours,
      features: s.features || [],
      createdAt: new Date(s.created_at).toISOString(),
    };
  }

  async updateSalonStatusInNeon(
    salonId: string,
    status: string,
    isVerified?: boolean
  ): Promise<Salon | undefined> {
    const rows = await sql`
      UPDATE salons
      SET status = ${status},
          is_verified = COALESCE(${isVerified ?? null}, is_verified)
      WHERE id = ${salonId}
      RETURNING *
    `;

    if (!rows.length) return undefined;

    const s: any = rows[0];
    return {
      id: s.id,
      name: s.name,
      nameEn: s.name_en,
      slug: s.slug,
      type: s.type,
      city: s.city,
      area: s.area,
      address: s.address,
      lat: Number(s.lat),
      lng: Number(s.lng),
      phone: s.phone,
      whatsapp: s.whatsapp,
      description: s.description,
      descriptionEn: s.description_en,
      rating: Number(s.rating || 0),
      reviewCount: Number(s.review_count || 0),
      startingPrice: Number(s.starting_price || 0),
      coverImage: s.cover_image,
      gallery: s.gallery || [],
      isVerified: s.is_verified ?? false,
      isFeatured: s.is_featured ?? false,
      status: s.status,
      ownerId: s.owner_id,
      workingHours: s.working_hours || defaultWorkingHours,
      features: s.features || [],
      createdAt: new Date(s.created_at).toISOString(),
    };
  }

  async deleteSalonFromNeon(salonId: string): Promise<boolean> {
    const result = await sql`
      DELETE FROM salons
      WHERE id = ${salonId}
      RETURNING id
    `;

    return result.length > 0;
  }

  // Returns true when the owner already has a pending/approved salon.
  hasActiveSalonForOwner(userId: string): boolean {
    return this.state.salons.some(
      (salon) =>
        salon.ownerId === userId &&
        (salon.status === 'pending' || salon.status === 'approved')
    );
  }

  // Getters
  getState(): DatabaseState {
    return this.state;
  }

  // Sanitize user (strip passwordHash and salt before client response)
  sanitizeUser(user: UserWithAuth): User {
    const { passwordHash, salt, ...safeUser } = user;
    return safeUser;
  }

  // Find user by ID
  getAdminUsers(): UserWithAuth[] {
    return this.state.users.filter(
      (u) => u.role === 'admin' && u.isActive !== false && !u.isBanned
    );
  }

  getUserById(id: string): UserWithAuth | undefined {
    return this.state.users.find((u) => u.id === id);
  }


  async getUserByIdFromNeon(id: string): Promise<UserWithAuth | undefined> {
    const rows = await sql`
      SELECT id, name, email, phone, role, city, salon_id, avatar,
             password_hash, salt, is_active, is_banned, created_at,
             is_bot, bot_enabled, bio, is_premium, username
      FROM users
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!rows.length) return undefined;

    const u: any = rows[0];

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      city: u.city || 'baghdad',
      salonId: u.salon_id || undefined,
      avatar: u.avatar || undefined,
      passwordHash: u.password_hash || undefined,
      salt: u.salt || undefined,
      isActive: u.is_active ?? true,
      isBanned: u.is_banned ?? false,
      isBot: u.is_bot ?? false,
      botEnabled: u.bot_enabled ?? true,
      isPremium: u.is_premium ?? false,
      bio: u.bio || undefined,
      username: u.username || undefined,
      createdAt: new Date(u.created_at).toISOString(),
    };
  }

  async getBarberByIdFromNeon(id: string): Promise<Barber | undefined> {
    const rows = await sql`
      SELECT
        id,
        salon_id,
        name,
        name_en,
        avatar,
        title,
        title_en,
        experience_years,
        rating,
        review_count,
        specializations,
        is_available,
        phone
      FROM barbers
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!rows.length) return undefined;

    const b: any = rows[0];

    return {
      id: b.id,
      salonId: b.salon_id,
      name: b.name,
      nameEn: b.name_en,
      avatar: b.avatar,
      title: b.title,
      titleEn: b.title_en,
      experienceYears: Number(b.experience_years || 0),
      rating: Number(b.rating || 0),
      reviewCount: Number(b.review_count || 0),
      specializations: b.specializations || [],
      isAvailable: b.is_available ?? true,
      phone: b.phone || undefined,
    };
  }

  async getBarbersBySalonFromNeon(salonId: string): Promise<Barber[]> {
    const rows = await sql`
      SELECT
        id,
        salon_id,
        name,
        name_en,
        avatar,
        title,
        title_en,
        experience_years,
        rating,
        review_count,
        specializations,
        is_available,
        phone
      FROM barbers
      WHERE salon_id = ${salonId}
      ORDER BY id
    `;

    return rows.map((row: any) => ({
      id: row.id,
      salonId: row.salon_id,
      name: row.name,
      nameEn: row.name_en,
      avatar: row.avatar,
      title: row.title,
      titleEn: row.title_en,
      experienceYears: Number(row.experience_years || 0),
      rating: Number(row.rating || 0),
      reviewCount: Number(row.review_count || 0),
      specializations: row.specializations || [],
      isAvailable: row.is_available ?? true,
      phone: row.phone || undefined,
    }));
  }

  async persistUserToNeon(userId: string): Promise<boolean> {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return false;

    await sql`
      INSERT INTO users (
        id,
        name,
        email,
        phone,
        role,
        city,
        salon_id,
        avatar,
        password_hash,
        salt,
        is_active,
        is_banned,
        created_at,
        is_bot,
        bot_enabled,
        bio,
        username
      )
      VALUES (
        ${user.id},
        ${user.name},
        ${user.email},
        ${user.phone},
        ${user.role},
        ${user.city},
        ${user.salonId || null},
        ${user.avatar || null},
        ${user.passwordHash || null},
        ${user.salt || null},
        ${user.isActive},
        ${user.isBanned},
        ${user.createdAt},
        ${user.isBot ?? false},
        ${user.botEnabled ?? true},
        ${user.bio || null},
        ${user.username || null}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role,
        city = EXCLUDED.city,
        salon_id = EXCLUDED.salon_id,
        avatar = EXCLUDED.avatar,
        password_hash = EXCLUDED.password_hash,
        salt = EXCLUDED.salt,
        is_active = EXCLUDED.is_active,
        is_banned = EXCLUDED.is_banned,
        is_bot = EXCLUDED.is_bot,
        bot_enabled = EXCLUDED.bot_enabled,
        bio = EXCLUDED.bio,
        username = EXCLUDED.username
    `;

    return true;
  }

  // Find user by Email or Phone
  findUserByEmailOrPhone(identifier: string): UserWithAuth | undefined {
    const normalized = identifier.trim().toLowerCase();
    return this.state.users.find(
      (u) => u.email.toLowerCase() === normalized || u.phone === identifier.trim()
    );
  }

  // Find user by Email or Phone from Neon
  async findUserByEmailOrPhoneFromNeon(
    identifier: string
  ): Promise<UserWithAuth | undefined> {
    const normalized = identifier.trim().toLowerCase();
    const phone = identifier.trim();

    const rows = await sql`
      SELECT id, name, email, phone, role, city, salon_id, avatar,
             password_hash, salt, is_active, is_banned, created_at,
             is_bot, bot_enabled, bio, username
      FROM users
      WHERE LOWER(email) = ${normalized}
         OR phone = ${phone}
      LIMIT 1
    `;

    if (!rows.length) return undefined;

    const u: any = rows[0];

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      city: u.city || 'baghdad',
      salonId: u.salon_id || undefined,
      avatar: u.avatar || undefined,
      passwordHash: u.password_hash || undefined,
      salt: u.salt || undefined,
      isActive: u.is_active ?? true,
      isBanned: u.is_banned ?? false,
      isBot: u.is_bot ?? false,
      botEnabled: u.bot_enabled ?? true,
      bio: u.bio || undefined,
      username: u.username || undefined,
      createdAt: new Date(u.created_at).toISOString(),
    };
  }

  // Authenticate user with password
  async authenticate(
    identifier: string,
    password?: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    let user = this.findUserByEmailOrPhone(identifier);

    // If the user is not in this serverless instance's memory,
    // load the account permanently stored in Neon.
    if (!user) {
      try {
        user = await this.findUserByEmailOrPhoneFromNeon(identifier);

        if (user) {
          const existsInMemory = this.state.users.some(
            (u) => u.id === user!.id
          );

          if (!existsInMemory) {
            this.state.users.push(user);
          }
        }
      } catch (error: any) {
        console.error(
          '[LOGIN NEON FALLBACK] Failed to load user:',
          error?.message || error
        );

        return {
          success: false,
          error: 'تعذر التحقق من الحساب حالياً. حاول مرة أخرى.',
        };
      }
    }

    if (!user) {
      return {
        success: false,
        error: 'المستخدم غير موجود. يرجى التحقق من رقم الهاتف أو البريد.',
      };
    }

    if (user.isBanned) {
      return {
        success: false,
        error: 'تم حظر هذا الحساب من قبل إدارة المنصة. يرجى مراجعة الدعم.',
      };
    }

    if (!user.isActive) {
      return {
        success: false,
        error: 'هذا الحساب غير نشط حالياً.',
      };
    }

    // Verify password
    if (user.passwordHash && user.salt && password) {
      const isValid = verifyPassword(
        password,
        user.passwordHash,
        user.salt
      );

      if (!isValid) {
        return {
          success: false,
          error: 'كلمة المرور غير صحيحة.',
        };
      }
    }

    return {
      success: true,
      user: this.sanitizeUser(user),
    };
  }

  // Create User with server-enforced role restrictions
  createUser(
    userData: {
      name: string;
      email?: string;
      phone: string;
      role?: UserRole;
      city?: string;
      salonId?: string;
      username?: string;
    },
    password?: string,
    ip?: string
  ): { success: boolean; user?: User; error?: string } {
    const existing = this.findUserByEmailOrPhone(userData.email || userData.phone);
    if (existing) {
      return { success: false, error: 'يوجد حساب مسجل بالفعل بهذا البريد أو رقم الهاتف.' };
    }
    
    if (userData.username) {
        const trimmedUsername = userData.username.trim();
        if (!/^[a-zA-Z0-9_.]{3,30}$/.test(trimmedUsername)) {
            return { success: false, error: 'اسم المستخدم يجب أن يتكون من 3 إلى 30 حرفاً (أحرف وأرقام و_ فقط).' };
        }
        const usernameExists = this.state.users.some(u => u.username?.toLowerCase() === trimmedUsername.toLowerCase());
        if (usernameExists) {
            return { success: false, error: 'اسم المستخدم مأخوذ بالفعل.' };
        }
    }

    // STRICT SECURITY: Public registration CANNOT grant admin role
    const assignedRole: UserRole = userData.role === 'salon_owner' ? 'salon_owner' : 'customer';

    const salt = generateSalt();
    const passwordHash = password ? hashPassword(password, salt) : hashPassword('Customer@2026!', salt);

    const newUser: UserWithAuth = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: userData.name.trim(),
      email: userData.email?.trim() || `${Date.now()}@halaqi.iq`,
      phone: userData.phone.trim(),
      role: assignedRole,
      city: userData.city || 'baghdad',
      salonId: assignedRole === 'salon_owner' ? userData.salonId : undefined,
      username: userData.username?.trim() || undefined,
      isActive: true,
      isBanned: false,
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    this.state.users.push(newUser);

    // Persist newly registered user to Neon so refresh/restart does not lose the account.
    void this.persistUserToNeon(newUser.id).catch((error) => {
      console.error('[REGISTER] Failed to persist new user to Neon:', error?.message || error);
    });

    // Notify all admins about the new registration
    const admins = this.state.users.filter((u) => u.role === 'admin' && u.isActive);

    for (const admin of admins) {
      this.createNotification({
        userId: admin.id,
        title: 'مستخدم جديد سجّل في المنصة',
        titleEn: 'New User Registered',
        message: `تم تسجيل مستخدم جديد: ${newUser.name} (${newUser.role === 'salon_owner' ? 'صاحب صالون' : 'زبون'})`,
        messageEn: `A new ${newUser.role === 'salon_owner' ? 'salon owner' : 'customer'} registered: ${newUser.name}`,
        type: 'new_user',
        link: '/admin/users',
      });
    }

    this.addAuditLog({
      userId: newUser.id,
      userEmail: newUser.email,
      userRole: newUser.role,
      action: 'USER_REGISTER',
      targetType: 'user',
      targetId: newUser.id,
      details: `تم إنشاء حساب مستخدم جديد بدور ${newUser.role}`,
      ip: ip || '127.0.0.1',
      status: 'success',
    });

    return { success: true, user: this.sanitizeUser(newUser) };
  }

  // Audit Logs
  addAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const log: AuditLog = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.state.auditLogs.unshift(log);
    // Keep max 500 logs in memory
    if (this.state.auditLogs.length > 500) {
      this.state.auditLogs.pop();
    }
    return log;
  }

  getAuditLogs(limit: number = 100): AuditLog[] {
    return this.state.auditLogs.slice(0, limit);
  }

  // Create notification
  async createNotification(data: {
    userId: string;
    actorUserId?: string;
    title: string;
    titleEn: string;
    message: string;
    messageEn: string;
    type: Notification['type'];
    link?: string;
    salonId?: string;
  }): Promise<Notification> {
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: data.userId,
      actorUserId: data.actorUserId,
      title: data.title,
      titleEn: data.titleEn,
      message: data.message,
      messageEn: data.messageEn,
      type: data.type,
      read: false,
      createdAt: new Date().toISOString(),
      link: data.link,
      salonId: data.salonId,
    };

    this.state.notifications.unshift(notification);

    // Persist notification in Neon database.
    // The current Neon notifications table does not have salon_id.
    await sql`
      INSERT INTO notifications
      (id, user_id, actor_user_id, title, title_en, message, message_en, type, read, created_at, link)
      VALUES
      (${notification.id}, ${notification.userId}, ${notification.actorUserId ?? null}, ${notification.title},
       ${notification.titleEn}, ${notification.message}, ${notification.messageEn},
       ${notification.type}, ${notification.read}, ${notification.createdAt},
       ${notification.link ?? null})
      ON CONFLICT (id) DO NOTHING
    `
;

    console.log('[NOTIFICATION SAVED TO NEON]', {
      notificationId: notification.id,
      userId: notification.userId,
      type: notification.type,
    });


    // Keep max 500 notifications in memory
    if (this.state.notifications.length > 500) {
      this.state.notifications.pop();
    }

    return notification;
  }

  // Admin User Management
  async updateUserProfile(userId: string, updates: { name: string; phone?: string; city?: string; username?: string; bio?: string }) {
    try {
      console.log('[PROFILE UPDATE DEBUG] userId =', userId);
      console.log('[PROFILE UPDATE DEBUG] newName =', updates.name);

      const beforeRows = await sql`
        SELECT id, name, email, role
        FROM users
        WHERE id = ${userId}
        LIMIT 1
      `;

      console.log('[PROFILE UPDATE DEBUG] BEFORE =', beforeRows[0] || null);

      const rows = await sql`
        UPDATE users
        SET name = ${updates.name},
            phone = ${updates.phone ?? null},
            city = ${updates.city ?? null},
            username = ${updates.username ?? null},
            bio = ${updates.bio ?? null}
        WHERE id = ${userId}
        RETURNING id, name, email, phone, role, city, salon_id, avatar, username,
                  password_hash, salt, is_active, is_banned, created_at, bio
      `;

      console.log('[PROFILE UPDATE DEBUG] UPDATED =', rows[0] || null);

      if (!rows.length) return { success: false, error: 'المستخدم غير موجود' };

      const u: any = rows[0];
      const user = {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        city: u.city || 'baghdad',
        salonId: u.salon_id || undefined,
        avatar: u.avatar || undefined,
        username: u.username || undefined,
        bio: u.bio || undefined,
        passwordHash: u.password_hash,
        salt: u.salt,
        isActive: u.is_active !== false,
        isBanned: u.is_banned === true,
        createdAt: u.created_at
      } as UserWithAuth;

      // مزامنة الاسم الجديد مع state.users حتى يظهر مباشرة في البحث
      const stateUser = this.state.users.find((item) => item.id === userId);

      if (stateUser) {
        stateUser.name = user.name;
        stateUser.phone = user.phone;
        stateUser.city = user.city;
        stateUser.username = user.username;
        stateUser.bio = user.bio;
      }

      return { success: true, user };
    } catch (error) {
      console.error('[DB] updateUserProfile:', error);
      return { success: false, error: 'تعذر تحديث بيانات المستخدم' };
    }
  }

  updateUserRole(userId: string, newRole: UserRole, adminUser: User, ip?: string): { success: boolean; error?: string } {
    if (adminUser.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بتعديل أدوار المستخدمين.' };
    }

    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return { success: false, error: 'المستخدم غير موجود.' };

    const oldRole = user.role;
    user.role = newRole;

    this.addAuditLog({
      userId: adminUser.id,
      userEmail: adminUser.email,
      userRole: 'admin',
      action: 'ROLE_CHANGE',
      targetType: 'user',
      targetId: user.id,
      details: `تغيير دور المستخدم ${user.name} (${user.email}) من ${oldRole} إلى ${newRole}`,
      ip: ip || '127.0.0.1',
      status: 'success',
    });

    return { success: true };
  }

  toggleUserBan(userId: string, adminUser: User, ip?: string): { success: boolean; isBanned?: boolean; error?: string } {
    if (adminUser.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بحظر المستخدمين.' };
    }

    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return { success: false, error: 'المستخدم غير موجود.' };

    if (user.role === 'admin') {
      return { success: false, error: 'لا يمكن حظر مدير المنصة.' };
    }

    user.isBanned = !user.isBanned;

    this.addAuditLog({
      userId: adminUser.id,
      userEmail: adminUser.email,
      userRole: 'admin',
      action: user.isBanned ? 'USER_BAN' : 'USER_UNBAN',
      targetType: 'user',
      targetId: user.id,
      details: `${user.isBanned ? 'حظر' : 'إلغاء حظر'} المستخدم ${user.name} (${user.email})`,
      ip: ip || '127.0.0.1',
      status: 'warning',
    });

    return { success: true, isBanned: user.isBanned };
  }

  async deleteUser(userId: string, adminUser: User, ip?: string): Promise<{ success: boolean; error?: string } > {
    if (adminUser.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بحذف المستخدمين.' };
    }

    const index = this.state.users.findIndex((u) => u.id === userId);
    if (index === -1) return { success: false, error: 'المستخدم غير موجود.' };

    const targetUser = this.state.users[index];
    if (targetUser.role === 'admin') {
      return { success: false, error: 'لا يمكن حذف حساب مدير المنصة.' };
    }

    // Set is_active = false in Neon to permanently deactivate the account.
    // This prevents login, removes user from search results, and makes
    // /api/auth/me return inactive accounts as non-active.
    try {
      await sql`
        UPDATE users
        SET is_active = false
        WHERE id = ${userId}
      `;
    } catch (error: any) {
      console.error('[DELETE_USER_NEON_ERROR]', error);
      return { success: false, error: 'فشل تعطيل الحساب في قاعدة البيانات.' };
    }

    // Also remove from this serverless instance's in-memory state
    this.state.users.splice(index, 1);

    this.addAuditLog({
      userId: adminUser.id,
      userEmail: adminUser.email,
      userRole: 'admin',
      action: 'USER_DELETE',
      targetType: 'user',
      targetId: targetUser.id,
      details: `تعطيل حساب المستخدم ${targetUser.name} (${targetUser.email}) نهائياً`,
      ip: ip || '127.0.0.1',
      status: 'warning',
    });

    return { success: true };
  }

  async isApprovedSalonOwnerFromNeon(
    userId: string,
    salonId: string
  ): Promise<boolean> {
    try {
      const rows = await sql`
        SELECT id
        FROM salons
        WHERE id = ${salonId}
          AND owner_id = ${userId}
          AND status = 'approved'
        LIMIT 1
      `;

      return rows.length > 0;
    } catch (error: any) {
      console.error(
        '[OWNER_CHECK] Neon ownership lookup failed:',
        error
      );
      return false;
    }
  }

  // Salon Ownership verification helper
  isSalonOwner(userId: string, salonId: string): boolean {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return false;
    if (user.role === 'admin') return true;
    const salon = this.state.salons.find((s) => s.id === salonId);
    return Boolean(salon && (salon.ownerId === userId || user.salonId === salonId));
  }

  // Salon owner must have an approved salon to manage it
  isApprovedSalonOwner(userId: string, salonId: string): boolean {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return false;

    if (user.role === 'admin') return true;

    const salon = this.state.salons.find((s) => s.id === salonId);
    if (!salon) return false;

    return (
      salon.status === 'approved' &&
      (salon.ownerId === userId || user.salonId === salonId)
    );
  }

  getSalons(filter?: { type?: string; city?: string; query?: string }): Salon[] {
    let list = this.state.salons.filter((s) => s.status === 'approved');
    if (filter?.type && filter.type !== 'all') {
      list = list.filter((s) => s.type === filter.type || s.type === 'unisex');
    }
    if (filter?.city && filter.city !== 'all') {
      list = list.filter((s) => s.city.toLowerCase() === filter.city.toLowerCase());
    }
    if (filter?.query && filter.query.trim()) {
      const q = filter.query.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.nameEn.toLowerCase().includes(q) ||
          s.area.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
    }
    return list;
  }

  getSalonById(id: string): Salon | undefined {
    const salon = this.state.salons.find((s) => s.id === id);

    if (
      salon &&
      salon.status === 'suspended' &&
      salon.suspensionEndsAt &&
      Date.now() >= new Date(salon.suspensionEndsAt).getTime()
    ) {
      salon.status = 'approved';
      delete salon.suspensionReason;
      delete salon.suspensionStartedAt;
      delete salon.suspensionEndsAt;
    }

    return salon;
  }

  getServicesBySalon(salonId: string): Service[] {
    return this.state.services.filter((srv) => srv.salonId === salonId);
  }

  getBarbersBySalon(salonId: string): Barber[] {
    return this.state.barbers.filter((b) => b.salonId === salonId);
  }

  async getBookingsForSalonOwnerFromNeon(userId: string): Promise<Booking[]> {
    const rows = await sql`
      SELECT
        b.id,
        b.booking_number,
        b.salon_id,
        b.salon_name,
        b.salon_address,
        b.salon_phone,
        b.salon_type,
        b.service_id,
        b.service_name,
        b.barber_id,
        b.barber_name,
        b.customer_id,
        b.customer_name,
        b.customer_phone,
        b.customer_email,
        b.notes,
        b.date,
        b.time_slot,
        b.duration_minutes,
        b.price,
        b.discount_amount,
        b.final_price,
        b.commission_amount,
        b.salon_payout,
        b.status,
        b.payment_method,
        b.payment_status,
        b.created_at,
        b.rated,
        b.cancellation_reason
      FROM bookings b
      INNER JOIN salons s ON s.id = b.salon_id
      WHERE s.owner_id = ${userId}
      ORDER BY b.created_at DESC
    `;

    return rows.map((b: any) => ({
      id: b.id,
      bookingNumber: b.booking_number,
      salonId: b.salon_id,
      salonName: b.salon_name,
      salonAddress: b.salon_address,
      salonPhone: b.salon_phone,
      salonType: b.salon_type,
      serviceId: b.service_id,
      serviceName: b.service_name,
      barberId: b.barber_id || undefined,
      barberName: b.barber_name || undefined,
      customerId: b.customer_id,
      customerName: b.customer_name,
      customerPhone: b.customer_phone,
      customerEmail: b.customer_email || undefined,
      notes: b.notes || undefined,
      date:
        b.date instanceof Date
          ? b.date.toISOString().slice(0, 10)
          : String(b.date),
      timeSlot: b.time_slot,
      durationMinutes: Number(b.duration_minutes || 0),
      price: Number(b.price || 0),
      discountAmount: Number(b.discount_amount || 0),
      finalPrice: Number(b.final_price || 0),
      commissionAmount: Number(b.commission_amount || 0),
      salonPayout: Number(b.salon_payout || 0),
      status: b.status,
      paymentMethod: b.payment_method,
      paymentStatus: b.payment_status,
      createdAt: new Date(b.created_at).toISOString(),
      rated: b.rated ?? false,
      cancellationReason: b.cancellation_reason || undefined,
    }));
  }

  async getAllBookingsFromNeon(): Promise<Booking[]> {
    const rows = await sql`
      SELECT
        id,
        booking_number,
        salon_id,
        salon_name,
        salon_address,
        salon_phone,
        salon_type,
        service_id,
        service_name,
        barber_id,
        barber_name,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        notes,
        date,
        time_slot,
        duration_minutes,
        price,
        discount_amount,
        final_price,
        commission_amount,
        salon_payout,
        status,
        payment_method,
        payment_status,
        created_at,
        rated,
        cancellation_reason,
      completion_qr_nonce,
      completion_qr_expires_at,
      completed_at,
      completed_by
      FROM bookings
      ORDER BY created_at DESC
    `;

    return rows.map((b: any) => ({
      id: b.id,
      bookingNumber: b.booking_number,
      salonId: b.salon_id,
      salonName: b.salon_name,
      salonAddress: b.salon_address,
      salonPhone: b.salon_phone,
      salonType: b.salon_type,
      serviceId: b.service_id,
      serviceName: b.service_name,
      barberId: b.barber_id || undefined,
      barberName: b.barber_name || undefined,
      customerId: b.customer_id,
      customerName: b.customer_name,
      customerPhone: b.customer_phone,
      customerEmail: b.customer_email || undefined,
      notes: b.notes || undefined,
      date:
        b.date instanceof Date
          ? b.date.toISOString().slice(0, 10)
          : String(b.date),
      timeSlot: b.time_slot,
      durationMinutes: Number(b.duration_minutes || 0),
      price: Number(b.price || 0),
      discountAmount: Number(b.discount_amount || 0),
      finalPrice: Number(b.final_price || 0),
      commissionAmount: Number(b.commission_amount || 0),
      salonPayout: Number(b.salon_payout || 0),
      status: b.status,
      paymentMethod: b.payment_method,
      paymentStatus: b.payment_status,
      completionQrNonce: b.completion_qr_nonce || undefined,
      completionQrExpiresAt: b.completion_qr_expires_at
        ? new Date(b.completion_qr_expires_at).toISOString()
        : undefined,
      completedAt: b.completed_at
        ? new Date(b.completed_at).toISOString()
        : undefined,
      completedBy: b.completed_by || undefined,
      createdAt: new Date(b.created_at).toISOString(),
      rated: b.rated ?? false,
      cancellationReason: b.cancellation_reason || undefined,
    }));
  }

  // Strict Double-booking check & atomic booking creation
  createBookingAtomic(
    bookingData: Omit<Booking, 'id' | 'bookingNumber' | 'createdAt' | 'commissionAmount' | 'salonPayout'>,
    couponCode?: string,
    ip?: string
  ): {
    success: boolean;
    booking?: Booking;
    error?: string;
  } {
    // 1. Validate Customer
    const customer = this.state.users.find((u) => u.id === bookingData.customerId);
    if (!customer) {
      return { success: false, error: 'حساب العميل غير موجود أو تم تسجيل الخروج.' };
    }
    if (customer.isBanned) {
      return { success: false, error: 'تم حظر هذا الحساب من إجراء حجوزات جديدة.' };
    }

    // 2. Validate Salon
    const salon = this.state.salons.find((s) => s.id === bookingData.salonId);
    if (!salon) {
      return { success: false, error: 'الصالون المحدد غير موجود.' };
    }
    if (salon.status !== 'approved') {
      return { success: false, error: 'لا يمكن الحجز في هذا الصالون لأنه غير مفعل حالياً من قبل الإدارة.' };
    }

    // 3. Validate Service & enforce authoritative database price
    const service = this.state.services.find(
      (srv) => srv.id === bookingData.serviceId && srv.salonId === bookingData.salonId
    );
    if (!service) {
      return { success: false, error: 'الخدمة المطلوبة غير متوفرة في هذا الصالون.' };
    }
    const realServicePrice = service.price;

    // 4. Barber is OPTIONAL.
    // If a barber is supplied, validate that the barber belongs to this salon.
    // New bookings are allowed without a barber.
    const barber = bookingData.barberId
      ? this.state.barbers.find(
          (b) => b.id === bookingData.barberId && b.salonId === bookingData.salonId
        )
      : undefined;

    if (bookingData.barberId && !barber) {
      return {
        success: false,
        error: 'الحلاق المحدد لا ينتمي لهذا الصالون أو غير متاح.',
      };
    }

    // 5. Check double booking only when a specific barber exists.
    // A salon-level booking without a barber must not be blocked by barber slots.
    if (bookingData.barberId) {
      const conflict = this.state.bookings.find(
        (b) =>
          b.barberId === bookingData.barberId &&
          b.date === bookingData.date &&
          b.timeSlot === bookingData.timeSlot &&
          b.status !== 'cancelled'
      );

      if (conflict) {
        return {
          success: false,
          error: 'الموعد المحدد محجوز بالفعل لهذا الحلاق. يرجى اختيار موعد أو حلاق آخر.',
        };
      }
    }

    // 6. Check if time is blocked by salon owner
    const isBlocked = this.state.blockedTimes.some(
      (bt) =>
        bt.salonId === bookingData.salonId &&
        bt.date === bookingData.date &&
        (!bt.barberId || bt.barberId === bookingData.barberId) &&
        bookingData.timeSlot >= bt.startTime &&
        bookingData.timeSlot <= bt.endTime
    );

    if (isBlocked) {
      return {
        success: false,
        error: 'هذا الوقت غير متاح للحجز (فترة راحة أو إغلاق مؤقت).',
      };
    }

    // 7. Calculate coupon discount securely on backend
    let discountAmount = 0;
    if (couponCode) {
      const couponValidation = this.validateCoupon(couponCode, realServicePrice);
      if (couponValidation.valid && couponValidation.discount) {
        discountAmount = couponValidation.discount;
        if (couponValidation.coupon) {
          couponValidation.coupon.usageCount += 1;
        }
      }
    }

    const finalPrice = Math.max(0, realServicePrice - discountAmount);

    // Calculate commission (default 10% or platform commission)
    const commissionPercent = salon.commissionRate || this.state.settings.commissionRate || 10;
    const commissionAmount = Math.round((finalPrice * commissionPercent) / 100);
    const salonPayout = finalPrice - commissionAmount;

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const completionQrNonce =
      `qr_${Date.now()}_${Math.random().toString(36).substring(2, 14)}`;

    const completionQrExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    const newBooking: Booking = {
      ...bookingData,
      id: `bk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      bookingNumber: `HLQ-2026-${randomNum}`,
      salonName: salon.name,
      salonAddress: salon.address,
      salonPhone: salon.phone,
      salonType: salon.type,
      serviceName: service.name,
      barberName: barber?.name,
      durationMinutes: service.durationMinutes,
      price: realServicePrice,
      discountAmount,
      finalPrice,
      commissionAmount,
      salonPayout,
      status: 'confirmed',
      completionQrNonce,
      completionQrExpiresAt,
      createdAt: new Date().toISOString(),
    };

    this.state.bookings.unshift(newBooking);

    // Persist booking to Neon.
    // barber_id/barber_name are intentionally NULL when no barber is assigned.
    void sql`
      INSERT INTO bookings (
        id,
        booking_number,
        salon_id,
        salon_name,
        salon_address,
        salon_phone,
        salon_type,
        service_id,
        service_name,
        barber_id,
        barber_name,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        notes,
        date,
        time_slot,
        duration_minutes,
        price,
        discount_amount,
        final_price,
        commission_amount,
        salon_payout,
        status,
        payment_method,
        payment_status,
        created_at,
        rated,
        cancellation_reason ,
      completion_qr_nonce,
      completion_qr_expires_at,
      completed_at,
      completed_by
      )
      VALUES (
        ${newBooking.id},
        ${newBooking.bookingNumber},
        ${newBooking.salonId},
        ${newBooking.salonName},
        ${newBooking.salonAddress},
        ${newBooking.salonPhone},
        ${newBooking.salonType},
        ${newBooking.serviceId},
        ${newBooking.serviceName},
        ${newBooking.barberId ?? null},
        ${newBooking.barberName ?? null},
        ${newBooking.customerId},
        ${newBooking.customerName},
        ${newBooking.customerPhone},
        ${newBooking.customerEmail ?? null},
        ${newBooking.notes ?? null},
        ${newBooking.date},
        ${newBooking.timeSlot},
        ${newBooking.durationMinutes},
        ${newBooking.price},
        ${newBooking.discountAmount},
        ${newBooking.finalPrice},
        ${newBooking.commissionAmount},
        ${newBooking.salonPayout},
        ${newBooking.status},
        ${newBooking.paymentMethod ?? null},
        ${newBooking.paymentStatus ?? null},
        ${newBooking.createdAt},
        ${newBooking.rated ?? false},
        ${newBooking.cancellationReason ?? null},
      ${newBooking.completionQrNonce ?? null},
      ${newBooking.completionQrExpiresAt ?? null},
      ${newBooking.completedAt ?? null},
      ${newBooking.completedBy ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        booking_number = EXCLUDED.booking_number,
        salon_id = EXCLUDED.salon_id,
        salon_name = EXCLUDED.salon_name,
        salon_address = EXCLUDED.salon_address,
        salon_phone = EXCLUDED.salon_phone,
        salon_type = EXCLUDED.salon_type,
        service_id = EXCLUDED.service_id,
        service_name = EXCLUDED.service_name,
        barber_id = EXCLUDED.barber_id,
        barber_name = EXCLUDED.barber_name,
        customer_id = EXCLUDED.customer_id,
        customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone,
        customer_email = EXCLUDED.customer_email,
        notes = EXCLUDED.notes,
        date = EXCLUDED.date,
        time_slot = EXCLUDED.time_slot,
        duration_minutes = EXCLUDED.duration_minutes,
        price = EXCLUDED.price,
        discount_amount = EXCLUDED.discount_amount,
        final_price = EXCLUDED.final_price,
        commission_amount = EXCLUDED.commission_amount,
        salon_payout = EXCLUDED.salon_payout,
        status = EXCLUDED.status,
      completion_qr_nonce = EXCLUDED.completion_qr_nonce,
      completion_qr_expires_at = EXCLUDED.completion_qr_expires_at,
      completed_at = EXCLUDED.completed_at,
      completed_by = EXCLUDED.completed_by,
        payment_method = EXCLUDED.payment_method,
        payment_status = EXCLUDED.payment_status,
        rated = EXCLUDED.rated,
        cancellation_reason = EXCLUDED.cancellation_reason
    `.catch((error: any) => {
      console.error('[BOOKING] Failed to persist booking to Neon:', error?.message || error);
    });

    // Create automated customer notification
    this.state.notifications.unshift({
      id: `notif_${Date.now()}`,
      userId: newBooking.customerId,
      title: 'تأكيد الحجز بنجاح',
      titleEn: 'Booking Confirmed',
      message: `تم حجز موعدك بنجاح في ${newBooking.salonName} يوم ${newBooking.date} الساعة ${newBooking.timeSlot} مع ${newBooking.barberName}.`,
      messageEn: `Your appointment is confirmed at ${newBooking.salonName} on ${newBooking.date} at ${newBooking.timeSlot}.`,
      type: 'booking_confirmed',
      read: false,
      createdAt: new Date().toISOString(),
      link: '/bookings',
    });

    // Record Audit Log
    this.addAuditLog({
      userId: customer.id,
      userEmail: customer.email,
      userRole: customer.role,
      action: 'BOOKING_CREATE',
      targetType: 'booking',
      targetId: newBooking.id,
      details: `إنشاء حجز جديد برقم ${newBooking.bookingNumber} في ${salon.name} بقيمة ${finalPrice} د.ع`,
      ip: ip || '127.0.0.1',
      status: 'success',
    });

    return {
      success: true,
      booking: newBooking,
    };
  }

  async completeBookingByQr(
    bookingId: string,
    qrNonce: string,
    requestingUser: User,
    ip?: string
  ): Promise<{
    success: boolean;
    booking?: Booking;
    error?: string;
  }> {
    const booking = this.state.bookings.find((b) => b.id === bookingId);

    if (!booking) {
      return {
        success: false,
        error: 'الحجز غير موجود.',
      };
    }

    // Only salon owner/staff/admin can complete a booking by QR.
    if (
      requestingUser.role !== 'admin' &&
      requestingUser.role !== 'salon_owner' &&
      requestingUser.role !== 'staff'
    ) {
      return {
        success: false,
        error: 'غير مصرح لك بإتمام الحجز عبر QR.',
      };
    }

    // Salon owner/staff must belong to the booking salon.
    if (requestingUser.role !== 'admin') {
      const isOwner = this.isApprovedSalonOwner(
        requestingUser.id,
        booking.salonId
      );

      if (!isOwner) {
        return {
          success: false,
          error: 'غير مصرح لك بإتمام حجز لهذا الصالون.',
        };
      }
    }

    // Prevent using the QR more than once.
    if (booking.status === 'completed' || booking.completedAt) {
      return {
        success: false,
        error: 'تم إكمال هذا الحجز مسبقاً.',
      };
    }

    if (booking.status === 'cancelled') {
      return {
        success: false,
        error: 'لا يمكن إكمال حجز ملغى.',
      };
    }

    // Verify QR nonce.
    if (
      !booking.completionQrNonce ||
      !qrNonce ||
      booking.completionQrNonce !== qrNonce
    ) {
      this.addAuditLog({
        userId: requestingUser.id,
        userEmail: requestingUser.email,
        userRole: requestingUser.role,
        action: 'BOOKING_QR_INVALID',
        targetType: 'booking',
        targetId: booking.id,
        details: `محاولة استخدام QR غير صالح للحجز ${booking.bookingNumber}`,
        ip: ip || '127.0.0.1',
        status: 'failure',
      });

      return {
        success: false,
        error: 'رمز QR غير صالح.',
      };
    }

    // Verify QR expiry.
    if (
      booking.completionQrExpiresAt &&
      new Date(booking.completionQrExpiresAt).getTime() < Date.now()
    ) {
      this.addAuditLog({
        userId: requestingUser.id,
        userEmail: requestingUser.email,
        userRole: requestingUser.role,
        action: 'BOOKING_QR_EXPIRED',
        targetType: 'booking',
        targetId: booking.id,
        details: `محاولة استخدام QR منتهي للحجز ${booking.bookingNumber}`,
        ip: ip || '127.0.0.1',
        status: 'failure',
      });

      return {
        success: false,
        error: 'انتهت صلاحية رمز QR.',
      };
    }

    const completedAt = new Date().toISOString();

    booking.status = 'completed';
    booking.completedAt = completedAt;
    booking.completedBy = requestingUser.id;

    // Invalidate QR immediately after successful use.
    booking.completionQrNonce = undefined;
    booking.completionQrExpiresAt = undefined;

    // Single CTE: persist completion, fetch salon owner, and collect admin IDs.
    let ownerId: string | undefined;
    let adminIds: string[] = [];
    try {
      const metaRows = await sql`
        WITH completion AS (
          UPDATE bookings
          SET
            status = ${booking.status},
            completion_qr_nonce = NULL,
            completion_qr_expires_at = NULL,
            completed_at = ${completedAt},
            completed_by = ${requestingUser.id}
          WHERE id = ${booking.id}
          RETURNING salon_id
        ),
        owner_info AS (
          SELECT s.owner_id
          FROM salons s
          INNER JOIN completion c ON c.salon_id = s.id
        ),
        admin_info AS (
          SELECT id
          FROM users
          WHERE role = 'admin'
            AND is_active = true
        )
        SELECT
          o.owner_id AS owner_id,
          (SELECT COALESCE(array_agg(a.id), '{}'::text[]) FROM admin_info a) AS admin_ids
        FROM owner_info o
      `;

      ownerId = metaRows[0]?.owner_id || undefined;

      const rawAdminIds = metaRows[0]?.admin_ids;
      adminIds = Array.isArray(rawAdminIds)
        ? rawAdminIds
        : typeof rawAdminIds === 'string'
          ? rawAdminIds === '{}' ? [] : rawAdminIds.replace(/[{}]/g, '').split(',').filter(Boolean)
          : [];
    } catch (error: any) {
      console.error(
        '[BOOKING_QR] Failed to persist completion to Neon:',
        error?.message || error
      );

      // Roll back the in-memory completion if durable persistence failed.
      booking.status = 'confirmed';
      booking.completedAt = undefined;
      booking.completedBy = undefined;
      booking.completionQrNonce = qrNonce;

      return {
        success: false,
        error: 'تعذر حفظ إتمام الخدمة. يرجى المحاولة مرة أخرى.',
      };
    }

    // ----------------------------------------------------------
    // Fire-and-forget notifications (non-blocking)
    // ----------------------------------------------------------

    // Customer notification
    this.createNotification({
      userId: booking.customerId,
      title: 'تم إكمال موعدك بنجاح',
      titleEn: 'Appointment Completed',
      message: `تم تأكيد إكمال موعدك في ${booking.salonName}. شكراً لاستخدامك حلاقي.`,
      messageEn: `Your appointment at ${booking.salonName} has been completed successfully.`,
      type: 'booking_completed',
      link: '/bookings',
      salonId: booking.salonId,
    }).catch(() => {});

    // Salon owner notification
    if (ownerId) {
      this.createNotification({
        userId: ownerId,
        title: 'تم إتمام حجز ✅',
        titleEn: 'Booking Completed ✅',
        message: `تم إتمام الحجز ${booking.bookingNumber} في ${booking.salonName} بنجاح عبر QR.`,
        messageEn: `Booking ${booking.bookingNumber} at ${booking.salonName} was completed successfully via QR.`,
        type: 'booking_completed',
        link: '/bookings',
        salonId: booking.salonId,
      }).catch(() => {});
    }

    // Admin notifications
    for (const adminId of adminIds) {
      if (adminId === requestingUser.id) {
        continue;
      }

      this.createNotification({
        userId: adminId,
        title: 'عملية خدمة مكتملة ✅',
        titleEn: 'Service Completed ✅',
        message: `تم إتمام الحجز ${booking.bookingNumber} في ${booking.salonName}. قيمة الخدمة: ${booking.finalPrice.toLocaleString()} د.ع.`,
        messageEn: `Booking ${booking.bookingNumber} at ${booking.salonName} was completed. Service value: ${booking.finalPrice.toLocaleString()} IQD.`,
        type: 'booking_completed',
        link: '/admin/',
        salonId: booking.salonId,
      }).catch(() => {});
    }

    // Audit log.
    this.addAuditLog({
      userId: requestingUser.id,
      userEmail: requestingUser.email,
      userRole: requestingUser.role,
      action: 'BOOKING_QR_COMPLETED',
      targetType: 'booking',
      targetId: booking.id,
      details: `إكمال الحجز ${booking.bookingNumber} عبر QR في صالون ${booking.salonName}`,
      ip: ip || '127.0.0.1',
      status: 'success',
    });

    return {
      success: true,
      booking,
    };
  }

  cancelBooking(
    bookingId: string,
    requestingUser: User,
    reason?: string,
    ip?: string
  ): { success: boolean; error?: string } {
    const booking = this.state.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return { success: false, error: 'الحجز غير موجود' };
    }

    // Strict Authorization Check:
    // Customer can only cancel their own booking
    // Salon Owner can only cancel booking for their own salon
    // Admin can cancel any booking
    if (requestingUser.role === 'customer' && booking.customerId !== requestingUser.id) {
      return { success: false, error: 'غير مصرح لك بإلغاء حجز لا يخصك.' };
    }

    if (
      requestingUser.role === 'salon_owner' &&
      !this.isApprovedSalonOwner(requestingUser.id, booking.salonId)
    ) {
      return { success: false, error: 'غير مصرح لك بإلغاء حجز لصالون آخر.' };
    }

    booking.status = 'cancelled';
    booking.cancellationReason = reason || `تم الإلغاء بواسطة ${requestingUser.name}`;

    // Notify customer
    this.state.notifications.unshift({
      id: `notif_${Date.now()}`,
      userId: booking.customerId,
      title: 'تم إلغاء الحجز',
      titleEn: 'Booking Cancelled',
      message: `تم إلغاء حجزك رقم ${booking.bookingNumber} في ${booking.salonName}. أصبح الموعد متاحاً الآن للآخرين.`,
      messageEn: `Booking ${booking.bookingNumber} has been cancelled.`,
      type: 'booking_cancelled',
      read: false,
      createdAt: new Date().toISOString(),
      link: '/bookings',
    });

    // Record Audit Log
    this.addAuditLog({
      userId: requestingUser.id,
      userEmail: requestingUser.email,
      userRole: requestingUser.role,
      action: 'BOOKING_CANCEL',
      targetType: 'booking',
      targetId: booking.id,
      details: `إلغاء الحجز ${booking.bookingNumber} لصالون ${booking.salonName}. السبب: ${booking.cancellationReason}`,
      ip: ip || '127.0.0.1',
      status: 'warning',
    });

    return { success: true };
  }

  getOccupiedSlots(barberId: string, date: string): string[] {
    return this.state.bookings
      .filter((b) => b.barberId === barberId && b.date === date && b.status !== 'cancelled')
      .map((b) => b.timeSlot);
  }

  addReview(
    reviewData: Omit<Review, 'id' | 'createdAt'>,
    requestingUser: User,
    ip?: string
  ): { success: boolean; review?: Review; error?: string } {
    // Check if user is banned
    if (requestingUser.isBanned) {
      return { success: false, error: 'تم حظر هذا الحساب من إرسال التقييمات.' };
    }

    // Enforce that reviewer customer ID matches requesting user
    if (requestingUser.role === 'customer' && reviewData.customerId !== requestingUser.id) {
      return { success: false, error: 'لا يمكنك إرسال تقييم باسم مستخدم آخر.' };
    }

    // Verify customer has a real booking at this salon
    const hasCompletedBooking = this.state.bookings.some(
      (b) => b.customerId === requestingUser.id && b.salonId === reviewData.salonId && (b.status === 'completed' || b.status === 'confirmed')
    );

    if (!hasCompletedBooking && requestingUser.role !== 'admin') {
      return { success: false, error: 'لا يمكنك تقييم هذا الصالون إلا بعد حجز وتجربة موعد حقيقي.' };
    }

    const newReview: Review = {
      ...reviewData,
      customerId: requestingUser.id,
      customerName: requestingUser.name,
      id: `rev_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.state.reviews.unshift(newReview);

    // Update booking rated flag if bookingId is provided
    if (reviewData.bookingId) {
      const booking = this.state.bookings.find((b) => b.id === reviewData.bookingId);
      if (booking) {
        booking.rated = true;
      }
    }

    // Recalculate salon average rating
    const salonReviews = this.state.reviews.filter((r) => r.salonId === reviewData.salonId);
    const avg = salonReviews.reduce((sum, r) => sum + r.rating, 0) / salonReviews.length;
    const salon = this.state.salons.find((s) => s.id === reviewData.salonId);
    if (salon) {
      salon.rating = Math.round(avg * 10) / 10;
      salon.reviewCount = salonReviews.length;
    }

    this.addAuditLog({
      userId: requestingUser.id,
      userEmail: requestingUser.email,
      userRole: requestingUser.role,
      action: 'REVIEW_SUBMIT',
      targetType: 'salon',
      targetId: reviewData.salonId,
      details: `إضافة تقييم جديد (${reviewData.rating}/5) لصالون ${salon?.name || reviewData.salonId}`,
      ip: ip || '127.0.0.1',
      status: 'success',
    });

    return { success: true, review: newReview };
  }

  // ==========================================
  // SALON POSTS
  // ==========================================

  async getSalonPosts(salonId?: string): Promise<SalonPost[]> {
    try {
      const rows = salonId
        ? await sql`SELECT * FROM salon_posts WHERE salon_id = ${salonId} ORDER BY created_at DESC`
        : await sql`SELECT * FROM salon_posts ORDER BY created_at DESC`;

      return rows.map((p: any) => ({
        id: p.id,
        salonId: p.salon_id,
        ownerId: p.owner_id,
        salonName: p.salon_name,
        imageUrl: p.image_url,
        caption: p.caption || '',
        createdAt: new Date(p.created_at).toISOString(),
        updatedAt: p.updated_at
          ? new Date(p.updated_at).toISOString()
          : undefined,
        likeCount: Number(p.like_count || 0),
        commentCount: Number(p.comment_count || 0),
      }));
    } catch (error: any) {
      console.error('فشل جلب منشورات الصالون من Neon:', error.message);
      return [];
    }
  }

  async getUserSalonPosts(userId: string): Promise<SalonPost[]> {
    try {
      const rows = await sql`
        SELECT *
        FROM salon_posts
        WHERE owner_id = ${userId}
        ORDER BY created_at DESC
      `;

      return rows.map((p: any) => ({
        id: p.id,
        salonId: p.salon_id,
        ownerId: p.owner_id,
        salonName: p.salon_name,
        imageUrl: p.image_url,
        caption: p.caption || '',
        createdAt: new Date(p.created_at).toISOString(),
        updatedAt: p.updated_at
          ? new Date(p.updated_at).toISOString()
          : undefined,
        likeCount: Number(p.like_count || 0),
        commentCount: Number(p.comment_count || 0),
      }));
    } catch (error: any) {
      console.error(
        '[getUserSalonPosts] فشل جلب منشورات المستخدم:',
        error.message
      );
      return [];
    }
  }

  async getUserPosts(userId: string): Promise<UserPost[]> {
    try {
      const rows = await sql`
        SELECT
          up.id,
          up.user_id,
          up.image_url,
          up.caption,
          up.media_type,
          up.duration,
          up.created_at,
          up.updated_at,
          up.like_count,
          up.comment_count,
          u.username AS user_username
        FROM user_posts up
        LEFT JOIN users u ON u.id = up.user_id
        WHERE up.user_id = ${userId}
        ORDER BY up.created_at DESC
      `;

      return rows.map((p: any) => ({
        id: p.id,
        userId: p.user_id,
        username: p.user_username || undefined,
        imageUrl: p.image_url,
        caption: p.caption || '',
        mediaType: (p.media_type === 'video' ? 'video' : 'image') as
          | 'image'
          | 'video',
        duration: p.duration ? Number(p.duration) : undefined,
        createdAt: new Date(p.created_at).toISOString(),
        updatedAt: p.updated_at
          ? new Date(p.updated_at).toISOString()
          : undefined,
        likeCount: Number(p.like_count || 0),
        commentCount: Number(p.comment_count || 0),
      }));
    } catch (error: any) {
      console.error(
        '[getUserPosts] فشل جلب منشورات المستخدم:',
        error?.message || error
      );
      return [];
    }
  }



  async getUserPostById(postId: string): Promise<UserPost | null> {
    try {
      // الأعمدة الفعلية التي يكتبها createUserPost في user_posts.
      // بيانات المستخدم (الاسم والصورة) تُجلب من جدول users.
      const rows = await sql`
        SELECT
          up.id,
          up.user_id,
          up.image_url,
          up.caption,
          up.media_type,
          up.duration,
          up.created_at,
          up.updated_at,
          up.like_count,
          up.comment_count,
          u.name AS user_name,
          u.username AS user_username,
          u.avatar AS user_avatar
        FROM user_posts up
        LEFT JOIN users u ON u.id = up.user_id
        WHERE up.id = ${postId}
        LIMIT 1
      `;

      if (!rows.length) {
        return null;
      }

      const row: any = rows[0];

      return {
        id: String(row.id),
        userId: String(row.user_id),
        userName: row.user_name || 'مستخدم',
        username: row.user_username || undefined,
        userAvatar: row.user_avatar || undefined,
        imageUrl: row.image_url,
        caption: row.caption || '',
        createdAt: row.created_at
          ? new Date(row.created_at).toISOString()
          : new Date().toISOString(),
        updatedAt: row.updated_at
          ? new Date(row.updated_at).toISOString()
          : undefined,
        likeCount: Number(row.like_count || 0),
        commentCount: Number(row.comment_count || 0),
        mediaType: (row.media_type === 'video' ? 'video' : 'image') as
          | 'image'
          | 'video',
        duration: row.duration ? Number(row.duration) : undefined,
      } as UserPost;
    } catch (error: any) {
      console.error(
        '[getUserPostById] فشل جلب المنشور:',
        error?.message || error
      );
      return null;
    }
  }

  /*
   * جلب منشور واحد مباشرة سواء كان منشور مستخدم أو منشور صالون.
   * postType يُحدد المصدر حتى يتمكن العميل من توجيه اللايكات
   * والتعليقات إلى الـendpoint الصحيح.
   */
  async getUnifiedPostById(postId: string): Promise<any | null> {
    try {
      const userPost = await this.getUserPostById(postId);

      if (userPost) {
        return { ...userPost, postType: 'user' as const };
      }

      const rows = await sql`
        SELECT
          id,
          salon_id,
          owner_id,
          salon_name,
          image_url,
          caption,
          created_at,
          updated_at,
          like_count,
          comment_count
        FROM salon_posts
        WHERE id = ${postId}
        LIMIT 1
      `;

      if (!rows.length) {
        return null;
      }

      const p: any = rows[0];

      return {
        id: String(p.id),
        postType: 'salon' as const,
        salonId: p.salon_id ? String(p.salon_id) : undefined,
        ownerId: p.owner_id ? String(p.owner_id) : undefined,
        salonName: p.salon_name || undefined,
        imageUrl: p.image_url,
        caption: p.caption || '',
        createdAt: p.created_at
          ? new Date(p.created_at).toISOString()
          : new Date().toISOString(),
        updatedAt: p.updated_at
          ? new Date(p.updated_at).toISOString()
          : undefined,
        likeCount: Number(p.like_count || 0),
        commentCount: Number(p.comment_count || 0),
      };
    } catch (error: any) {
      console.error(
        '[getUnifiedPostById] فشل جلب المنشور:',
        error?.message || error
      );
      return null;
    }
  }

  async getAllUserPosts(): Promise<UserPost[]> {
    try {
      const rows = await sql`
        SELECT
          up.id,
          up.user_id,
          up.image_url,
          up.caption,
          up.created_at,
          up.updated_at,
          up.like_count,
          up.comment_count,
          u.name AS user_name,
          u.username AS user_username,
          u.avatar AS user_avatar
        FROM user_posts up
        LEFT JOIN users u ON u.id = up.user_id
        ORDER BY up.created_at DESC
      `;

      return rows.map((p: any) => ({
        id: p.id,
        userId: p.user_id,
        userName: p.user_name || 'مستخدم',
        username: p.user_username || undefined,
        userAvatar: p.user_avatar || undefined,
        imageUrl: p.image_url,
        caption: p.caption || '',
        createdAt: new Date(p.created_at).toISOString(),
        updatedAt: p.updated_at
          ? new Date(p.updated_at).toISOString()
          : undefined,
        likeCount: Number(p.like_count || 0),
        commentCount: Number(p.comment_count || 0),
      }));
    } catch (error: any) {
      console.error(
        '[getAllUserPosts] فشل جلب جميع منشورات المستخدمين:',
        error?.message || error
      );
      return [];
    }
  }

  // Unified Posts Feed: salon_posts + user_posts
  // لا نغيّر الـtypes الأصلية؛ postType خاص بالـFeed فقط.
  // عند تمرير viewerUserId يُحسب liked لكل منشور من Neon مباشرة
  // (post_likes هي مصدر الحقيقة لحالة الإعجاب).
  async getUnifiedPostsFeed(viewerUserId?: string): Promise<any[]> {
    try {
      const viewerId = viewerUserId || '';

      // ----- Viewer signals (power the Cold Start -> Personalized transition) -----
      const engagedUserIds = new Set<string>();
      const engagedSalonIds = new Set<string>();

      // Combined interests = manually selected interests (base weight) PLUS
      // auto-learned weights from real likes/comments/follows. Only weights at or
      // above the threshold participate in SQL `&&` matching; all weights feed the
      // graded interest signal so repeated engagement nudges the feed gradually.
      const combined = await getCombinedInterests(viewerId);
      const combinedMap = new Map<string, number>();
      for (const c of combined) combinedMap.set(c.interest, c.weight);
      const combinedMatchInterests = combined
        .filter((c) => c.weight >= COMBINED_MATCH_THRESHOLD)
        .map((c) => c.interest);

      if (viewerId) {
        // Authors/salons the viewer liked.
        const liked = await sql`
          SELECT
            CASE WHEN pl.post_type = 'user' THEN up.user_id ELSE sp.owner_id END AS author_id,
            CASE WHEN pl.post_type = 'salon' THEN sp.salon_id ELSE NULL END AS salon_id
          FROM post_likes pl
          LEFT JOIN user_posts up ON up.id = pl.post_id AND pl.post_type = 'user'
          LEFT JOIN salon_posts sp ON sp.id = pl.post_id AND pl.post_type = 'salon'
          WHERE pl.user_id = ${viewerId}
        `;
        for (const r of liked as any[]) {
          if (r.author_id) engagedUserIds.add(String(r.author_id));
          if (r.salon_id) engagedSalonIds.add(String(r.salon_id));
        }

        // Authors the viewer commented on.
        const commented = await sql`
          SELECT up.user_id
          FROM post_comments pc
          JOIN user_posts up ON up.id = pc.post_id
          WHERE pc.user_id = ${viewerId}
        `;
        for (const r of commented as any[]) {
          if (r.user_id) engagedUserIds.add(String(r.user_id));
        }

        // Authors the viewer follows.
        const follows = await sql`
          SELECT following_id FROM user_follows WHERE follower_id = ${viewerId}
        `;
        for (const r of follows as any[]) {
          if (r.following_id) engagedUserIds.add(String(r.following_id));
        }
      }

      // Interest matching uses only strongly-enough-learned / manual interests.
      const viParam = combinedMatchInterests;

      const rows = await sql`
        SELECT
          sp.id,
          'salon' AS post_type,
          sp.salon_id AS salon_id,
          sp.owner_id AS owner_id,
          sp.salon_name AS salon_name,
          NULL::text AS user_id,
          NULL::text AS user_name,
          NULL::text AS user_username,
          NULL::text AS user_avatar,
          sp.image_url,
          sp.caption,
          sp.created_at,
          sp.updated_at,
          sp.like_count,
          sp.comment_count,
          EXISTS(
            SELECT 1
            FROM post_likes pl
            WHERE pl.post_type = 'salon'
              AND pl.post_id = sp.id
              AND pl.user_id = ${viewerId}
          ) AS liked_by_me,
          (owner.interests && ${viParam}::text[]) AS interest_match,
          owner.interests AS author_interests
        FROM salon_posts sp
        LEFT JOIN users owner ON owner.id = sp.owner_id

        UNION ALL

        SELECT
          up.id,
          'user' AS post_type,
          NULL::text AS salon_id,
          NULL::text AS owner_id,
          NULL::text AS salon_name,
          up.user_id,
          u.name AS user_name,
          u.username AS user_username,
          u.avatar AS user_avatar,
          up.image_url,
          up.caption,
          up.created_at,
          up.updated_at,
          up.like_count,
          up.comment_count,
          EXISTS(
            SELECT 1
            FROM post_likes pl
            WHERE pl.post_type = 'user'
              AND pl.post_id = up.id
              AND pl.user_id = ${viewerId}
          ) AS liked_by_me,
          (u.interests && ${viParam}::text[]) AS interest_match,
          u.interests AS author_interests
        FROM user_posts up
        LEFT JOIN users u ON u.id = up.user_id
        WHERE up.media_type IS DISTINCT FROM 'video'

        ORDER BY created_at DESC
      `;

      const posts: any[] = (rows as any[]).map((p: any) => ({
        id: String(p.id),
        postType: p.post_type === 'user' ? 'user' : 'salon',

        salonId: p.salon_id ? String(p.salon_id) : undefined,
        ownerId: p.owner_id ? String(p.owner_id) : undefined,
        salonName: p.salon_name || undefined,

        userId: p.user_id ? String(p.user_id) : undefined,
        userName: p.user_name || undefined,
        username: p.user_username || undefined,
        userAvatar: p.user_avatar || undefined,

        imageUrl: p.image_url,
        caption: p.caption || '',
        createdAt: new Date(p.created_at).toISOString(),
        updatedAt: p.updated_at
          ? new Date(p.updated_at).toISOString()
          : undefined,

        likeCount: Number(p.like_count || 0),
        commentCount: Number(p.comment_count || 0),

        liked: Boolean(p.liked_by_me),
        interestMatch: Boolean(p.interest_match),
        authorInterests: Array.isArray(p.author_interests)
          ? p.author_interests
          : [],
        // Stable source key used by the diversity pass.
        sourceId:
          p.post_type === 'user'
            ? p.user_id
              ? String(p.user_id)
              : `user:${p.id}`
            : p.salon_id
              ? String(p.salon_id)
              : `salon:${p.id}`,
      }));

      // ----- Trending (real recent engagement, time-decayed) -----
      // Uses only real likes/comments from the last TREND_WINDOW_HOURS, so old
      // posts cannot stay trending. Newer engagement is weighted more (exponential
      // decay by event age); the final score is also scaled by the post's own age
      // so a fresh burst outranks an old post's lingering activity. Never creates
      // fake activity — purely derived from real interaction timestamps.
      const TREND_WINDOW_HOURS = 7 * 24;
      const TREND_EVENT_HALF_LIFE_HOURS = 24; // newer engagement ~2x an event twice as old
      const TREND_LAMBDA = Math.LN2 / TREND_EVENT_HALF_LIFE_HOURS;
      const TREND_COMMENT_MULT = 1.5;
      const POST_TREND_HALF_LIFE_HOURS = 72; // old posts' trending fades

      const recentRows = await sql`
        SELECT post_id, post_type, created_at, 1.0 AS kind_weight
        FROM post_likes
        WHERE created_at > NOW() - (${TREND_WINDOW_HOURS} * INTERVAL '1 hour')
        UNION ALL
        SELECT pc.post_id,
               CASE WHEN up.id IS NOT NULL THEN 'user' ELSE 'salon' END AS post_type,
               pc.created_at, ${TREND_COMMENT_MULT} AS kind_weight
        FROM post_comments pc
        LEFT JOIN user_posts up ON up.id = pc.post_id
        WHERE pc.created_at > NOW() - (${TREND_WINDOW_HOURS} * INTERVAL '1 hour')
      `;

      const trendRawMap = new Map<string, number>(); // key: postId -> raw trending weight
      let trendMax = 0;
      for (const e of recentRows as any[]) {
        const id = String(e.post_id);
        const ageHours = Math.max(
          0,
          (Date.now() - new Date(e.created_at).getTime()) / 3600000
        );
        const raw =
          (trendRawMap.get(id) || 0) +
          Number(e.kind_weight) * Math.exp(-TREND_LAMBDA * ageHours);
        trendRawMap.set(id, raw);
        if (raw > trendMax) trendMax = raw;
      }

      // ----- Cold Start ranking -----
      const now = Date.now();
      const HALF_LIFE_HOURS = 72;
      let maxEng = 0;
      for (const p of posts) {
        const eng = p.likeCount + 2 * p.commentCount;
        if (eng > maxEng) maxEng = eng;
      }
      const logMax = Math.log1p(maxEng);

      const engagedCount = engagedUserIds.size + engagedSalonIds.size;
      // Activity level: 0 for a brand-new user -> 1 after ~10 real interactions.
      // Drives the gradual transition from Cold Start to a personalized feed.
      const activity = Math.min(engagedCount / 10, 1);

      // Interests (own + implied from interactions) influence ranking from the
      // start; the weight grows a little as real activity accumulates.
      const hasAffinity = combinedMatchInterests.length > 0;
      const interestWeight = hasAffinity ? 0.6 + 0.4 * activity : 0;
      // Previous real interactions (likes/comments/follows) personalize more as
      // the viewer engages more.
      const personalWeight = activity;
      // Trending is global (real recent engagement) and applies to every viewer,
      // including brand-new ones on Cold Start — it never overrides personalization.
      const trendWeight = 0.5;

      for (const p of posts) {
        const hours = Math.max(
          0,
          (now - new Date(p.createdAt).getTime()) / 3600000
        );
        const recency = Math.pow(0.5, hours / HALF_LIFE_HOURS); // (0,1]
        const engagement =
          logMax > 0
            ? Math.log1p(p.likeCount + 2 * p.commentCount) / logMax
            : 0; // (0,1]
        const cold = 0.55 * recency + 0.45 * engagement;

        const personalMatch =
          (p.postType === 'user' &&
            !!p.userId &&
            engagedUserIds.has(p.userId)) ||
          (p.postType === 'salon' &&
            ((!!p.salonId && engagedSalonIds.has(p.salonId)) ||
              (!!p.ownerId && engagedUserIds.has(p.ownerId))));

        // Interest signal from combined (manual + learned) weights: matching an
        // author's topic nudges the post up, and repeated engagement (higher
        // learned weight) pushes it higher — gradual, never fake.
        let matchedWeight = 0;
        for (const i of p.authorInterests as string[]) {
          const w = combinedMap.get(i);
          if (w) matchedWeight += w;
        }
        const interestSignal = Math.min(1, matchedWeight / 2.0); // 0..1
        const interactionSignal = personalMatch ? 1 : 0; // 0..1

        // Trending: recent-engagement velocity, decayed by the post's own age so
        // an old post can't linger at the top indefinitely.
        const postRecency = Math.pow(0.5, hours / POST_TREND_HALF_LIFE_HOURS);
        const trendScore =
          trendMax > 0 ? (trendRawMap.get(p.id) || 0) / trendMax * postRecency : 0; // 0..~1

        // Cold Start always contributes; personalization + trending are layered on
        // top and scale with genuine user activity / real engagement.
        p.score =
          cold +
          interestWeight * interestSignal +
          personalWeight * interactionSignal +
          trendWeight * trendScore;
      }

      posts.sort(
        (a, b) =>
          b.score - a.score ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // ----- Content diversity: avoid 3+ consecutive posts from the same source -----
      const diversify = (list: any[]) => {
        const out: any[] = [];
        const delayed: any[] = [];
        for (const p of list) {
          const last1 = out[out.length - 1];
          const last2 = out[out.length - 2];
          if (
            last1 &&
            last2 &&
            last1.sourceId === p.sourceId &&
            last2.sourceId === p.sourceId
          ) {
            delayed.push(p);
          } else {
            out.push(p);
          }
        }
        out.push(...delayed);
        return out;
      };
      const ranked = diversify(posts);

      // Strip internal scoring fields before returning.
      return ranked.map(({ score, interestMatch, sourceId, ...rest }: any) => rest);
    } catch (error: any) {
      console.error(
        '[getUnifiedPostsFeed] فشل جلب الـFeed الموحد:',
        error?.message || error
      );
      return [];
    }
  }

  async createUserPost(
    data: {
      imageUrl?: string;
      caption?: string;
      mediaType?: 'image' | 'video';
      duration?: number;
    },
    requestingUser: User
  ): Promise<{ success: boolean; blocked?: boolean; post?: UserPost; error?: string }> {
    try {
      const hasMedia = Boolean(data.imageUrl?.trim());
      const captionText = (data.caption || '').trim();
      const mediaType = data.mediaType === 'video' ? 'video' : 'image';

      // A post must have at least media or a caption.
      if (!hasMedia && !captionText) {
        return {
          success: false,
          error: 'المنشور يحتاج صورة أو فيديو أو نص.',
        };
      }

      // Block abusive captions before they are saved.
      const mod = moderateContent(captionText);
      if (mod.blocked) {
        return { success: false, blocked: true, error: mod.message };
      }

      const post: UserPost = {
        id: `user_post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId: requestingUser.id,
        userName: requestingUser.name || 'مستخدم',
        userAvatar: requestingUser.avatar || undefined,
        imageUrl: hasMedia ? data.imageUrl!.trim() : undefined,
        caption: captionText,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0,
        mediaType,
        duration: mediaType === 'video' ? Number(data.duration || 0) : undefined,
      };

      await sql`
        INSERT INTO user_posts
        (
          id,
          user_id,
          image_url,
          caption,
          media_type,
          duration,
          created_at,
          updated_at,
          like_count,
          comment_count
        )
        VALUES
        (
          ${post.id},
          ${post.userId},
          ${post.imageUrl ?? null},
          ${post.caption},
          ${post.mediaType},
          ${post.duration ?? null},
          ${post.createdAt},
          ${post.createdAt},
          0,
          0
        )
      `;

      return {
        success: true,
        post,
      };
    } catch (error: any) {
      console.error(
        '[createUserPost] فشل حفظ منشور المستخدم:',
        error?.message || error
      );

      return {
        success: false,
        error: 'تعذر حفظ المنشور في قاعدة البيانات.',
      };
    }
  }

  async createSalonPost(
    data: {
      salonId: string;
      imageUrl: string;
      caption: string;
    },
    requestingUser: User
  ): Promise<{ success: boolean; blocked?: boolean; post?: SalonPost; error?: string }> {
    if (requestingUser.role !== 'salon_owner' && requestingUser.role !== 'admin') {
      return { success: false, error: 'غير مسموح لك بنشر منشورات.' };
    }
    // Neon is the authoritative source for salons.
    // Local memory can be stale after deployment/restart.
    let salon = await this.getSalonByIdFromNeon(data.salonId);

    // Fallback to local memory only if Neon lookup returns nothing.
    if (!salon) {
      salon = this.state.salons.find((s) => s.id === data.salonId);
    }

    if (!salon) {
      return { success: false, error: 'الصالون غير موجود.' };
    }

    if (
      requestingUser.role === 'salon_owner' &&
      (salon.status !== 'approved' || salon.ownerId !== requestingUser.id)
    ) {
      return { success: false, error: 'لا يمكنك النشر في صالون آخر.' };
    }


    if (!data.imageUrl?.trim()) {
      return { success: false, error: 'صورة المنشور مطلوبة.' };
    }

    // Block abusive captions before they are saved.
    const mod = moderateContent(data.caption || '');
    if (mod.blocked) {
      return { success: false, blocked: true, error: mod.message };
    }

    const post: SalonPost = {
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      salonId: salon.id,
      ownerId: salon.ownerId,
      salonName: salon.name,
      imageUrl: data.imageUrl.trim(),
      caption: (data.caption || '').trim(),
      createdAt: new Date().toISOString(),
      likeCount: 0,
      commentCount: 0,
    };

    this.state.salonPosts.unshift(post);

    try {
      await sql`
        INSERT INTO salon_posts
        (id, salon_id, owner_id, salon_name, image_url, caption, created_at, updated_at, like_count, comment_count)
        VALUES
        (${post.id}, ${post.salonId}, ${post.ownerId}, ${post.salonName},
         ${post.imageUrl}, ${post.caption}, ${post.createdAt}, ${post.createdAt}, 0, 0)
        ON CONFLICT (id) DO NOTHING
      `;
    } catch (error: any) {
      console.error('فشل حفظ المنشور في Neon:', error.message);
      return {
        success: false,
        error: 'تعذر حفظ المنشور في قاعدة البيانات.',
      };
    }

    return { success: true, post };
  }

  async deleteSalonPost(
    postId: string,
    requestingUser: User
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Single CTE: verify post exists, check authorization, and delete
      // the post plus all related likes and comments in one round trip.
      //
      // Authorization rules (identical to the previous multi-query version):
      //   - admin                         → always allowed
      //   - salon_owner + post has salon  → allowed only when the salon
      //                                     is approved and owned by the
      //                                     requesting user (Neon lookup)
      //   - any other role                → rejected
      const deleteRows = await sql`
        WITH post_check AS (
          SELECT id, salon_id, owner_id
          FROM salon_posts
          WHERE id = ${postId}
          LIMIT 1
        ),
        owner_check AS (
          SELECT
            pc.id,
            pc.salon_id,
            pc.owner_id,
            CASE
              WHEN ${requestingUser.role} = 'admin' THEN true
              WHEN ${requestingUser.role} = 'salon_owner' AND pc.salon_id IS NOT NULL THEN
                EXISTS(
                  SELECT 1
                  FROM salons s
                  WHERE s.id = pc.salon_id
                    AND s.owner_id = ${requestingUser.id}
                    AND s.status = 'approved'
                )
              ELSE false
            END AS allowed
          FROM post_check pc
        ),
        del_likes AS (
          DELETE FROM post_likes pl
          USING owner_check oc
          WHERE oc.allowed AND pl.post_id = oc.id
          RETURNING 1
        ),
        del_comments AS (
          DELETE FROM post_comments pcom
          USING owner_check oc
          WHERE oc.allowed AND pcom.post_id = oc.id
          RETURNING 1
        )
        DELETE FROM salon_posts sp
        USING owner_check oc
        WHERE oc.allowed AND sp.id = oc.id
        RETURNING oc.allowed
      `;

      if (!deleteRows.length) {
        // Either the post does not exist, or the user is not authorized.
        // Reproduce the exact original error messages.
        const postExists = await sql`
          SELECT id FROM salon_posts WHERE id = ${postId} LIMIT 1
        `;

        if (!postExists.length) {
          return { success: false, error: 'المنشور غير موجود.' };
        }

        return { success: false, error: 'غير مسموح لك بحذف هذا المنشور.' };
      }

      this.state.salonPosts = this.state.salonPosts.filter(
        (p) => p.id !== postId
      );

      return { success: true };
    } catch (error: any) {
      console.error('فشل حذف المنشور من Neon:', error?.message || error);
      return {
        success: false,
        error: 'تعذر حذف المنشور من قاعدة البيانات.',
      };
    }
  }

  // FEATURE: delete a user's own published photo/post. Ownership (or admin) is
  // enforced in SQL; cascades likes + comments so the photo is gone everywhere.
  async deleteUserPost(
    postId: string,
    requestingUser: User
  ): Promise<{ success: boolean; imageUrl?: string | null; error?: string }> {
    try {
      const deleteRows = await sql`
        WITH post_check AS (
          SELECT id, user_id
          FROM user_posts
          WHERE id = ${postId}
          LIMIT 1
        ),
        owner_check AS (
          SELECT
            pc.id,
            pc.user_id,
            CASE
              WHEN ${requestingUser.role} = 'admin' THEN true
              WHEN pc.user_id = ${requestingUser.id} THEN true
              ELSE false
            END AS allowed
          FROM post_check pc
        ),
        del_likes AS (
          DELETE FROM post_likes pl
          USING owner_check oc
          WHERE oc.allowed AND pl.post_type = 'user' AND pl.post_id = oc.id
          RETURNING 1
        ),
        del_comments AS (
          DELETE FROM post_comments pcom
          USING owner_check oc
          WHERE oc.allowed AND pcom.post_id = oc.id
          RETURNING 1
        )
        DELETE FROM user_posts up
        USING owner_check oc
        WHERE oc.allowed AND up.id = oc.id
        RETURNING oc.allowed, up.image_url
      `;

      if (!deleteRows.length) {
        const postExists = await sql`
          SELECT id FROM user_posts WHERE id = ${postId} LIMIT 1
        `;
        if (!postExists.length) {
          return { success: false, error: 'المنشور غير موجود.' };
        }
        return { success: false, error: 'غير مسموح لك بحذف هذا المنشور.' };
      }

      return {
        success: true,
        imageUrl: deleteRows[0]?.image_url ?? null,
      };
    } catch (error: any) {
      console.error('فشل حذف منشور المستخدم من Neon:', error?.message || error);
      return {
        success: false,
        error: 'تعذر حذف المنشور من قاعدة البيانات.',
      };
    }
  }

  async togglePostLike(
    postId: string,
    requestingUser: User,
    postType: 'salon' | 'user' = 'salon'
  ): Promise<{
    success: boolean;
    liked?: boolean;
    likeCount?: number;
    error?: string;
  }> {
    try {
      // Single CTE: verify post exists, check for existing like,
      // then INSERT or DELETE in one round trip.
      const toggleRows = postType === 'user'
        ? await sql`
            WITH post_check AS (
              SELECT id, user_id
              FROM user_posts
              WHERE id = ${postId}
              LIMIT 1
            ),
            existing_like AS (
              SELECT id
              FROM post_likes
              WHERE post_type = ${postType}
                AND post_id = ${postId}
                AND user_id = ${requestingUser.id}
              LIMIT 1
            ),
            toggled AS (
              DELETE FROM post_likes
              WHERE EXISTS (SELECT 1 FROM existing_like)
                AND post_type = ${postType}
                AND post_id = ${postId}
                AND user_id = ${requestingUser.id}
              RETURNING 'unliked' AS action
            ),
            inserted AS (
              INSERT INTO post_likes (id, post_type, post_id, user_id, created_at)
              SELECT
                'like_' || ${Date.now()} || '_' || substr(md5(random()::text), 1, 5),
                ${postType},
                ${postId},
                ${requestingUser.id},
                NOW()
              WHERE NOT EXISTS (SELECT 1 FROM existing_like)
                AND EXISTS (SELECT 1 FROM post_check)
              RETURNING 'liked' AS action
            )
            SELECT
              pc.user_id AS post_owner_id,
              COALESCE(t.action, i.action) AS action
            FROM post_check pc
            LEFT JOIN toggled t ON true
            LEFT JOIN inserted i ON true
          `
        : await sql`
            WITH post_check AS (
              SELECT id, owner_id AS post_owner_id
              FROM salon_posts
              WHERE id = ${postId}
              LIMIT 1
            ),
            existing_like AS (
              SELECT id
              FROM post_likes
              WHERE post_type = ${postType}
                AND post_id = ${postId}
                AND user_id = ${requestingUser.id}
              LIMIT 1
            ),
            toggled AS (
              DELETE FROM post_likes
              WHERE EXISTS (SELECT 1 FROM existing_like)
                AND post_type = ${postType}
                AND post_id = ${postId}
                AND user_id = ${requestingUser.id}
              RETURNING 'unliked' AS action
            ),
            inserted AS (
              INSERT INTO post_likes (id, post_type, post_id, user_id, created_at)
              SELECT
                'like_' || ${Date.now()} || '_' || substr(md5(random()::text), 1, 5),
                ${postType},
                ${postId},
                ${requestingUser.id},
                NOW()
              WHERE NOT EXISTS (SELECT 1 FROM existing_like)
                AND EXISTS (SELECT 1 FROM post_check)
              RETURNING 'liked' AS action
            )
            SELECT
              pc.post_owner_id,
              COALESCE(t.action, i.action) AS action
            FROM post_check pc
            LEFT JOIN toggled t ON true
            LEFT JOIN inserted i ON true
          `;

      const toggleRow = toggleRows[0] as any;

      if (!toggleRow?.action) {
        return { success: false, error: 'المنشور غير موجود.' };
      }

      const liked = toggleRow.action === 'liked';

      // Interest Learning: reinforce (or reverse on unlike) the topics of the
      // post's author from real interaction. Skip self-interaction.
      if (
        toggleRow.post_owner_id &&
        String(toggleRow.post_owner_id) !== String(requestingUser.id)
      ) {
        const ownerRows = await sql`
          SELECT interests FROM users WHERE id = ${toggleRow.post_owner_id} LIMIT 1
        `;
        const ownerInterests = Array.isArray(ownerRows[0]?.interests)
          ? ownerRows[0].interests
          : [];
        await recordInterestLearning(
          requestingUser.id,
          ownerInterests,
          liked ? LEARN_LIKE_STEP : -LEARN_LIKE_STEP
        );
      }

      // Notify post owner on like (not on unlike, not self-notify).
      // Works for both salon and user posts now that salon CTE returns owner_id.
      if (
        liked &&
        toggleRow.post_owner_id &&
        String(toggleRow.post_owner_id) !== String(requestingUser.id)
      ) {
        this.createNotification({
          userId: toggleRow.post_owner_id,
          actorUserId: requestingUser.id,
          title: 'إعجاب جديد بمنشورك',
          titleEn: 'New Like on Your Post',
          message: `أعجب ${requestingUser.name || 'مستخدم'} بمنشورك.`,
          messageEn: `${requestingUser.name || 'A user'} liked your post.`,
          type: 'post_like',
          link: `/posts?postId=${postId}`,
        }).catch(() => {});
      }

      // Single query: count + update post counter.
      const countRows = await sql`
        SELECT COUNT(*)::int AS count
        FROM post_likes
        WHERE post_type = ${postType}
          AND post_id = ${postId}
      `;

      const likeCount = Number(countRows[0]?.count || 0);

      if (postType === 'user') {
        await sql`
          UPDATE user_posts
          SET like_count = ${likeCount},
              updated_at = NOW()
          WHERE id = ${postId}
        `;
      } else {
        await sql`
          UPDATE salon_posts
          SET like_count = ${likeCount},
              updated_at = NOW()
          WHERE id = ${postId}
        `;
      }

      const localSalonPost = this.state.salonPosts.find(
        (p) => p.id === postId
      );

      if (localSalonPost && postType === 'salon') {
        localSalonPost.likeCount = likeCount;
      }

      return {
        success: true,
        liked,
        likeCount,
      };
    } catch (error: any) {
      console.error(
        'فشل تحديث إعجاب المنشور في Neon:',
        error?.message || error
      );

      return {
        success: false,
        error: 'تعذر تحديث الإعجاب.',
      };
    }
  }

  async getPostLikeStatus(
    postId: string,
    userId: string,
    postType: 'salon' | 'user' = 'salon'
  ): Promise<{ liked: boolean; likeCount: number }> {
    try {
      const rows = await sql`
        SELECT
          EXISTS(
            SELECT 1
            FROM post_likes
            WHERE post_type = ${postType}
              AND post_id = ${postId}
              AND user_id = ${userId}
          ) AS liked,
          (
            SELECT COUNT(*)::int
            FROM post_likes
            WHERE post_type = ${postType}
              AND post_id = ${postId}
          ) AS like_count
      `;

      return {
        liked: Boolean(rows[0]?.liked),
        likeCount: Number(rows[0]?.like_count || 0),
      };
    } catch (error: any) {
      console.error(
        'فشل جلب حالة الإعجاب من Neon:',
        error?.message || error
      );

      // Neon هو مصدر الحقيقة؛ لا نرجع بيانات من الذاكرة القديمة.
      return {
        liked: false,
        likeCount: 0,
      };
    }
  }

  // ===================== BOT SYSTEM =====================
  // All bot data is stored alongside real users/posts via the existing
  // infrastructure. Bots are flagged with is_bot and a per-bot enabled
  // flag; the engine never books salons or performs payments.

  async ensureBotTables(): Promise<void> {
    try {
      await sql`
        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS bio TEXT
      `;
    } catch (e: any) {
      console.error('[BOTS] ensure users bot columns:', e?.message || e);
    }
    await sql`
      CREATE TABLE IF NOT EXISTS bot_profiles (
        id TEXT PRIMARY KEY,
        personality TEXT NOT NULL DEFAULT '',
        interests TEXT NOT NULL DEFAULT '[]'
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS bot_control (
        id TEXT PRIMARY KEY,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      INSERT INTO bot_control (id, enabled)
      VALUES ('global', FALSE)
      ON CONFLICT (id) DO NOTHING
    `;
    // Backfill any legacy bot rows that were created before bot_enabled had a
    // NOT NULL DEFAULT, so they are counted as active and can act.
    await sql`UPDATE users SET bot_enabled = TRUE WHERE is_bot AND bot_enabled IS NULL`;
    await sql`
      CREATE TABLE IF NOT EXISTS bot_media (
        role TEXT PRIMARY KEY,
        urls TEXT NOT NULL DEFAULT '[]'
      )
    `;
  }

  /**
   * Ensures the schema extensions required by the Reels (video posts) feature:
   * - user_posts.media_type: 'image' (default) or 'video'
   * - user_posts.duration: video length in seconds (Reels only)
   * - users.is_premium: unlocks the extended 120s Reels limit for premium members
   * Runs idempotently at server start.
   */
  async ensureReelsTables(): Promise<void> {
    try {
      await sql`
        ALTER TABLE user_posts
          ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image',
          ADD COLUMN IF NOT EXISTS duration INTEGER
      `;
      await sql`
        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE
      `;
    } catch (e: any) {
      console.error('[REELS] ensure schema:', e?.message || e);
    }
  }

  /**
   * USERNAME SYSTEM
   *
   * Adds the `username` column to the users table plus a case-insensitive
   * unique index (LOWER(username)). NULL usernames (legacy accounts, bots,
   * reserved-but-unclaimed handles) are allowed to coexist, so the unique
   * index is created with a partial WHERE clause.
   *
   * Runs idempotently at server start.
   */
  async ensureUsernameTables(): Promise<void> {
    try {
      await sql`
        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS username TEXT
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower
          ON users (LOWER(username))
          WHERE username IS NOT NULL
      `;
    } catch (e: any) {
      console.error('[USERNAME] ensure schema:', e?.message || e);
    }
  }

  /**
   * Returns Reels (video posts) ordered newest-first. Like state is computed
   * for the requesting viewer so the client can render the correct heart.
   */
  async getReelsFeed(viewerUserId?: string): Promise<any[]> {
    try {
      const viewerId = viewerUserId || '';
      const rows = await sql`
        SELECT
          up.id,
          up.user_id,
          up.image_url,
          up.caption,
          up.media_type,
          up.duration,
          up.created_at,
          up.updated_at,
          up.like_count,
          up.comment_count,
          u.name AS user_name,
          u.username AS user_username,
          u.avatar AS user_avatar,
          EXISTS(
            SELECT 1 FROM post_likes pl
            WHERE pl.post_type = 'user'
              AND pl.post_id = up.id
              AND pl.user_id = ${viewerId}
          ) AS liked_by_me
        FROM user_posts up
        LEFT JOIN users u ON u.id = up.user_id
        WHERE up.media_type = 'video'
        ORDER BY up.created_at DESC
      `;

      return (rows as any[]).map((p: any) => ({
        id: String(p.id),
        userId: String(p.user_id),
        userName: p.user_name || 'مستخدم',
        username: p.user_username || undefined,
        userAvatar: p.user_avatar || undefined,
        imageUrl: p.image_url,
        caption: p.caption || '',
        mediaType: 'video' as const,
        duration: p.duration ? Number(p.duration) : undefined,
        createdAt: p.created_at
          ? new Date(p.created_at).toISOString()
          : new Date().toISOString(),
        updatedAt: p.updated_at
          ? new Date(p.updated_at).toISOString()
          : undefined,
        likeCount: Number(p.like_count || 0),
        commentCount: Number(p.comment_count || 0),
        liked: Boolean(p.liked_by_me),
      }));
    } catch (error: any) {
      console.error('[getReelsFeed] فشل جلب الريلز:', error?.message || error);
      return [];
    }
  }

  /** Grants or revokes Premium status for a user (admin only). */
  async setUserPremium(
    userId: string,
    isPremium: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await sql`UPDATE users SET is_premium = ${isPremium} WHERE id = ${userId}`;
      const st = this.getState().users.find((u) => u.id === userId);
      if (st) st.isPremium = isPremium;
      return { success: true };
    } catch (e: any) {
      console.error('[setUserPremium]', e?.message || e);
      return { success: false, error: 'تعذر تحديث حالة البريميوم.' };
    }
  }

  /** Loads the persisted bot media pools (Supabase URLs) if previously built. */
  async loadBotMedia(): Promise<{ men: string[]; women: string[]; posts: string[] } | null> {
    try {
      const rows = await sql`SELECT role, urls FROM bot_media`;
      const map: Record<string, string[]> = {};
      for (const r of rows as any[]) {
        try {
          map[r.role] = JSON.parse(r.urls || '[]');
        } catch {
          map[r.role] = [];
        }
      }
      if (!map['avatars_men'] && !map['avatars_women'] && !map['posts']) return null;
      return {
        men: map['avatars_men'] || [],
        women: map['avatars_women'] || [],
        posts: map['posts'] || [],
      };
    } catch {
      return null;
    }
  }

  async saveBotMedia(men: string[], women: string[], posts: string[]): Promise<void> {
    await sql`
      INSERT INTO bot_media (role, urls) VALUES
        ('avatars_men', ${JSON.stringify(men)}),
        ('avatars_women', ${JSON.stringify(women)}),
        ('posts', ${JSON.stringify(posts)})
      ON CONFLICT (role) DO UPDATE SET urls = EXCLUDED.urls
    `;
  }

  /** Bots needing an avatar migration off DiceBear (real human photos). */
  async getAllBotsForMedia(): Promise<{ id: string; name: string; avatar?: string }[]> {
    const rows = await sql`SELECT id, name, avatar FROM users WHERE is_bot`;
    return rows as any[];
  }

  async updateUserAvatarColumn(id: string, avatar: string): Promise<void> {
    await sql`UPDATE users SET avatar = ${avatar} WHERE id = ${id}`;
  }

  /** Bot post image rows that still point at a non-Supabase (broken) host. */
  async getBrokenBotPostIds(): Promise<string[]> {
    const rows = await sql`
      SELECT p.id FROM user_posts p
      WHERE p.user_id IN (SELECT id FROM users WHERE is_bot)
        AND p.image_url IS NOT NULL
        AND p.image_url NOT LIKE '%supabase%'
    `;
    return (rows as any[]).map((r) => r.id);
  }

  async updateUserPostImage(id: string, url: string): Promise<void> {
    await sql`UPDATE user_posts SET image_url = ${url} WHERE id = ${id}`;
  }

  /** One-time bot-media migration completion flag (stored in bot_media). */
  async getBotMediaMigrationFlag(): Promise<boolean> {
    try {
      const rows = await sql`SELECT urls FROM bot_media WHERE role = 'migration_done' LIMIT 1`;
      return rows[0]?.urls === 'done';
    } catch {
      return false;
    }
  }

  async setBotMediaMigrationFlag(): Promise<void> {
    await sql`
      INSERT INTO bot_media (role, urls) VALUES ('migration_done', 'done')
      ON CONFLICT (role) DO UPDATE SET urls = EXCLUDED.urls
    `;
  }


  async getBotControl(): Promise<boolean> {
    await this.ensureBotTables();
    const rows = await sql`SELECT enabled FROM bot_control WHERE id = 'global' LIMIT 1`;
    return Boolean(rows[0]?.enabled);
  }

  async setBotControl(enabled: boolean): Promise<void> {
    await this.ensureBotTables();
    await sql`
      INSERT INTO bot_control (id, enabled, updated_at)
      VALUES ('global', ${enabled}, NOW())
      ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()
    `;
  }

  async getBotStats(): Promise<{ total: number; active: number; stopped: number }> {
    await this.ensureBotTables();
    const rows = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_bot AND bot_enabled IS NOT FALSE)::int AS enabled
      FROM users
    `;
    const total = Number(rows[0]?.total || 0);
    const enabledCount = Number(rows[0]?.enabled || 0);
    // "Active" reflects bots that are actually allowed to act right now:
    // account-enabled AND the global engine flag is ON. This makes the stats
    // track real runtime behavior, not just the per-account flag.
    const globalOn = await this.getBotControl();
    const active = globalOn ? enabledCount : 0;
    const stopped = total - active;
    return { total, active, stopped };
  }

  async countBots(): Promise<number> {
    const rows = await sql`SELECT COUNT(*)::int AS c FROM users WHERE is_bot`;
    return Number(rows[0]?.c || 0);
  }

  async createBot(bot: {
    name: string;
    avatar: string;
    bio: string;
    city: string;
    personality: string;
    interests: string[];
  }): Promise<UserWithAuth | null> {
    try {
      const id = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const email = `${id}@halaqi.bot`;
      const phone = `0${Math.floor(7000000000 + Math.random() * 2999999999)}`;
      const newUser: UserWithAuth = {
        id,
        name: bot.name.trim(),
        email,
        phone,
        role: 'customer',
        city: bot.city,
        avatar: bot.avatar,
        bio: bot.bio,
        isBot: true,
        botEnabled: true,
        isActive: true,
        isBanned: false,
        createdAt: new Date().toISOString(),
      };
      this.state.users.push(newUser);
      await this.persistUserToNeon(id);
      await sql`
        INSERT INTO bot_profiles (id, personality, interests)
        VALUES (${id}, ${bot.personality}, ${JSON.stringify(bot.interests)})
        ON CONFLICT (id) DO UPDATE SET personality = EXCLUDED.personality, interests = EXCLUDED.interests
      `;
      return newUser;
    } catch (e: any) {
      console.error('[BOTS] createBot failed:', e?.message || e);
      return null;
    }
  }

  async getActiveBots(limit: number): Promise<UserWithAuth[]> {
    const rows = await sql`
      SELECT id, name, avatar, city, bio, bot_enabled
      FROM users WHERE is_bot AND bot_enabled IS NOT FALSE ORDER BY random() LIMIT ${limit}
    `;
    return rows as any[];
  }

  async getBotProfile(botId: string): Promise<{ personality: string; interests: string[] } | null> {
    const rows = await sql`SELECT personality, interests FROM bot_profiles WHERE id = ${botId} LIMIT 1`;
    if (!rows.length) return null;
    let interests: string[] = [];
    try {
      interests = JSON.parse(rows[0].interests || '[]');
    } catch {
      interests = [];
    }
    return { personality: rows[0].personality || '', interests };
  }

  async getRandomHumanUsers(count: number, excludeId?: string): Promise<UserWithAuth[]> {
    const rows = await sql`
      SELECT id, name, avatar, city, bio FROM users
      WHERE is_bot IS NOT TRUE AND is_active IS NOT FALSE AND is_banned IS NOT TRUE
        ${excludeId ? sql`AND id <> ${excludeId}` : sql``}
      ORDER BY random()
      LIMIT ${count}
    `;
    return rows as any[];
  }

  async getRandomUserPosts(count: number): Promise<{ id: string; userId: string }[]> {
    const rows = await sql`SELECT id, user_id FROM user_posts ORDER BY random() LIMIT ${count}`;
    return rows as any[];
  }

  async followUser(followerId: string, followingId: string): Promise<boolean> {
    if (followerId === followingId) return false;
    try {
      await sql`
        INSERT INTO user_follows (id, follower_id, following_id)
        SELECT
          'follow_' || ${Date.now()} || '_' || substr(md5(random()::text), 1, 8),
          ${followerId},
          ${followingId}
        WHERE NOT EXISTS (
          SELECT 1 FROM user_follows WHERE follower_id = ${followerId} AND following_id = ${followingId}
        )
        AND EXISTS (
          SELECT 1 FROM users WHERE id = ${followingId} AND is_bot IS NOT TRUE
        )
      `;
      return true;
    } catch (e: any) {
      console.error('[BOTS] followUser failed:', e?.message || e);
      return false;
    }
  }

  async unfollowUser(followerId: string, followingId: string): Promise<boolean> {
    try {
      await sql`DELETE FROM user_follows WHERE follower_id = ${followerId} AND following_id = ${followingId}`;
      return true;
    } catch (e: any) {
      console.error('[BOTS] unfollowUser failed:', e?.message || e);
      return false;
    }
  }

  async sendDirectMessage(
    senderId: string,
    recipientId: string,
    body: string,
    media?: { type: 'image' | 'audio'; mediaUrl: string; thumbnail?: string; metadata?: any }
  ): Promise<boolean> {
    if (senderId === recipientId) return false;
    try {
      const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const createdAt = new Date().toISOString();
      const msgType = media?.type ?? 'text';
      const finalBody =
        body && body.trim()
          ? body.trim()
          : msgType === 'image'
            ? '📷'
            : '🎤';
      await sql`
        INSERT INTO messages (
          id, sender_id, recipient_id, body, read, status, created_at, type,
          media_url, media_thumbnail, media_metadata
        )
        VALUES (
          ${id}, ${senderId}, ${recipientId}, ${finalBody}, FALSE, 'sent', ${createdAt}, ${msgType},
          ${media?.mediaUrl ?? null}, ${media?.thumbnail ?? null},
          ${media?.metadata ? JSON.stringify(media.metadata) : null}
        )
      `;
      return true;
    } catch (e: any) {
      console.error('[BOTS] sendDirectMessage failed:', e?.message || e);
      return false;
    }
  }

  async addPostComment(
    data: {
      postId: string;
      comment: string;
    },
    requestingUser: User
  ): Promise<{
    success: boolean;
    blocked?: boolean;
    comment?: PostComment;
    error?: string;
  }> {
    try {
      if (!data.comment?.trim()) {
        return {
          success: false,
          error: 'التعليق لا يمكن أن يكون فارغاً.',
        };
      }

      // Block abusive comments before they are saved.
      const mod = moderateContent(data.comment);
      if (mod.blocked) {
        return { success: false, blocked: true, error: mod.message };
      }

      const commentId =
        `comment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const createdAt = new Date().toISOString();
      const trimmedComment = data.comment.trim();

      // Single CTE: detect post type + owner, insert comment in one round trip.
      const insertRows = await sql`
        WITH salon_post AS (
          SELECT id, owner_id AS post_owner_id, 'salon' AS detected_type
          FROM salon_posts
          WHERE id = ${data.postId}
          LIMIT 1
        ),
        user_post AS (
          SELECT id, user_id AS post_owner_id, 'user' AS detected_type
          FROM user_posts
          WHERE id = ${data.postId}
          LIMIT 1
        ),
        post_info AS (
          SELECT post_owner_id, detected_type
          FROM salon_post
          UNION ALL
          SELECT post_owner_id, detected_type
          FROM user_post
          LIMIT 1
        ),
        ins AS (
          INSERT INTO post_comments
            (id, post_id, user_id, user_name, user_avatar, comment, created_at)
          SELECT
            ${commentId},
            ${data.postId},
            ${requestingUser.id},
            ${requestingUser.name},
            ${requestingUser.avatar || null},
            ${trimmedComment},
            ${createdAt}
          WHERE EXISTS (SELECT 1 FROM post_info)
          RETURNING id
        )
        SELECT pi.post_owner_id, pi.detected_type
        FROM post_info pi
      `;

      if (!insertRows.length) {
        return { success: false, error: 'المنشور غير موجود.' };
      }

      const postOwnerId = String(insertRows[0]?.post_owner_id || '');
      const postType = insertRows[0]?.detected_type as 'salon' | 'user';

      const comment: PostComment = {
        id: commentId,
        postId: data.postId,
        userId: requestingUser.id,
        userName: requestingUser.name,
        userAvatar: requestingUser.avatar,
        comment: trimmedComment,
        createdAt,
      };

      // Count + update comment_count on the correct post table.
      const countRows = await sql`
        SELECT COUNT(*)::int AS count
        FROM post_comments
        WHERE post_id = ${data.postId}
      `;

      const commentCount = Number(countRows[0]?.count || 0);

      if (postType === 'user') {
        await sql`
          UPDATE user_posts
          SET comment_count = ${commentCount},
              updated_at = NOW()
          WHERE id = ${data.postId}
        `;
      } else {
        await sql`
          UPDATE salon_posts
          SET comment_count = ${commentCount},
              updated_at = NOW()
          WHERE id = ${data.postId}
        `;
      }

      const localSalonPost = this.state.salonPosts.find(
        (p) => p.id === data.postId
      );

      if (localSalonPost) {
        localSalonPost.commentCount = commentCount;
      }

      // Fire-and-forget notification to post owner.
      if (postOwnerId && postOwnerId !== requestingUser.id) {
        this.createNotification({
          userId: postOwnerId,
          actorUserId: requestingUser.id,
          title: `${requestingUser.name} علّق على منشورك`,
          titleEn: `${requestingUser.name} commented on your post`,
          message: `${requestingUser.name} علّق على منشورك`,
          messageEn: `${requestingUser.name} commented on your post`,
          type: 'post_comment',
          link: `/posts?postId=${data.postId}${commentId ? `&commentId=${commentId}` : ''}`,
        }).catch(() => {});

        // Interest Learning: reinforce the author's topics from a real comment.
        const ownerRows = await sql`
          SELECT interests FROM users WHERE id = ${postOwnerId} LIMIT 1
        `;
        const ownerInterests = Array.isArray(ownerRows[0]?.interests)
          ? ownerRows[0].interests
          : [];
        await recordInterestLearning(
          requestingUser.id,
          ownerInterests,
          LEARN_COMMENT_STEP
        );
      }

      return {
        success: true,
        comment,
      };
    } catch (error: any) {
      console.error(
        'فشل إضافة التعليق إلى Neon:',
        error?.message || error
      );

      return {
        success: false,
        error: 'تعذر إضافة التعليق.',
      };
    }
  }

  async getPostComments(
    postId: string,
    userId?: string
  ): Promise<PostComment[]> {
    try {
      await ensureCommentReactionsTables();
      const rows = await sql`
        SELECT
          pc.id,
          pc.post_id,
          pc.user_id,
          u.name AS user_name,
          u.avatar AS user_avatar,
          pc.comment,
          pc.created_at,
          COALESCE(pc.likes, 0) AS likes,
          COALESCE(pc.dislikes, 0) AS dislikes,
          ${
            userId
              ? sql`(SELECT cr.reaction FROM comment_reactions cr WHERE cr.comment_id = pc.id AND cr.user_id = ${userId} LIMIT 1)`
              : sql`NULL::text`
          } AS my_reaction
        FROM post_comments pc
        LEFT JOIN users u ON u.id = pc.user_id
        WHERE pc.post_id = ${postId}
        ORDER BY pc.created_at ASC
      `;

      return rows.map((c: any) => ({
        id: c.id,
        postId: c.post_id,
        userId: c.user_id,
        userName: c.user_name || 'مستخدم',
        userAvatar: c.user_avatar || undefined,
        comment: c.comment,
        createdAt: c.created_at
          ? new Date(c.created_at).toISOString()
          : new Date().toISOString(),
        likes: Number(c.likes || 0),
        dislikes: Number(c.dislikes || 0),
        myReaction: c.my_reaction || null,
      }));
    } catch (error: any) {
      console.error(
        'فشل جلب تعليقات المنشور من Neon:',
        error?.message || error
      );

      // Neon هو مصدر الحقيقة؛ لا نرجع بيانات من الذاكرة القديمة.
      return [];
    }
  }

  async setCommentReaction(
    commentId: string,
    userId: string,
    reaction: 'like' | 'dislike' | null
  ): Promise<{
    success: boolean;
    likes?: number;
    dislikes?: number;
    myReaction?: 'like' | 'dislike' | null;
    error?: string;
  }> {
    try {
      await ensureCommentReactionsTables();

      const exists = await sql`
        SELECT id FROM post_comments WHERE id = ${commentId} LIMIT 1
      `;
      if (!exists.length) {
        return { success: false, error: 'التعليق غير موجود.' };
      }

      if (reaction === null) {
        await sql`
          DELETE FROM comment_reactions
          WHERE comment_id = ${commentId} AND user_id = ${userId}
        `;
      } else {
        await sql`
          INSERT INTO comment_reactions (comment_id, user_id, reaction, created_at)
          VALUES (${commentId}, ${userId}, ${reaction}, NOW())
          ON CONFLICT (comment_id, user_id)
          DO UPDATE SET reaction = EXCLUDED.reaction, created_at = NOW()
        `;
      }

      const counts = await sql`
        SELECT
          COUNT(*) FILTER (WHERE reaction = 'like')::int AS likes,
          COUNT(*) FILTER (WHERE reaction = 'dislike')::int AS dislikes
        FROM comment_reactions
        WHERE comment_id = ${commentId}
      `;
      const likes = Number(counts[0]?.likes || 0);
      const dislikes = Number(counts[0]?.dislikes || 0);

      await sql`
        UPDATE post_comments SET likes = ${likes}, dislikes = ${dislikes}
        WHERE id = ${commentId}
      `;

      const me = await sql`
        SELECT reaction FROM comment_reactions
        WHERE comment_id = ${commentId} AND user_id = ${userId} LIMIT 1
      `;

      return {
        success: true,
        likes,
        dislikes,
        myReaction: (me[0]?.reaction as 'like' | 'dislike' | null) || null,
      };
    } catch (error: any) {
      console.error('فشل تفاعل التعليق:', error?.message || error);
      return { success: false, error: 'تعذر تسجيل التفاعل.' };
    }
  }

  async editPostComment(
    commentId: string,
    requestingUser: User,
    newComment: string
  ): Promise<{
    success: boolean;
    blocked?: boolean;
    comment?: PostComment;
    error?: string;
  }> {
    try {
      const trimmed = (newComment || '').trim();

      if (!trimmed) {
        return {
          success: false,
          error: 'التعليق لا يمكن أن يكون فارغاً.',
        };
      }

      // Ensure the comment schema exists (adds updated_at if missing).
      await ensureCommentReactionsTables();

      // Block abusive edits before they are saved (keep moderation working).
      const mod = moderateContent(trimmed);
      if (mod.blocked) {
        return { success: false, blocked: true, error: mod.message };
      }

      const rows = await sql`
        SELECT
          pc.id,
          pc.post_id,
          pc.user_id,
          pc.likes,
          pc.dislikes,
          pc.created_at,
          sp.salon_id,
          CASE
            WHEN sp.id IS NOT NULL THEN 'salon'
            WHEN up.id IS NOT NULL THEN 'user'
            ELSE NULL
          END AS post_type,
          up.user_id AS post_user_id,
          ${sql`(SELECT cr.reaction FROM comment_reactions cr WHERE cr.comment_id = pc.id AND cr.user_id = ${requestingUser.id} LIMIT 1)`} AS my_reaction
        FROM post_comments pc
        LEFT JOIN salon_posts sp
          ON sp.id = pc.post_id
        LEFT JOIN user_posts up
          ON up.id = pc.post_id
        WHERE pc.id = ${commentId}
        LIMIT 1
      `;

      if (!rows.length) {
        return {
          success: false,
          error: 'التعليق غير موجود.',
        };
      }

      const comment = rows[0] as any;

      let allowed =
        requestingUser.role === 'admin' ||
        comment.user_id === requestingUser.id;

      if (
        !allowed &&
        comment.post_type === 'user' &&
        comment.post_user_id === requestingUser.id
      ) {
        allowed = true;
      }

      if (
        !allowed &&
        requestingUser.role === 'salon_owner' &&
        comment.post_type === 'salon' &&
        comment.salon_id
      ) {
        allowed = await this.isApprovedSalonOwnerFromNeon(
          requestingUser.id,
          comment.salon_id
        );
      }

      if (!allowed) {
        return {
          success: false,
          error: 'غير مسموح لك بتعديل هذا التعليق.',
        };
      }

      // Modify the existing comment in place (do not create a new one).
      await sql`
        UPDATE post_comments
        SET comment = ${trimmed}, updated_at = NOW()
        WHERE id = ${commentId}
      `;

      const updated: PostComment = {
        id: commentId,
        postId: String(comment.post_id),
        userId: String(comment.user_id),
        userName: requestingUser.name,
        userAvatar: requestingUser.avatar,
        comment: trimmed,
        createdAt: comment.created_at
          ? new Date(comment.created_at).toISOString()
          : new Date().toISOString(),
        likes: Number(comment.likes || 0),
        dislikes: Number(comment.dislikes || 0),
        myReaction: (comment.my_reaction as 'like' | 'dislike' | null) || null,
      };

      return { success: true, comment: updated };
    } catch (error: any) {
      console.error('فشل تعديل التعليق من Neon:', error?.message || error);

      return {
        success: false,
        error: 'تعذر تعديل التعليق.',
      };
    }
  }

  async deletePostComment(
    commentId: string,
    requestingUser: User
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const rows = await sql`
        SELECT
          pc.id,
          pc.post_id,
          pc.user_id,
          sp.salon_id,
          CASE
            WHEN sp.id IS NOT NULL THEN 'salon'
            WHEN up.id IS NOT NULL THEN 'user'
            ELSE NULL
          END AS post_type,
          up.user_id AS post_user_id
        FROM post_comments pc
        LEFT JOIN salon_posts sp
          ON sp.id = pc.post_id
        LEFT JOIN user_posts up
          ON up.id = pc.post_id
        WHERE pc.id = ${commentId}
        LIMIT 1
      `;

      if (!rows.length) {
        return {
          success: false,
          error: 'التعليق غير موجود.',
        };
      }

      const comment = rows[0] as any;

      let allowed =
        requestingUser.role === 'admin' ||
        comment.user_id === requestingUser.id;

      if (
        !allowed &&
        comment.post_type === 'user' &&
        comment.post_user_id === requestingUser.id
      ) {
        allowed = true;
      }

      if (
        !allowed &&
        requestingUser.role === 'salon_owner' &&
        comment.post_type === 'salon' &&
        comment.salon_id
      ) {
        allowed = await this.isApprovedSalonOwnerFromNeon(
          requestingUser.id,
          comment.salon_id
        );
      }

      if (!allowed) {
        return {
          success: false,
          error: 'غير مسموح لك بحذف هذا التعليق.',
        };
      }

      // Single CTE: delete comment, recount, and update post counter atomically.
      if (comment.post_type === 'user') {
        await sql`
          WITH removed AS (
            DELETE FROM post_comments
            WHERE id = ${commentId}
            RETURNING 1
          )
          UPDATE user_posts
          SET comment_count = (
                SELECT COUNT(*)::int
                FROM post_comments
                WHERE post_id = ${comment.post_id}
              ),
              updated_at = NOW()
          WHERE id = ${comment.post_id}
        `;
      } else if (comment.post_type === 'salon') {
        await sql`
          WITH removed AS (
            DELETE FROM post_comments
            WHERE id = ${commentId}
            RETURNING 1
          )
          UPDATE salon_posts
          SET comment_count = (
                SELECT COUNT(*)::int
                FROM post_comments
                WHERE post_id = ${comment.post_id}
              ),
              updated_at = NOW()
          WHERE id = ${comment.post_id}
        `;
      }

      // Fetch updated count for in-memory sync.
      const countRows = await sql`
        SELECT COUNT(*)::int AS count
        FROM post_comments
        WHERE post_id = ${comment.post_id}
      `;

      const commentCount = Number(countRows[0]?.count || 0);

      const localPost = this.state.salonPosts.find(
        (p) => p.id === comment.post_id
      );

      if (localPost) {
        localPost.commentCount = commentCount;
      }

      return { success: true };
    } catch (error: any) {
      console.error(
        'فشل حذف التعليق من Neon:',
        error?.message || error
      );

      return {
        success: false,
        error: 'تعذر حذف التعليق.',
      };
    }
  }

  /**
   * Generate/update salon settlements for one calendar month.
   *
   * Month boundaries are interpreted in Asia/Baghdad, while PostgreSQL
   * stores timestamps as timestamptz/UTC.
   *
   * Only completed bookings with completed_at inside the requested
   * Baghdad calendar month are counted.
   *
   * A paid settlement is never recalculated/overwritten.
   */
  async generateSettlementForMonth(
    year: number,
    month: number
  ): Promise<{
    success: boolean;
    periodStart: string;
    periodEnd: string;
    settlements: Array<{
      id: string;
      salonId: string;
      completedBookingsCount: number;
      commissionAmount: number;
      status: string;
    }>;
    error?: string;
  }> {
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      year < 2020 ||
      year > 2100
    ) {
      return {
        success: false,
        periodStart: '',
        periodEnd: '',
        settlements: [],
        error: 'Invalid settlement year/month.',
      };
    }

    try {
      /*
       * Build the Baghdad calendar boundaries in PostgreSQL.
       *
       * period_start:
       *   YYYY-MM-01 00:00:00 Asia/Baghdad
       *
       * next_period_start:
       *   first day of the following month 00:00:00 Asia/Baghdad
       *
       * period_end:
       *   last instant of the requested month in Asia/Baghdad
       */
      const rows = await sql`
        WITH bounds AS (
          SELECT
            make_date(${year}, ${month}, 1) AS period_start_date,
            (make_date(${year}, ${month}, 1) + INTERVAL '1 month')::date
              AS next_period_start_date
        ),
        aggregates AS (
          SELECT
            b.salon_id,
            COUNT(*)::integer AS completed_bookings_count,
            COALESCE(SUM(b.commission_amount), 0)::integer
              AS commission_amount
          FROM bookings b
          CROSS JOIN bounds x
          WHERE b.status = 'completed'
            AND b.completed_at IS NOT NULL
            AND b.completed_at >= (
              x.period_start_date::timestamp AT TIME ZONE 'Asia/Baghdad'
            )
            AND b.completed_at < (
              x.next_period_start_date::timestamp AT TIME ZONE 'Asia/Baghdad'
            )
          GROUP BY b.salon_id
        )
        INSERT INTO salon_settlements (
          id,
          salon_id,
          period_start,
          period_end,
          completed_bookings_count,
          commission_amount,
          status,
          due_at,
          grace_period_ends_at,
          created_at,
          updated_at
        )
        SELECT
          'settlement_' ||
            a.salon_id || '_' ||
            to_char(x.period_start_date, 'YYYYMMDD') || '_' ||
            to_char((x.next_period_start_date - INTERVAL '1 day')::date, 'YYYYMMDD'),
          a.salon_id,
          x.period_start_date,
          (x.next_period_start_date - INTERVAL '1 day')::date,
          a.completed_bookings_count,
          a.commission_amount,
          'pending',
          (
            x.next_period_start_date::timestamp AT TIME ZONE 'Asia/Baghdad'
          ) - INTERVAL '1 second',
          (
            (
              x.next_period_start_date::timestamp AT TIME ZONE 'Asia/Baghdad'
            ) + INTERVAL '3 days'
          ),
          NOW(),
          NOW()
        FROM aggregates a
        CROSS JOIN bounds x
        WHERE a.commission_amount > 0
        ON CONFLICT (salon_id, period_start, period_end)
        DO UPDATE SET
          completed_bookings_count = EXCLUDED.completed_bookings_count,
          commission_amount = EXCLUDED.commission_amount,
          updated_at = NOW()
        WHERE salon_settlements.status <> 'paid'
        RETURNING
          id,
          salon_id,
          completed_bookings_count,
          commission_amount,
          status,
          period_start,
          period_end
      `;

      const settlements = rows.map((r: any) => ({
        id: r.id,
        salonId: r.salon_id,
        completedBookingsCount: Number(r.completed_bookings_count || 0),
        commissionAmount: Number(r.commission_amount || 0),
        status: r.status,
      }));

      const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;

      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const periodEnd =
        `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      return {
        success: true,
        periodStart,
        periodEnd,
        settlements,
      };
    } catch (error) {
      console.error('generateSettlementForMonth failed:', error);

      return {
        success: false,
        periodStart: '',
        periodEnd: '',
        settlements: [],
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate salon settlements.',
      };
    }
  }

  /**
   * Admin settlement listing.
   * Uses SQL aggregation/joining and pagination so the admin dashboard
   * remains usable with thousands of salons.
   */
  async getAdminSettlementsForMonth(
    year: number,
    month: number,
    options?: {
      search?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<{
    success: boolean;
    items: Array<{
      salonId: string;
      salonName: string;
      city?: string;
      ownerId: string;
      completedBookingsCount: number;
      commissionAmount: number;
      status: string;
      settlementId?: string;
      dueAt?: string;
      gracePeriodEndsAt?: string;
      paidAt?: string;
      paidAmount?: number;
      paidBy?: string;
      notes?: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
    periodStart: string;
    periodEnd: string;
    error?: string;
  }> {
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return {
        success: false,
        items: [],
        total: 0,
        page: 1,
        pageSize: 50,
        periodStart: '',
        periodEnd: '',
        error: 'Invalid settlement year/month.',
      };
    }

    const page = Math.max(
      1,
      Number.isInteger(options?.page) ? Number(options?.page) : 1
    );

    const pageSize = Math.min(
      100,
      Math.max(
        10,
        Number.isInteger(options?.pageSize)
          ? Number(options?.pageSize)
          : 50
      )
    );

    const offset = (page - 1) * pageSize;
    const search = String(options?.search || '').trim();
    const status = String(options?.status || '').trim();

    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const periodEnd =
      `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    try {
      const rows = await sql`
        WITH target_period AS (
          SELECT
            make_date(${year}, ${month}, 1) AS period_start,
            (
              make_date(${year}, ${month}, 1) + INTERVAL '1 month' - INTERVAL '1 day'
            )::date AS period_end
        )
        SELECT
          s.id AS salon_id,
          s.name AS salon_name,
          s.city,
          s.owner_id,
          ss.id AS settlement_id,
          COALESCE(ss.completed_bookings_count, 0)::integer
            AS completed_bookings_count,
          COALESCE(ss.commission_amount, 0)::integer
            AS commission_amount,
          COALESCE(ss.status, 'none') AS status,
          ss.due_at,
          ss.grace_period_ends_at,
          ss.paid_at,
          ss.paid_amount,
          ss.paid_by,
          ss.notes,
          COUNT(*) OVER()::integer AS total_count
        FROM salons s
        CROSS JOIN target_period p
        LEFT JOIN salon_settlements ss
          ON ss.salon_id = s.id
         AND ss.period_start = p.period_start
         AND ss.period_end = p.period_end
        WHERE
          (
            ${search} = ''
            OR s.name ILIKE ${'%' + search + '%'}
            OR COALESCE(s.name_en, '') ILIKE ${'%' + search + '%'}
            OR COALESCE(s.city, '') ILIKE ${'%' + search + '%'}
            OR COALESCE(s.area, '') ILIKE ${'%' + search + '%'}
          )
          AND (
            ${status} = ''
            OR COALESCE(ss.status, 'none') = ${status}
          )
        ORDER BY
          CASE
            WHEN COALESCE(ss.status, 'none') IN ('suspended', 'overdue')
            THEN 0
            WHEN COALESCE(ss.status, 'none') = 'pending'
            THEN 1
            WHEN COALESCE(ss.status, 'none') = 'paid'
            THEN 2
            ELSE 3
          END,
          COALESCE(ss.commission_amount, 0) DESC,
          s.name ASC
        LIMIT ${pageSize}
        OFFSET ${offset}
      `;

      const total = rows.length ? Number(rows[0].total_count || 0) : 0;

      return {
        success: true,
        items: rows.map((r: any) => ({
          salonId: r.salon_id,
          salonName: r.salon_name,
          city: r.city || undefined,
          ownerId: r.owner_id,
          completedBookingsCount: Number(r.completed_bookings_count || 0),
          commissionAmount: Number(r.commission_amount || 0),
          status: r.status,
          settlementId: r.settlement_id || undefined,
          dueAt: r.due_at
            ? new Date(r.due_at).toISOString()
            : undefined,
          gracePeriodEndsAt: r.grace_period_ends_at
            ? new Date(r.grace_period_ends_at).toISOString()
            : undefined,
          paidAt: r.paid_at
            ? new Date(r.paid_at).toISOString()
            : undefined,
          paidAmount:
            r.paid_amount == null ? undefined : Number(r.paid_amount),
          paidBy: r.paid_by || undefined,
          notes: r.notes || undefined,
        })),
        total,
        page,
        pageSize,
        periodStart,
        periodEnd,
      };
    } catch (error) {
      console.error('getAdminSettlementsForMonth failed:', error);

      return {
        success: false,
        items: [],
        total: 0,
        page,
        pageSize,
        periodStart,
        periodEnd,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load salon settlements.',
      };
    }
  }

  /**
   * Record full payment for a salon settlement.
   * Partial payment is intentionally rejected for now.
   */
  async recordSettlementPayment(
    settlementId: string,
    paidAmount: number,
    adminUserId: string,
    notes?: string
  ): Promise<{
    success: boolean;
    settlement?: any;
    error?: string;
  }> {
    if (!settlementId) {
      return { success: false, error: 'معرف التسوية مطلوب.' };
    }

    if (!Number.isInteger(paidAmount) || paidAmount <= 0) {
      return { success: false, error: 'مبلغ الدفع غير صالح.' };
    }

    try {
      const rows = await sql`
        UPDATE salon_settlements
        SET
          status = 'paid',
          paid_at = NOW(),
          paid_amount = ${paidAmount},
          paid_by = ${adminUserId},
          notes = ${notes?.trim() || null},
          updated_at = NOW()
        WHERE id = ${settlementId}
          AND status <> 'paid'
          AND commission_amount = ${paidAmount}
        RETURNING *
      `;

      if (!rows.length) {
        const current = await sql`
          SELECT
            id,
            salon_id,
            commission_amount,
            status
          FROM salon_settlements
          WHERE id = ${settlementId}
          LIMIT 1
        `;

        if (!current.length) {
          return { success: false, error: 'التسوية غير موجودة.' };
        }

        if (current[0].status === 'paid') {
          return { success: false, error: 'هذه التسوية مسددة مسبقاً.' };
        }

        return {
          success: false,
          error: `يجب دفع كامل العمولة: ${Number(
            current[0].commission_amount || 0
          ).toLocaleString()} د.ع.`,
        };
      }

      const settlement: any = rows[0];

      // Lift only a non-payment suspension caused by this settlement.
      const reasonPrefix = 'عدم سداد مستحقات المنصة';
      const salonRows = await sql`
        SELECT
          id,
          owner_id,
          status,
          suspension_reason
        FROM salons
        WHERE id = ${settlement.salon_id}
        LIMIT 1
      `;

      const salon = salonRows[0];

      if (
        salon &&
        salon.status === 'suspended' &&
        String(salon.suspension_reason || '').startsWith(reasonPrefix)
      ) {
        await sql`
          UPDATE salons
          SET
            status = 'approved',
            suspension_reason = NULL,
            suspension_started_at = NULL,
            suspension_ends_at = NULL
          WHERE id = ${settlement.salon_id}
        `;

        const inMemorySalon = this.state.salons.find(
          (item) => item.id === settlement.salon_id
        );

        if (inMemorySalon) {
          inMemorySalon.status = 'approved';
          delete inMemorySalon.suspensionReason;
          delete inMemorySalon.suspensionStartedAt;
          delete inMemorySalon.suspensionEndsAt;
        }
      }

      return {
        success: true,
        settlement,
      };
    } catch (error) {
      console.error('recordSettlementPayment failed:', error);

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'تعذر تسجيل الدفع.',
      };
    }
  }

  /**
   * Mark unpaid settlements as overdue/suspended according to the
   * due date and the 3-day grace period.
   */
  async processSettlementEnforcement(): Promise<{
    success: boolean;
    markedOverdue: number;
    suspended: number;
    error?: string;
  }> {
    let markedOverdue = 0;
    let suspended = 0;

    try {
      const overdueRows = await sql`
        UPDATE salon_settlements
        SET
          status = 'overdue',
          updated_at = NOW()
        WHERE status = 'pending'
          AND commission_amount > 0
          AND due_at <= NOW()
          AND grace_period_ends_at > NOW()
        RETURNING id
      `;

      markedOverdue = overdueRows.length;

      const suspendRows = await sql`
        UPDATE salon_settlements
        SET
          status = 'suspended',
          updated_at = NOW()
        WHERE status IN ('pending', 'overdue')
          AND commission_amount > 0
          AND grace_period_ends_at <= NOW()
        RETURNING id, salon_id, period_start, period_end, commission_amount
      `;

      for (const row of suspendRows as any[]) {
        const reason =
          `عدم سداد مستحقات المنصة للفترة ${row.period_start} إلى ${row.period_end}`;

        await sql`
          UPDATE salons
          SET
            status = 'suspended',
            suspension_reason = ${reason},
            suspension_started_at = COALESCE(suspension_started_at, NOW()),
            suspension_ends_at = NULL
          WHERE id = ${row.salon_id}
            AND status <> 'suspended'
        `;

        const inMemorySalon = this.state.salons.find(
          (item) => item.id === row.salon_id
        );

        if (inMemorySalon && inMemorySalon.status !== 'suspended') {
          inMemorySalon.status = 'suspended';
          inMemorySalon.suspensionReason = reason;
          inMemorySalon.suspensionStartedAt =
            new Date().toISOString();
          delete inMemorySalon.suspensionEndsAt;
        }

        suspended += 1;
      }

      return {
        success: true,
        markedOverdue,
        suspended,
      };
    } catch (error) {
      console.error('processSettlementEnforcement failed:', error);

      return {
        success: false,
        markedOverdue,
        suspended,
        error:
          error instanceof Error
            ? error.message
            : 'تعذر معالجة المستحقات المتأخرة.',
      };
    }
  }

  validateCoupon(code: string, bookingAmount: number): { valid: boolean; coupon?: Coupon; discount?: number; message?: string } {
    const coupon = this.state.coupons.find((c) => c.code.toUpperCase() === code.toUpperCase() && c.isActive);
    if (!coupon) {
      return { valid: false, message: 'كوبون الخصم غير صحيح أو منتهي الصلاحية' };
    }
    if (coupon.usageCount >= coupon.maxUsage) {
      return { valid: false, message: 'وصل هذا الكوبون إلى الحد الأقصى لعدد مرات الاستخدام' };
    }
    if (bookingAmount < coupon.minBookingAmount) {
      return { valid: false, message: `الحد الأدنى للاستفادة من هذا الكوبون هو ${coupon.minBookingAmount.toLocaleString()} د.ع` };
    }

    let discount = Math.round((bookingAmount * coupon.discountPercent) / 100);
    if (coupon.maxDiscount && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }

    return { valid: true, coupon, discount };
  }
}


export async function getNotificationsFromNeon(userId: string): Promise<Notification[]> {
  const rows = await sql`
    SELECT
      n.id,
      n.user_id,
      n.actor_user_id,
      u.name AS actor_name,
      n.title,
      n.title_en,
      n.message,
      n.message_en,
      n.type,
      n.read,
      n.created_at,
      n.link
    FROM notifications n
    LEFT JOIN users u ON u.id = n.actor_user_id
    WHERE n.user_id = ${userId}
      AND n.type != 'message'
    ORDER BY n.created_at DESC
  `;

  return rows.map((n: any) => ({
    id: n.id,
    userId: n.user_id,
    actorUserId: n.actor_user_id || undefined,
    actorName: n.actor_name || undefined,
    title: n.title,
    titleEn: n.title_en,
    message: n.message,
    messageEn: n.message_en,
    type: n.type,
    read: n.read ?? false,
    createdAt: new Date(n.created_at).toISOString(),
    link: n.link || undefined,
  }));
}

export const db = new DatabaseStore();

export async function updateUserSalonOwnerInNeon(
  userId: string,
  salonId: string
): Promise<void> {
  await sql`
    UPDATE users
    SET role = 'salon_owner',
        salon_id = ${salonId}
    WHERE id = ${userId}
  `;
}

export async function loadUsersFromNeon(): Promise<void> {
  try {
    const rows = await sql`
      SELECT id, name, email, phone, role, city, salon_id, avatar,
             password_hash, salt, is_active, is_banned, created_at,
             is_bot, bot_enabled, bio, username
      FROM users
    `;

    if (rows.length > 0) {
      db.getState().users = rows.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        city: u.city,
        salonId: u.salon_id || undefined,
        avatar: u.avatar || undefined,
        passwordHash: u.password_hash || undefined,
        salt: u.salt || undefined,
        isActive: u.is_active ?? true,
        isBanned: u.is_banned ?? false,
        isBot: u.is_bot ?? false,
        botEnabled: u.bot_enabled ?? true,
        bio: u.bio || undefined,
        username: u.username || undefined,
        createdAt: new Date(u.created_at).toISOString(),
      }));

      console.log(`تم تحميل ${rows.length} مستخدمين من Neon`);
    }
  } catch (error: any) {
    console.error('فشل تحميل المستخدمين من Neon:', error.message);
  }
}

export async function loadAllFromNeon(): Promise<void> {
  try {
    const [
      salons,
      barbers,
      services,
      bookings,
      reviews,
      coupons,
      notifications,
      cities,
      blockedTimes,
      favorites,
      salonPosts,
      postComments,
      postLikes,
      auditLogs,
      settings,
    ] = await Promise.all([
      sql`SELECT * FROM salons`,
      sql`SELECT * FROM barbers`,
      sql`SELECT * FROM services`,
      sql`SELECT * FROM bookings`,
      sql`SELECT * FROM reviews`,
      sql`SELECT * FROM coupons`,
      sql`SELECT * FROM notifications`,
      sql`SELECT * FROM cities`,
      sql`SELECT * FROM blocked_times`,
      sql`SELECT * FROM favorites`,
      sql`SELECT * FROM salon_posts`,
      sql`SELECT * FROM post_comments`,
      sql`SELECT * FROM post_likes`,
      sql`SELECT * FROM audit_logs`,
      sql`SELECT * FROM platform_settings ORDER BY id LIMIT 1`,
    ]);

    if (salons.length) {
      db.getState().salons = salons.map((s: any) => ({
        id: s.id,
        name: s.name,
        nameEn: s.name_en,
        slug: s.slug,
        type: s.type,
        city: s.city,
        area: s.area,
        address: s.address,
        lat: Number(s.lat),
        lng: Number(s.lng),
        phone: s.phone,
        whatsapp: s.whatsapp,
        description: s.description,
        descriptionEn: s.description_en,
        rating: Number(s.rating || 0),
        reviewCount: Number(s.review_count || 0),
        startingPrice: Number(s.starting_price || 0),
        coverImage: s.cover_image,
        gallery: s.gallery || [],
        isVerified: s.is_verified ?? false,
        isFeatured: s.is_featured ?? false,
        status: s.status,
        ownerId: s.owner_id,
        workingHours: s.working_hours || defaultWorkingHours,
        features: s.features || [],
        createdAt: new Date(s.created_at).toISOString(),
      }));
    }

    if (barbers.length) {
      db.getState().barbers = barbers.map((b: any) => ({
        id: b.id,
        salonId: b.salon_id,
        name: b.name,
        nameEn: b.name_en,
        avatar: b.avatar,
        title: b.title,
        titleEn: b.title_en,
        experienceYears: Number(b.experience_years || 0),
        rating: Number(b.rating || 0),
        reviewCount: Number(b.review_count || 0),
        specializations: b.specializations || [],
        isAvailable: b.is_available ?? true,
        phone: b.phone || undefined,
      }));
    }

    if (services.length) {
      db.getState().services = services.map((s: any) => ({
        id: s.id,
        salonId: s.salon_id,
        name: s.name,
        nameEn: s.name_en,
        category: s.category,
        categoryEn: s.category_en,
        description: s.description,
        price: Number(s.price || 0),
        durationMinutes: Number(s.duration_minutes || 0),
        image: s.image || undefined,
        barberIds: s.barber_ids || [],
        isPopular: s.is_popular ?? false,
      }));
    }

    if (bookings.length) {
      db.getState().bookings = bookings.map((b: any) => ({
        id: b.id,
        bookingNumber: b.booking_number,
        salonId: b.salon_id,
        salonName: b.salon_name,
        salonAddress: b.salon_address,
        salonPhone: b.salon_phone,
        salonType: b.salon_type,
        serviceId: b.service_id,
        serviceName: b.service_name,
        barberId: b.barber_id,
        barberName: b.barber_name,
        customerId: b.customer_id,
        customerName: b.customer_name,
        customerPhone: b.customer_phone,
        customerEmail: b.customer_email || undefined,
        notes: b.notes || undefined,
        date: b.date instanceof Date
          ? b.date.toISOString().slice(0, 10)
          : String(b.date),
        timeSlot: b.time_slot,
        durationMinutes: Number(b.duration_minutes || 0),
        price: Number(b.price || 0),
        discountAmount: Number(b.discount_amount || 0),
        finalPrice: Number(b.final_price || 0),
        commissionAmount: Number(b.commission_amount || 0),
        salonPayout: Number(b.salon_payout || 0),
        status: b.status,
        paymentMethod: b.payment_method,
        paymentStatus: b.payment_status,
        completionQrNonce: b.completion_qr_nonce || undefined,
        completionQrExpiresAt: b.completion_qr_expires_at
          ? new Date(b.completion_qr_expires_at).toISOString()
          : undefined,
        completedAt: b.completed_at
          ? new Date(b.completed_at).toISOString()
          : undefined,
        completedBy: b.completed_by || undefined,
        createdAt: new Date(b.created_at).toISOString(),
        rated: b.rated ?? false,
        cancellationReason: b.cancellation_reason || undefined,
      }));
    }

    if (reviews.length) {
      db.getState().reviews = reviews.map((r: any) => ({
        id: r.id,
        salonId: r.salon_id,
        salonName: r.salon_name,
        bookingId: r.booking_id,
        customerId: r.customer_id,
        customerName: r.customer_name,
        customerAvatar: r.customer_avatar || undefined,
        rating: Number(r.rating || 0),
        comment: r.comment,
        createdAt: new Date(r.created_at).toISOString(),
        reply: r.reply || undefined,
        replyDate: r.reply_date
          ? new Date(r.reply_date).toISOString()
          : undefined,
      }));
    }

    if (coupons.length) {
      db.getState().coupons = coupons.map((c: any) => ({
        id: c.id,
        code: c.code,
        discountPercent: Number(c.discount_percent || 0),
        discountAmount: c.discount_amount
          ? Number(c.discount_amount)
          : undefined,
        maxDiscount: c.max_discount
          ? Number(c.max_discount)
          : undefined,
        minBookingAmount: Number(c.min_booking_amount || 0),
        validUntil: new Date(c.valid_until).toISOString(),
        usageCount: Number(c.usage_count || 0),
        maxUsage: Number(c.max_usage || 0),
        isActive: c.is_active ?? true,
        salonId: c.salon_id || undefined,
      }));
    }

    if (notifications.length) {
      db.getState().notifications = notifications.map((n: any) => ({
        id: n.id,
        userId: n.user_id,
        title: n.title,
        titleEn: n.title_en,
        message: n.message,
        messageEn: n.message_en,
        type: n.type,
        read: n.read ?? false,
        createdAt: new Date(n.created_at).toISOString(),
        link: n.link || undefined,
      }));
    }

    if (cities.length) {
      db.getState().cities = cities.map((c: any) => ({
        id: c.id,
        nameAr: c.name_ar,
        nameEn: c.name_en,
        lat: Number(c.lat),
        lng: Number(c.lng),
        active: c.active ?? true,
        salonCount: c.salon_count != null
          ? Number(c.salon_count)
          : undefined,
      }));
    }

    if (blockedTimes.length) {
      db.getState().blockedTimes = blockedTimes.map((b: any) => ({
        id: b.id,
        salonId: b.salon_id,
        barberId: b.barber_id || undefined,
        date: b.date instanceof Date
          ? b.date.toISOString().slice(0, 10)
          : String(b.date),
        startTime: b.start_time,
        endTime: b.end_time,
        reason: b.reason || undefined,
      }));
    }

    if (favorites.length) {
      db.getState().favorites = favorites.map((f: any) => ({
        userId: f.user_id,
        salonId: f.salon_id,
      }));
    }

    if (salonPosts.length) {
      db.getState().salonPosts = salonPosts.map((p: any) => ({
        id: p.id,
        salonId: p.salon_id,
        ownerId: p.owner_id,
        salonName: p.salon_name,
        imageUrl: p.image_url,
        caption: p.caption,
        createdAt: new Date(p.created_at).toISOString(),
        updatedAt: p.updated_at
          ? new Date(p.updated_at).toISOString()
          : undefined,
        likeCount: Number(p.like_count || 0),
        commentCount: Number(p.comment_count || 0),
      }));
    }

    if (postComments.length) {
      db.getState().postComments = postComments.map((c: any) => ({
        id: c.id,
        postId: c.post_id,
        userId: c.user_id,
        userName: c.user_name,
        userAvatar: c.user_avatar || undefined,
        comment: c.comment,
        createdAt: new Date(c.created_at).toISOString(),
      }));
    }

    if (postLikes.length) {
      db.getState().postLikes = postLikes.map((l: any) => ({
        id: l.id,
        postId: l.post_id,
        userId: l.user_id,
        createdAt: new Date(l.created_at).toISOString(),
      }));
    }

    if (auditLogs.length) {
      db.getState().auditLogs = auditLogs.map((a: any) => ({
        id: a.id,
        userId: a.user_id,
        userEmail: a.user_email,
        userRole: a.user_role,
        action: a.action,
        targetType: a.target_type,
        targetId: a.target_id || undefined,
        details: a.details,
        ip: a.ip || undefined,
        status: a.status,
        timestamp: new Date(a.timestamp).toISOString(),
      }));
    }

    if (settings.length) {
      const s: any = settings[0];
      db.getState().settings = {
        commissionRate: Number(s.commission_rate || 10),
        currency: s.currency || 'IQD',
        currencySymbol: s.currency_symbol || 'د.ع',
        googleMapsApiKey: s.google_maps_api_key || undefined,
        supportPhone: s.support_phone || '',
        supportEmail: s.support_email || '',
        termsAr: s.terms_ar || '',
        termsEn: s.terms_en || '',
        privacyAr: s.privacy_ar || '',
        privacyEn: s.privacy_en || '',
        cancellationAr: s.cancellation_ar || '',
        cancellationEn: s.cancellation_en || '',
        refundAr: s.refund_ar || '',
        refundEn: s.refund_en || '',
      };
    }

    // Load users into memory so optionalAuthMiddleware can resolve them.
    await loadUsersFromNeon();

    console.log(
      `تم تحميل بيانات Neon: salons=${salons.length}, barbers=${barbers.length}, services=${services.length}, bookings=${bookings.length}`
    );
  } catch (error: any) {
    console.error('فشل تحميل باقي البيانات من Neon:', error.message);
  }
}
