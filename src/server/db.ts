import "dotenv/config";
import { neon } from "@neondatabase/serverless";

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
  PostLike
} from '../types';

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
      ORDER BY created_at ASC
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
             password_hash, salt, is_active, is_banned, created_at
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
      createdAt: new Date(u.created_at).toISOString(),
    };
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
        created_at
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
        ${user.createdAt}
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
        is_banned = EXCLUDED.is_banned
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

  // Authenticate user with password
  authenticate(identifier: string, password?: string): { success: boolean; user?: User; error?: string } {
    const user = this.findUserByEmailOrPhone(identifier);
    if (!user) {
      return { success: false, error: 'المستخدم غير موجود. يرجى التحقق من رقم الهاتف أو البريد.' };
    }

    if (user.isBanned) {
      return { success: false, error: 'تم حظر هذا الحساب من قبل إدارة المنصة. يرجى مراجعة الدعم.' };
    }

    if (!user.isActive) {
      return { success: false, error: 'هذا الحساب غير نشط حالياً.' };
    }

    // Verify password if provided or required
    if (user.passwordHash && user.salt && password) {
      const isValid = verifyPassword(password, user.passwordHash, user.salt);
      if (!isValid) {
        return { success: false, error: 'كلمة المرور غير صحيحة.' };
      }
    }

    return { success: true, user: this.sanitizeUser(user) };
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
    },
    password?: string,
    ip?: string
  ): { success: boolean; user?: User; error?: string } {
    const existing = this.findUserByEmailOrPhone(userData.email || userData.phone);
    if (existing) {
      return { success: false, error: 'يوجد حساب مسجل بالفعل بهذا البريد أو رقم الهاتف.' };
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

    // Persist notification in Neon database
    await sql`
      INSERT INTO notifications
      (id, user_id, title, title_en, message, message_en, type, read, created_at, link, salon_id)
      VALUES
      (${notification.id}, ${notification.userId}, ${notification.title},
       ${notification.titleEn}, ${notification.message}, ${notification.messageEn},
       ${notification.type}, ${notification.read}, ${notification.createdAt},
       ${notification.link ?? null}, ${notification.salonId ?? null})
      ON CONFLICT (id) DO NOTHING
    `.catch((error: any) => {
      console.error('فشل حفظ الإشعار في Neon:', error.message);
    });

    // Keep max 500 notifications in memory
    if (this.state.notifications.length > 500) {
      this.state.notifications.pop();
    }

    return notification;
  }

  // Admin User Management
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

  deleteUser(userId: string, adminUser: User, ip?: string): { success: boolean; error?: string } {
    if (adminUser.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بحذف المستخدمين.' };
    }

    const index = this.state.users.findIndex((u) => u.id === userId);
    if (index === -1) return { success: false, error: 'المستخدم غير موجود.' };

    const targetUser = this.state.users[index];
    if (targetUser.role === 'admin') {
      return { success: false, error: 'لا يمكن حذف حساب مدير المنصة.' };
    }

    this.state.users.splice(index, 1);

    this.addAuditLog({
      userId: adminUser.id,
      userEmail: adminUser.email,
      userRole: 'admin',
      action: 'USER_DELETE',
      targetType: 'user',
      targetId: targetUser.id,
      details: `حذف حساب المستخدم ${targetUser.name} (${targetUser.email}) نهائياً`,
      ip: ip || '127.0.0.1',
      status: 'warning',
    });

    return { success: true };
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

    // 4. Validate Barber belongs to the salon
    const barber = this.state.barbers.find(
      (b) => b.id === bookingData.barberId && b.salonId === bookingData.salonId
    );
    if (!barber) {
      return { success: false, error: 'الحلاق المختار لا ينتمي لهذا الصالون أو غير متاح.' };
    }

    // 5. Check double booking atomically for (barberId, date, timeSlot) where status is NOT cancelled
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
    const newBooking: Booking = {
      ...bookingData,
      id: `bk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      bookingNumber: `HLQ-2026-${randomNum}`,
      salonName: salon.name,
      salonAddress: salon.address,
      salonPhone: salon.phone,
      salonType: salon.type,
      serviceName: service.name,
      barberName: barber.name,
      durationMinutes: service.durationMinutes,
      price: realServicePrice,
      discountAmount,
      finalPrice,
      commissionAmount,
      salonPayout,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    this.state.bookings.unshift(newBooking);

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

  getSalonPosts(salonId?: string): SalonPost[] {
    const posts = salonId
      ? this.state.salonPosts.filter((p) => p.salonId === salonId)
      : this.state.salonPosts;

    return posts.map((post) => ({
      ...post,
      likeCount: this.state.postLikes.filter((l) => l.postId === post.id).length,
      commentCount: this.state.postComments.filter((c) => c.postId === post.id).length,
    }));
  }

  createSalonPost(
    data: {
      salonId: string;
      imageUrl: string;
      caption: string;
    },
    requestingUser: User
  ): { success: boolean; post?: SalonPost; error?: string } {
    if (requestingUser.role !== 'salon_owner' && requestingUser.role !== 'admin') {
      return { success: false, error: 'غير مسموح لك بنشر منشورات.' };
    }

    const salon = this.state.salons.find((s) => s.id === data.salonId);
    if (!salon) {
      return { success: false, error: 'الصالون غير موجود.' };
    }

    if (
      requestingUser.role === 'salon_owner' && salon.status !== 'approved' || requestingUser.role === 'salon_owner' &&
      salon.ownerId !== requestingUser.id
    ) {
      return { success: false, error: 'لا يمكنك النشر في صالون آخر.' };
    }

    if (!data.imageUrl?.trim()) {
      return { success: false, error: 'صورة المنشور مطلوبة.' };
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

    void sql`
      INSERT INTO salon_posts
      (id, salon_id, owner_id, salon_name, image_url, caption, created_at, updated_at, like_count, comment_count)
      VALUES
      (${post.id}, ${post.salonId}, ${post.ownerId}, ${post.salonName},
       ${post.imageUrl}, ${post.caption}, ${post.createdAt}, ${post.createdAt}, 0, 0)
      ON CONFLICT (id) DO NOTHING
    `.catch((error: any) => {
      console.error('فشل حفظ المنشور في Neon:', error.message);
    });

    return { success: true, post };
  }

  deleteSalonPost(
    postId: string,
    requestingUser: User
  ): { success: boolean; error?: string } {
    const post = this.state.salonPosts.find((p) => p.id === postId);

    if (!post) {
      return { success: false, error: 'المنشور غير موجود.' };
    }

    const allowed =
      requestingUser.role === 'admin' ||
      (
        requestingUser.role === 'salon_owner' &&
        this.isApprovedSalonOwner(requestingUser.id, post.salonId)
      );

    if (!allowed) {
      return { success: false, error: 'غير مسموح لك بحذف هذا المنشور.' };
    }

    this.state.salonPosts = this.state.salonPosts.filter(
      (p) => p.id !== postId
    );

    this.state.postLikes = this.state.postLikes.filter(
      (l) => l.postId !== postId
    );

    this.state.postComments = this.state.postComments.filter(
      (c) => c.postId !== postId
    );

    return { success: true };
  }

  togglePostLike(
    postId: string,
    requestingUser: User
  ): { success: boolean; liked?: boolean; likeCount?: number; error?: string } {
    const post = this.state.salonPosts.find((p) => p.id === postId);

    if (!post) {
      return { success: false, error: 'المنشور غير موجود.' };
    }

    const existing = this.state.postLikes.find(
      (l) => l.postId === postId && l.userId === requestingUser.id
    );

    if (existing) {
      this.state.postLikes = this.state.postLikes.filter(
        (l) => l.id !== existing.id
      );

      return {
        success: true,
        liked: false,
        likeCount: this.state.postLikes.filter((l) => l.postId === postId)
          .length,
      };
    }

    const like: PostLike = {
      id: `like_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      postId,
      userId: requestingUser.id,
      createdAt: new Date().toISOString(),
    };

    this.state.postLikes.push(like);

    return {
      success: true,
      liked: true,
      likeCount: this.state.postLikes.filter((l) => l.postId === postId)
        .length,
    };
  }

  getPostLikeStatus(
    postId: string,
    userId: string
  ): { liked: boolean; likeCount: number } {
    return {
      liked: this.state.postLikes.some(
        (l) => l.postId === postId && l.userId === userId
      ),
      likeCount: this.state.postLikes.filter((l) => l.postId === postId)
        .length,
    };
  }

  addPostComment(
    data: {
      postId: string;
      comment: string;
    },
    requestingUser: User
  ): { success: boolean; comment?: PostComment; error?: string } {
    const post = this.state.salonPosts.find((p) => p.id === data.postId);

    if (!post) {
      return { success: false, error: 'المنشور غير موجود.' };
    }

    if (!data.comment?.trim()) {
      return { success: false, error: 'التعليق لا يمكن أن يكون فارغاً.' };
    }

    const comment: PostComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      postId: data.postId,
      userId: requestingUser.id,
      userName: requestingUser.name,
      userAvatar: requestingUser.avatar,
      comment: data.comment.trim(),
      createdAt: new Date().toISOString(),
    };

    this.state.postComments.push(comment);

    return { success: true, comment };
  }

  getPostComments(postId: string): PostComment[] {
    return this.state.postComments
      .filter((c) => c.postId === postId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  deletePostComment(
    commentId: string,
    requestingUser: User
  ): { success: boolean; error?: string } {
    const comment = this.state.postComments.find(
      (c) => c.id === commentId
    );

    if (!comment) {
      return { success: false, error: 'التعليق غير موجود.' };
    }

    const post = this.state.salonPosts.find(
      (p) => p.id === comment.postId
    );

    const allowed =
      requestingUser.role === 'admin' ||
      comment.userId === requestingUser.id ||
      (
        requestingUser.role === 'salon_owner' &&
        !!post?.salonId &&
        this.isApprovedSalonOwner(requestingUser.id, post.salonId)
      );

    if (!allowed) {
      return { success: false, error: 'غير مسموح لك بحذف هذا التعليق.' };
    }

    this.state.postComments = this.state.postComments.filter(
      (c) => c.id !== commentId
    );

    return { success: true };
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
    SELECT id, user_id, title, title_en, message, message_en,
           type, read, created_at, link, salon_id
    FROM notifications
    WHERE user_id = ${userId}
       OR type IN ('offer', 'system')
    ORDER BY created_at DESC
  `;

  return rows.map((n: any) => ({
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
    salonId: n.salon_id || undefined,
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
             password_hash, salt, is_active, is_banned, created_at
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

    console.log(
      `تم تحميل بيانات Neon: salons=${salons.length}, barbers=${barbers.length}, services=${services.length}, bookings=${bookings.length}`
    );
  } catch (error: any) {
    console.error('فشل تحميل باقي البيانات من Neon:', error.message);
  }
}
