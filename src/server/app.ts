import { neon } from "@neondatabase/serverless";
import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { db } from './db.js';
import { getNotificationsFromNeon, loadAllFromNeon, updateUserSalonOwnerInNeon } from './db.js';
import {
  AuthenticatedRequest,
  generateToken,
  optionalAuthMiddleware,
  requireAuth,
  requireRole,
  requireSalonOwnerOrAdmin,
} from './authMiddleware.js';


/* HALAQI_FOLLOW_SQL_CLIENT */
const followSql = neon(process.env.DATABASE_URL!);

const app = express();

// CommonJS/Vercel: __dirname and __filename are provided by Node.js.

app.use(express.json({ limit: '10mb' }));

/* =========================================================
   NEON COLD-START INITIALIZATION
   Vercel instances must load the existing Neon data once per
   instance before serving requests (server.ts does this locally).
   Single-flight guard: concurrent first requests share one load.
========================================================= */
let neonInitPromise: Promise<void> | null = null;

function ensureNeonDataLoaded(): Promise<void> {
  if (!neonInitPromise) {
    neonInitPromise = loadAllFromNeon().catch((error: unknown) => {
      neonInitPromise = null;
      throw error;
    });
  }
  return neonInitPromise;
}

app.use(async (req, res, next) => {
  try {
    await ensureNeonDataLoaded();
    next();
  } catch (error) {
    console.error('❌ Failed to initialize database from Neon:', error);
    res.status(500).json({ success: false, error: 'Database initialization failed' });
  }
});

app.use(optionalAuthMiddleware);


/* =========================================================
   HALAQI_FOLLOW_FIX_V2
   Persistent follow system
========================================================= */

let halaqiFollowTableReady: Promise<void> | null = null;

async function ensureHalaqiFollowTable(): Promise<void> {
  if (!halaqiFollowTableReady) {
    halaqiFollowTableReady = followSql`
      CREATE TABLE IF NOT EXISTS user_follows (
        id TEXT PRIMARY KEY,
        follower_id TEXT NOT NULL,
        following_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT user_follows_unique_pair
          UNIQUE (follower_id, following_id)
      )
    `.then(() => undefined);
  }

  await halaqiFollowTableReady;
}



/* =========================================================
   AUTH
========================================================= */

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { emailOrPhone, password } = req.body || {};

    if (!emailOrPhone) {
      return res.status(400).json({
        success: false,
        error: 'يرجى إدخال رقم الهاتف أو البريد الإلكتروني',
      });
    }

    const result = await db.authenticate(
      String(emailOrPhone),
      String(password || '')
    );

    if (!result.success || !result.user) {
      return res.status(401).json({
        success: false,
        error: result.error || 'بيانات الدخول غير صحيحة.',
      });
    }

    const token = generateToken(result.user);

    return res.json({
      success: true,
      user: result.user,
      token,
    });
  } catch (error) {
    console.error('[LOGIN ERROR]', error);

    return res.status(500).json({
      success: false,
      error: 'تعذر تسجيل الدخول.',
    });
  }
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password, role, city } = req.body || {};

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: 'الاسم ورقم الهاتف مطلوبان',
      });
    }

    if (role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'غير مصرح بإنشاء حساب مدير.',
      });
    }

    const result = db.createUser(
      {
        name,
        email,
        phone,
        role: role === 'salon_owner' ? 'salon_owner' : 'customer',
        city,
      },
      password
    );

    if (!result.success || !result.user) {
      return res.status(400).json({
        success: false,
        error: result.error || 'تعذر إنشاء الحساب.',
      });
    }

    const token = generateToken(result.user);

    return res.status(201).json({
      success: true,
      user: result.user,
      token,
    });
  } catch (error) {
    console.error('[REGISTER ERROR]', error);

    return res.status(500).json({
      success: false,
      error: 'تعذر إنشاء الحساب.',
    });
  }
});

app.get(
  '/api/auth/me',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    return res.json({
      success: true,
      user: req.user,
    });
  }
);

/* =========================================================
   UPDATE CURRENT USER PROFILE
========================================================= */
app.put(
  '/api/auth/me/profile',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log('[PROFILE ROUTE DEBUG] REQUEST RECEIVED');
      console.log('[PROFILE ROUTE DEBUG] user =', {
        id: req.user?.id,
        name: req.user?.name,
        hasAuth: !!req.headers.authorization,
      });
      console.log('[PROFILE ROUTE DEBUG] body =', {
        name: req.body?.name,
        phone: req.body?.phone,
        city: req.body?.city,
      });

      const userId = req.user!.id;
      const { name, phone, city } = req.body || {};

      if (!String(name || '').trim()) {
        return res.status(400).json({
          success: false,
          error: 'الاسم مطلوب.',
        });
      }

      const result = await db.updateUserProfile(userId, {
        name: String(name).trim(),
        phone: phone ? String(phone).trim() : undefined,
        city: city ? String(city).trim() : undefined,
      });

      if (!result.success || !result.user) {
        return res.status(400).json({
          success: false,
          error: result.error || 'تعذر تحديث الملف الشخصي.',
        });
      }

      /*
       * مهم:
       * تحديث req.user حتى يرجع الاسم الجديد مباشرة.
       * البحث /api/search يعتمد على بيانات المستخدمين المحدثة.
       */
      (req as any).user = result.user;

      return res.json({
        success: true,
        user: result.user,
      });
    } catch (error) {
      console.error('[PROFILE UPDATE ERROR]', error);

      return res.status(500).json({
        success: false,
        error: 'تعذر تحديث الملف الشخصي.',
      });
    }
  }
);

/* =========================================================
   SALONS
========================================================= */

app.get('/api/salons', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const wantsPending = req.query.includePending === 'true';

    let salons;
    if (isAdmin && wantsPending) {
      salons =
        typeof (db as any).getAllSalonsFromNeon === 'function'
          ? await (db as any).getAllSalonsFromNeon()
          : db.getState().salons;
    } else {
      salons =
        typeof (db as any).getApprovedSalonsFromNeon === 'function'
          ? await (db as any).getApprovedSalonsFromNeon()
          : db.getState().salons.filter((s: any) => s.status === 'approved');
    }

    return res.json({
      success: true,
      salons: Array.isArray(salons) ? salons : [],
    });
  } catch (error) {
    console.error('[SALONS ERROR]', error);

    return res.status(500).json({
      success: false,
      salons: [],
      error: 'تعذر جلب الصالونات.',
    });
  }
});

app.get('/api/salons/mine', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const salon = await db.getSalonByOwnerFromNeon(req.user!.id);

    return res.json({
      success: true,
      salon: salon || null,
    });
  } catch (error: any) {
    console.error('[MY SALON CHECK] Neon check failed:', error?.message || error);

    return res.status(503).json({
      success: false,
      error: 'تعذر التحقق من طلب الصالون الحالي. حاول مرة أخرى.',
    });
  }
});

app.get('/api/salons/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const salon =
      typeof (db as any).getSalonByIdFromNeon === 'function'
        ? await (db as any).getSalonByIdFromNeon(req.params.id)
        : db.getSalonById(req.params.id);

    if (!salon) {
      return res.status(404).json({
        success: false,
        error: 'الصالون غير موجود.',
      });
    }

    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin && salon.status !== 'approved') {
      return res.status(404).json({
        success: false,
        error: 'الصالون غير موجود.',
      });
    }

    try {
      const services = await db.getServicesBySalonFromNeon(salon.id);
      const barbers = await db.getBarbersBySalonFromNeon(salon.id);
      const reviews = db.getState().reviews.filter(
        (r) => r.salonId === salon.id
      );

      return res.json({
        success: true,
        salon,
        services,
        barbers,
        reviews,
      });
    } catch (error: any) {
      console.error(
        '[SALON DETAIL] Failed to load services from Neon:',
        error?.message || error
      );

      return res.status(503).json({
        success: false,
        error: 'تعذر تحميل خدمات الصالون حالياً.',
      });
    }
  } catch (error) {
    console.error('[SALON ERROR]', error);

    return res.status(500).json({
      success: false,
      error: 'تعذر جلب الصالون.',
    });
  }
});

app.post('/api/salons', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const data = req.body;
  const ip = req.ip || '127.0.0.1';

  // ============================================================
  // DUPLICATE SALON REQUEST PROTECTION
  // ============================================================
  // Check memory first.
  const existingSalonMemory = db.getState().salons.find(
    (s) =>
      s.ownerId === req.user!.id &&
      (s.status === 'pending' || s.status === 'approved')
  );

  if (existingSalonMemory) {
    return res.status(409).json({
      success: false,
      duplicate: true,
      salon: existingSalonMemory,
      error:
        existingSalonMemory.status === 'approved'
          ? 'لديك صالون معتمد بالفعل ولا يمكنك تقديم طلب صالون جديد.'
          : 'لديك طلب صالون قيد المراجعة بالفعل. لا يمكنك إرسال طلب آخر.',
    });
  }

  // Permanently banned salon owners cannot submit another salon.
  try {
    const bannedSalon = await db.getBannedSalonByOwnerFromNeon(req.user!.id);

    if (bannedSalon) {
      return res.status(403).json({
        success: false,
        banned: true,
        salon: bannedSalon,
        error: 'تم حظر صالونك نهائيًا ولا يمكنك تقديم طلب صالون جديد.',
      });
    }
  } catch (error: any) {
    console.error(
      '[SALON BAN CHECK] Neon check failed:',
      error?.message || error
    );

    return res.status(503).json({
      success: false,
      error: 'تعذر التحقق من حالة حساب الصالون. حاول مرة أخرى.',
    });
  }

  // Check Neon too, so refresh/restart cannot bypass the protection.
  try {
    const existingSalonNeon =
      await db.getSalonByOwnerFromNeon(req.user!.id);

    if (existingSalonNeon) {
      // Keep memory synchronized if the salon exists in Neon.
      const existsInMemory = db
        .getState()
        .salons.some((s) => s.id === existingSalonNeon.id);

      if (!existsInMemory) {
        db.getState().salons.push(existingSalonNeon);
      }

      return res.status(409).json({
        success: false,
        duplicate: true,
        salon: existingSalonNeon,
        error:
          existingSalonNeon.status === 'approved'
            ? 'لديك صالون معتمد بالفعل ولا يمكنك تقديم طلب صالون جديد.'
            : 'لديك طلب صالون قيد المراجعة بالفعل. لا يمكنك إرسال طلب آخر.',
      });
    }
  } catch (error: any) {
    console.error(
      '[SALON DUPLICATE CHECK] Neon check failed:',
      error?.message || error
    );

    return res.status(503).json({
      success: false,
      error: 'تعذر التحقق من طلب الصالون الحالي. حاول مرة أخرى.',
    });
  }

  const newSalon = {
    ...data,
    id: `salon_${Date.now()}`,
    ownerId: req.user!.id,
    slug: data.nameEn ? data.nameEn.toLowerCase().replace(/\s+/g, '-') : `salon-${Date.now()}`,
    rating: 5.0,
    reviewCount: 0,
    status: 'pending',
    isVerified: false,
    createdAt: new Date().toISOString(),
  };

    // Final atomic check: query Neon one more time right before INSERT
    // to close any race window between the earlier check and this write.
    try {
      const lastCheck = await db.getSalonByOwnerFromNeon(req.user!.id);

      if (lastCheck) {
        return res.status(409).json({
          success: false,
          duplicate: true,
          salon: lastCheck,
          error:
            lastCheck.status === 'approved'
              ? 'لديك صالون معتمد بالفعل ولا يمكنك تقديم طلب صالون جديد.'
              : 'لديك طلب صالون قيد المراجعة بالفعل. لا يمكنك إرسال طلب آخر.',
        });
      }
    } catch (error: any) {
      console.error(
        '[SALON FINAL CHECK] Neon check failed:',
        error?.message || error
      );
      return res.status(503).json({
        success: false,
        error: 'تعذر التحقق من طلب الصالون الحالي. حاول مرة أخرى.',
      });
    }

    // Persist the new salon in Neon FIRST, before adding to memory.
    try {
      const savedSalon = await db.createSalonInNeon(newSalon);

      if (!savedSalon) {
        return res.status(500).json({
          success: false,
          error: 'تعذر حفظ طلب الصالون في قاعدة البيانات.',
        });
      }

      // Only now add to in-memory state (after Neon confirms success)
      db.getState().salons.push(savedSalon);

      Object.assign(newSalon, savedSalon);

      console.log(
        `[SALON CREATE] Neon synchronized: ${savedSalon.id}`
      );
    } catch (error: any) {
      console.error(
        '[SALON CREATE] Neon INSERT failed:',
        error?.message || error
      );

      return res.status(500).json({
        success: false,
        error: 'تعذر حفظ طلب الصالون في قاعدة البيانات.',
      });
    }

  // Notify all active admins about the new salon
  const admins = db.getState().users.filter(
    (u) => u.role === 'admin' && u.isActive && !u.isBanned
  );

  for (const admin of admins) {
    try {
      await db.createNotification({
        userId: admin.id,
        title: 'صالون جديد بانتظار الموافقة',
        titleEn: 'New Salon Awaiting Approval',
        message: `تم تسجيل صالون جديد باسم ${newSalon.name} ويحتاج إلى موافقة المدير قبل نشره في الموقع.`,
        messageEn: `A new salon "${newSalon.name}" was registered and is awaiting admin approval.`,
        type: 'new_salon',
        link: `/admin/salons/${newSalon.id}`,
        salonId: newSalon.id,
      });

      console.log(
        `[NOTIFICATION] New salon notification sent to admin ${admin.id} for salon ${newSalon.id}`
      );
    } catch (error) {
      console.error(
        `[NOTIFICATION] Failed for admin ${admin.id}:`,
        error
      );
    }
  }

  // If creator is salon_owner, link salonId to user
  if (req.user!.role === 'salon_owner') {
    const userInDb = db.getUserById(req.user!.id);
    if (userInDb) {
      userInDb.salonId = newSalon.id;
    }
  }

  db.addAuditLog({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'SALON_CREATE',
    targetType: 'salon',
    targetId: newSalon.id,
    details: `إنشاء صالون جديد: ${newSalon.name} (${newSalon.city})`,
    ip,
    status: 'success',
  });

  res.status(201).json({ success: true, salon: newSalon });
});

/* =========================================================
   SERVICES ENDPOINTS
========================================================= */

app.get('/api/services', async (req: Request, res: Response) => {
  const { salonId } = req.query;

  if (salonId) {
    try {
      const neonServices = await db.getServicesBySalonFromNeon(salonId as string);

      return res.json({
        success: true,
        services: neonServices,
      });
    } catch (error: any) {
      console.error('[SERVICES API] Neon lookup failed:', error?.message || error);

      return res.status(500).json({
        success: false,
        services: [],
        error: 'تعذر تحميل خدمات الصالون حالياً.',
      });
    }
  }

  res.json({
    success: true,
    services: db.getState().services,
  });
});

app.post('/api/services', requireAuth, requireSalonOwnerOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
  console.log('[SERVICE_ROUTE] ENTER', {
    userId: req.user?.id,
    role: req.user?.role,
    body: req.body,
  });

  const newService = {
    ...req.body,
    id: `srv_${Date.now()}`,
  };

  console.log('[SERVICE_ROUTE] BEFORE_NEON', newService);

  let savedService;
  try {
    savedService = await db.createServiceInNeon(newService);
    console.log('[SERVICE_ROUTE] AFTER_NEON', savedService);
  } catch (error) {
    console.error('[SERVICE_ROUTE] NEON_THROW', error);
    return res.status(500).json({
      success: false,
      error: 'فشل حفظ الخدمة في قاعدة البيانات',
    });
  }

  if (!savedService) {
    return res.status(500).json({
      success: false,
      error: 'فشل حفظ الخدمة في قاعدة البيانات',
    });
  }

  db.getState().services.push(savedService);

  db.addAuditLog({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'SERVICE_CREATE',
    targetType: 'service',
    targetId: newService.id,
    details: `إضافة خدمة جديدة ${newService.name} بسعر ${newService.price} د.ع للصالون ${newService.salonId}`,
    ip: req.ip || '127.0.0.1',
    status: 'success',
  });

  res.status(201).json({ success: true, service: savedService });
});

app.put('/api/services/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const idx = db.getState().services.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'الخدمة غير موجودة' });

  const targetService = db.getState().services[idx];
  if (req.user!.role !== 'admin' && !db.isApprovedSalonOwner(req.user!.id, targetService.salonId)) {
    return res.status(403).json({ success: false, error: 'غير مصرح لك بتعديل خدمات هذا الصالون.' });
  }

  db.getState().services[idx] = { ...targetService, ...req.body };
  res.json({ success: true, service: db.getState().services[idx] });
});

app.delete('/api/services/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const idx = db.getState().services.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'الخدمة غير موجودة' });

  const targetService = db.getState().services[idx];
  if (req.user!.role !== 'admin' && !db.isApprovedSalonOwner(req.user!.id, targetService.salonId)) {
    return res.status(403).json({ success: false, error: 'غير مصرح لك بحذف خدمات هذا الصالون.' });
  }

  db.getState().services.splice(idx, 1);
  res.json({ success: true });
});

/* =========================================================
   SALON POSTS
========================================================= */

app.get('/api/salon-posts', async (req: Request, res: Response) => {
  try {
    const salonId =
      typeof req.query.salonId === 'string'
        ? req.query.salonId
        : undefined;

    const posts = await db.getSalonPosts(salonId);

    return res.json({
      success: true,
      posts: Array.isArray(posts) ? posts : [],
    });
  } catch (error) {
    console.error('[SALON POSTS ERROR]', error);

    return res.status(500).json({
      success: false,
      posts: [],
      error: 'تعذر جلب منشورات الصالونات.',
    });
  }
});

app.get('/api/salons/:id/posts', async (req: Request, res: Response) => {
  try {
    const posts = await db.getSalonPosts(req.params.id);

    return res.json({
      success: true,
      posts: Array.isArray(posts) ? posts : [],
    });
  } catch (error) {
    console.error('[SALON POSTS BY SALON ERROR]', error);

    return res.status(500).json({
      success: false,
      posts: [],
      error: 'تعذر جلب منشورات الصالون.',
    });
  }
});

/* =========================================================
   UNIFIED POSTS FEED
========================================================= */
app.get(
  '/api/posts/feed',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // optionalAuthMiddleware يعرّف المشاهد الحالي إن وُجد
      // حتى تُحمَل حالة الإعجاب الخاصة به من Neon مع الـFeed.
      const posts = await db.getUnifiedPostsFeed(req.user?.id);

      return res.json({
        success: true,
        posts: Array.isArray(posts) ? posts : [],
      });
    } catch (error) {
      console.error('[UNIFIED POSTS FEED ERROR]', error);

      return res.status(500).json({
        success: false,
        posts: [],
        error: 'تعذر جلب المنشورات.',
      });
    }
  }
);

/*
 * جلب منشور واحد مباشرة (مستخدم أو صالون) حسب postType.
 * يُستخدم عند فتح منشور قادم من إشعار بدون تحميل Feed كامل.
 */
app.get('/api/posts/:postId', async (req: Request, res: Response) => {
  try {
    const post = await db.getUnifiedPostById(req.params.postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'المنشور غير موجود.',
      });
    }

    return res.json({
      success: true,
      post,
    });
  } catch (error) {
    console.error('[UNIFIED POST ERROR]', error);

    return res.status(500).json({
      success: false,
      error: 'تعذر جلب المنشور.',
    });
  }
});

/* =========================================================
   USER POSTS
========================================================= */

app.get('/api/user-posts/feed', async (_req: Request, res: Response) => {
  try {
    const posts = await db.getAllUserPosts();

    return res.json({
      success: true,
      posts: Array.isArray(posts) ? posts : [],
    });
  } catch (error) {
    console.error('[USER POSTS FEED ERROR]', error);

    return res.status(500).json({
      success: false,
      posts: [],
      error: 'تعذر جلب منشورات المستخدمين.',
    });
  }
});

app.get('/api/user-posts/:postId', async (req: Request, res: Response) => {
  try {
    const post = await db.getUserPostById(req.params.postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'المنشور غير موجود.',
      });
    }

    return res.json({
      success: true,
      post,
    });
  } catch (error) {
    console.error('[USER POST ERROR]', error);

    return res.status(500).json({
      success: false,
      error: 'تعذر جلب المنشور.',
    });
  }
});

/* =========================================================
   IMAGE UPLOAD (Supabase Storage)
   Re-added after the Neon migration removed it. Keeps images in
   external Supabase Storage (bucket: avatars) instead of storing
   base64 blobs in Neon. Auth via requireAuth.
   ========================================================= */
let supabaseStorageClient: ReturnType<typeof createClient> | null = null;

function getSupabaseStorageClient() {
  if (!supabaseStorageClient) {
    supabaseStorageClient = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SECRET_KEY || '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );
  }
  return supabaseStorageClient;
}

app.post(
  '/api/uploads/image',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dataUrl } = req.body || {};

      if (!dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'الصورة مطلوبة.',
        });
      }

      const match = dataUrl.match(
        /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/
      );

      if (!match) {
        return res.status(400).json({
          success: false,
          error: 'صيغة الصورة غير مدعومة.',
        });
      }

      const extension =
        match[1] === 'jpeg' || match[1] === 'jpg' ? 'jpg' : match[1];
      const contentType =
        extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;

      const fileName = `${req.user!.id}_${Date.now()}.${extension}`;
      const fileBuffer = Buffer.from(match[2], 'base64');

      // Verify configuration without logging secrets.
      if (
        !/^https:\/\/.+\.supabase\.co$/.test(process.env.SUPABASE_URL || '')
      ) {
        console.error('[Image Upload] SUPABASE_URL missing or invalid.');
        return res.status(500).json({
          success: false,
          error: 'تعذر رفع الصورة.',
        });
      }

      const supabaseAdmin = getSupabaseStorageClient();
      const avatarBucket = 'avatars';

      const { error: uploadError } = await supabaseAdmin.storage
        .from(avatarBucket)
        .upload(fileName, fileBuffer, {
          contentType,
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('[Image Upload] Supabase upload failed:', uploadError);
        return res.status(500).json({
          success: false,
          error: 'تعذر رفع الصورة.',
        });
      }

      const { data: publicData } = supabaseAdmin.storage
        .from(avatarBucket)
        .getPublicUrl(fileName);

      return res.status(201).json({
        success: true,
        imageUrl: publicData.publicUrl,
      });
    } catch (error) {
      console.error('[Image Upload Error]:', error);
      return res.status(500).json({
        success: false,
        error: 'تعذر رفع الصورة.',
      });
    }
  }
);

/* =========================================================
   AI CAPTION SUGGESTION (server-side, key never sent to client)
   Used by the Post Composer "✨ Suggest a caption" feature.
   Fails gracefully so it never blocks normal posting.
   ========================================================= */
app.post(
  '/api/ai/suggest-caption',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(200).json({
          success: false,
          error: 'خدمة اقتراح التعليق غير متاحة.',
        });
      }

      const { context } = req.body || {};

      const ai = new GoogleGenAI({ apiKey });

      const prompt =
        'Write a short, friendly social-media caption for a beauty/salon photo post. ' +
        'Match the user language (Arabic or English). Keep it under 140 characters. ' +
        'You may include 1-2 relevant hashtags. Return only the caption text, no quotes.\n' +
        (context ? `User context / draft: ${context}\n` : '');

      const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });

      const caption = (result as any)?.text?.trim() || '';

      if (!caption) {
        return res.status(200).json({
          success: false,
          error: 'تعذر إنشاء اقتراح.',
        });
      }

      return res.status(200).json({ success: true, caption });
    } catch (error) {
      console.error('[SUGGEST CAPTION ERROR]', error);
      return res.status(200).json({
        success: false,
        error: 'تعذر اقتراح تعليق.',
      });
    }
  }
);

app.post(
  '/api/user-posts',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { imageUrl, caption } = req.body || {};

      if (!imageUrl || typeof imageUrl !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'الصورة مطلوبة لإنشاء المنشور.',
        });
      }

      const result = await db.createUserPost(
        {
          imageUrl,
          caption: typeof caption === 'string' ? caption : '',
        },
        req.user!
      );

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || 'تعذر حفظ المنشور.',
        });
      }

      return res.status(201).json({
        success: true,
        post: result.post,
      });
    } catch (error) {
      console.error('[CREATE USER POST ERROR]', error);

      return res.status(500).json({
        success: false,
        error: 'تعذر تحديث حالة الإشعار.',
      });
    }
  }
);


/* =========================================================
   BOOKINGS ENDPOINTS (restored)
   ========================================================= */

app.get('/api/bookings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { customerId, salonId, status } = req.query;
  const user = req.user!;

  try {
    // Always read authoritative booking data from Neon.
    let bookings = await db.getAllBookingsFromNeon();

    // RBAC Data Isolation
    if (user.role === 'customer') {
      bookings = bookings.filter((b) => b.customerId === user.id);
    } else if (user.role === 'salon_owner') {
      // Authoritative ownership lookup from Neon.
      // Do not rely on user.salonId in a serverless instance.
      bookings = await db.getBookingsForSalonOwnerFromNeon(user.id);
    } else if (user.role === 'staff') {
      const ownedSalonId = user.salonId;

      bookings = bookings.filter(
        (b) =>
          (ownedSalonId && b.salonId === ownedSalonId) ||
          db.isSalonOwner(user.id, b.salonId)
      );
    } else if (user.role === 'admin') {
      if (customerId) {
        bookings = bookings.filter(
          (b) => b.customerId === customerId
        );
      }

      if (salonId) {
        bookings = bookings.filter(
          (b) => b.salonId === salonId
        );
      }
    }

    if (status) {
      bookings = bookings.filter(
        (b) => b.status === status
      );
    }

    return res.json({
      success: true,
      bookings,
    });
  } catch (error: any) {
    console.error(
      '[GET BOOKINGS NEON] Failed:',
      error?.message || error
    );

    return res.status(503).json({
      success: false,
      error: 'تعذر تحميل الحجوزات حالياً. حاول مرة أخرى.',
      bookings: [],
    });
  }
});

app.get('/api/bookings/occupied-slots', (req: Request, res: Response) => {
  const { barberId, date } = req.query;
  if (!barberId || !date) {
    return res.status(400).json({ success: false, error: 'barberId and date are required' });
  }
  const slots = db.getOccupiedSlots(barberId as string, date as string);
  res.json({ success: true, occupiedSlots: slots });
});

app.post('/api/bookings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const bookingPayload = req.body;
  const ip = req.ip || '127.0.0.1';

  // Strictly enforce customer details from authenticated user token
  const customer = req.user!;
  const securePayload = {
    ...bookingPayload,
    customerId: customer.id,
    customerName: bookingPayload.customerName || customer.name,
    customerPhone: bookingPayload.customerPhone || customer.phone,
    customerEmail: customer.email,
  };

  if (
    !securePayload.salonId ||
    !securePayload.serviceId ||
    !securePayload.date ||
    !securePayload.timeSlot
  ) {
    return res.status(400).json({ success: false, error: 'يرجى إكمال جميع بيانات الحجز المطلوبة' });
  }

  // ============================================================
  // BOOKING SALON SYNC
  // Vercel serverless memory may not contain salons loaded in Neon.
  // Sync the selected salon before validating the booking.
  // ============================================================
  const salonInMemory = db.getState().salons.find(
    (salon) => salon.id === securePayload.salonId
  );

  if (!salonInMemory) {
    try {
      const salonFromNeon = await db.getSalonByIdFromNeon(
        securePayload.salonId
      );

      if (!salonFromNeon) {
        return res.status(404).json({
          success: false,
          error: 'الصالون المحدد غير موجود.',
        });
      }

      db.getState().salons.push(salonFromNeon);

      console.log(
        `[BOOKING SALON SYNC] Salon ${salonFromNeon.id} loaded from Neon`
      );
    } catch (error: any) {
      console.error(
        '[BOOKING SALON SYNC] Failed to load salon from Neon:',
        error?.message || error
      );

      return res.status(503).json({
        success: false,
        error: 'تعذر التحقق من الصالون حالياً. حاول مرة أخرى.',
      });
    }
  }

  // ============================================================
  // BOOKING SERVICE NEON SYNC FINAL
  // ============================================================
  const serviceInMemory = db.getState().services.find(
    (service) =>
      service.id === securePayload.serviceId &&
      service.salonId === securePayload.salonId
  );

  if (!serviceInMemory) {
    try {
      const serviceFromNeon = await db.getServiceByIdFromNeon(
        securePayload.serviceId
      );

      if (!serviceFromNeon) {
        return res.status(404).json({
          success: false,
          error: 'الخدمة المطلوبة غير موجودة.',
        });
      }

      if (serviceFromNeon.salonId !== securePayload.salonId) {
        return res.status(400).json({
          success: false,
          error: 'الخدمة المطلوبة لا تنتمي إلى هذا الصالون.',
        });
      }

      db.getState().services.push(serviceFromNeon);

      console.log(
        `[BOOKING SERVICE SYNC] Service ${serviceFromNeon.id} loaded from Neon`
      );
    } catch (error: any) {
      console.error(
        '[BOOKING SERVICE SYNC] Failed:',
        error?.message || error
      );

      return res.status(503).json({
        success: false,
        error: 'تعذر التحقق من الخدمة حالياً. حاول مرة أخرى.',
      });
    }
  }

  // ============================================================
  // BARBER IS OPTIONAL
  // The customer books the salon/service/time directly.
  // No barber is auto-assigned here.
  // ============================================================

  const bookingWithoutBarber = {
    ...securePayload,
    barberId: undefined,
    barberName: undefined,
  };

  console.log(
    `[BOOKING] Creating salon booking without barber: salon=${securePayload.salonId} service=${securePayload.serviceId} date=${securePayload.date} time=${securePayload.timeSlot}`
  );

  const result = await db.createBookingAtomic(
    bookingWithoutBarber,
    req.body.couponCode,
    ip
  );

  if (!result.success || !result.booking) {
    return res.status(409).json({
      success: false,
      error: result.error || 'تعذر إتمام الحجز.'
    });
  }

  // Notify both the salon owner and platform admins after a successful booking.
  // IMPORTANT: notifications must never block the booking response.
  void (async () => {
  // Recipients are resolved server-side from authoritative user/salon data.
  try {
    const salon = db.getState().salons.find(
      (s) => s.id === result.booking!.salonId
    );

    const recipients = new Map<string, any>();

    // 1. Salon owner
    if (salon?.ownerId) {
      let owner =
        db.getUserById(salon.ownerId) ||
        await db.getUserByIdFromNeon(salon.ownerId);

      if (owner) {
        recipients.set(owner.id, owner);
      } else {
        console.error(
          `[BOOKING NOTIFICATION] Salon owner ${salon.ownerId} was not found`
        );
      }
    } else {
      console.error(
        `[BOOKING NOTIFICATION] Salon ${result.booking!.salonId} has no ownerId`
      );
    }

    // 2. Platform admins
    const admins = db.getAdminUsers();

    for (const admin of admins) {
      recipients.set(admin.id, admin);
    }

    // If admin is not currently in memory, try the authoritative Neon user.
    if (!admins.length) {
      const stateUsers = db.getState().users || [];

      for (const user of stateUsers) {
        if (user.role === 'admin') {
          const admin =
            db.getUserById(user.id) ||
            await db.getUserByIdFromNeon(user.id);

          if (admin) {
            recipients.set(admin.id, admin);
          }
        }
      }
    }

    const notificationPayload = {
      title: 'حجز جديد 🎉',
      titleEn: 'New Booking 🎉',
      message: `لديك حجز جديد من ${result.booking!.customerName} يوم ${result.booking!.date} الساعة ${result.booking!.timeSlot}. الخدمة: ${result.booking!.serviceName}، المبلغ: ${result.booking!.finalPrice.toLocaleString()} د.ع.`,
      messageEn: `You have a new booking from ${result.booking!.customerName} on ${result.booking!.date} at ${result.booking!.timeSlot}. Service: ${result.booking!.serviceName}. Amount: ${result.booking!.finalPrice.toLocaleString()} IQD.`,
      type: 'booking_created' as const,
      link: '/bookings',
      salonId: result.booking!.salonId,
    };

    for (const recipient of recipients.values()) {
      await db.createNotification({
        userId: recipient.id,
        ...notificationPayload,
      });

      console.log(
        `[BOOKING NOTIFICATION] Booking ${result.booking!.id} notified user ${recipient.id} (${recipient.role})`
      );
    }
  } catch (error: any) {
    // Never fail an already-created booking because notification delivery failed.
    console.error(
      '[BOOKING NOTIFICATION] Failed to create notification:',
      error?.message || error
    );
  }
  })();

    // Return successful booking immediately.
    // Notification delivery is intentionally fire-and-forget.
    return res.status(201).json({
      success: true,
      booking: result.booking,
    });
  });

app.post('/api/bookings/:id/complete-by-qr', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { qrNonce } = req.body || {};

    if (!qrNonce || typeof qrNonce !== 'string') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_QR',
        error: 'رمز QR غير صالح.',
      });
    }

    const result = await db.completeBookingByQr(
      req.params.id,
      qrNonce,
      user,
      req.ip || '127.0.0.1'
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    return res.json({
      success: true,
      booking: result.booking,
    });
  } catch (error: any) {
    console.error('[BOOKING_QR] Failed to complete booking:', error?.message || error);

    return res.status(500).json({
      success: false,
      error: 'حدث خطأ أثناء إكمال الحجز عبر QR.',
    });
  }
});

app.put('/api/bookings/:id/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  const user = req.user!;

  const allowedStatuses = ['confirmed', 'pending', 'completed', 'cancelled'];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'حالة الحجز غير صالحة.',
    });
  }

  const booking = db.getState().bookings.find(
    (b) => b.id === req.params.id
  );

  if (!booking) {
    return res.status(404).json({
      success: false,
      error: 'الحجز غير موجود.',
    });
  }

  // Only the salon owner of this booking or Admin can update status.
  if (
    user.role !== 'admin' &&
    !db.isSalonOwner(user.id, booking.salonId)
  ) {
    return res.status(403).json({
      success: false,
      error: 'غير مصرح لك بتغيير حالة هذا الحجز.',
    });
  }

  booking.status = status as typeof booking.status;

  db.addAuditLog({
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    action: 'BOOKING_STATUS_CHANGE',
    targetType: 'booking',
    targetId: booking.id,
    details: `تغيير حالة الحجز ${booking.bookingNumber} إلى ${status}`,
    ip: req.ip || '127.0.0.1',
    status: 'success',
  });

  return res.json({
    success: true,
    booking,
  });
});

app.post('/api/bookings/:id/cancel', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body;
  const ip = req.ip || '127.0.0.1';
  const result = db.cancelBooking(req.params.id, req.user!, reason, ip);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  res.json({ success: true });
});


/* =========================================================
   MESSAGING / DIRECT CHAT
   Persistent private messages backed by Neon (messages table).
   ========================================================= */

let messagesTableReady: Promise<void> | null = null;

/* Spam / abuse protection for direct messaging.
   - Global per-IP limit on how many messages can be sent in a window.
   - Per (sender -> recipient) cooldown to stop rapid-fire / duplicate spam. */
const messageRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 60, // up to 60 messages per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'تم تجاوز حد إرسال الرسائل. يرجى المحاولة لاحقاً.',
  },
});

const messageRecipientCooldown = new Map<string, number>();
const MESSAGE_RECIPIENT_MIN_INTERVAL_MS = 1500;

async function ensureMessagesTable(): Promise<void> {
  if (!messagesTableReady) {
    messagesTableReady = (async () => {
      await followSql`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          sender_id TEXT NOT NULL,
          recipient_id TEXT NOT NULL,
          body TEXT NOT NULL,
          read BOOLEAN NOT NULL DEFAULT FALSE,
          status TEXT NOT NULL DEFAULT 'sent',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      // Backfill any older table that was created before the status column.
      try {
        await followSql`
          ALTER TABLE messages ADD COLUMN status TEXT NOT NULL DEFAULT 'sent'
        `;
      } catch {
        /* column already exists — ignore */
      }

      // Discover anonymous chats reuse the messages table but are tagged
      // with a conversation_id so they never surface in normal Messages.
      try {
        await followSql`
          ALTER TABLE messages ADD COLUMN conversation_id TEXT
        `;
      } catch {
        /* column already exists — ignore */
      }

      await followSql`CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id)`;
      await followSql`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`;
      await followSql`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`;
      await followSql`CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, recipient_id, created_at)`;
      await followSql`CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)`;
    })().catch((error: unknown) => {
      messagesTableReady = null;
      throw error;
    });
  }

  await messagesTableReady;
}

/* GET /api/messages/conversations
   Returns the current user's conversations with the latest message
   and unread count per conversation. RBAC: only conversations where
   the current user is a participant are returned. */
app.get('/api/messages/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await ensureMessagesTable();

    const me = req.user!.id;

    const rows = await followSql`
      WITH conv AS (
        SELECT
          CASE WHEN sender_id = ${me} THEN recipient_id ELSE sender_id END AS other_id,
          id,
          sender_id,
          recipient_id,
          body,
          read,
          created_at
        FROM messages
        WHERE (sender_id = ${me} OR recipient_id = ${me}) AND conversation_id IS NULL
      )
      SELECT DISTINCT ON (other_id)
        other_id,
        body,
        read,
        created_at,
        sender_id
      FROM conv
      ORDER BY other_id, created_at DESC
    `;

    const unreadRows = await followSql`
      SELECT sender_id AS other_id, COUNT(*)::int AS unread_count
      FROM messages
      WHERE recipient_id = ${me} AND read = FALSE AND conversation_id IS NULL
      GROUP BY sender_id
    `;

    const unreadMap = new Map<string, number>(
      unreadRows.map((r: any) => [String(r.other_id), Number(r.unread_count || 0)])
    );

    const otherIds: string[] = rows.map((r: any) => String(r.other_id));
    const profileMap = new Map<string, any>();

    if (otherIds.length) {
      const profiles = await followSql`
        SELECT id, name, avatar FROM users WHERE id = ANY(${otherIds})
      `;

      for (const p of profiles) {
        profileMap.set(String(p.id), p);
      }
    }

    const conversations: any[] = rows.map((r: any) => {
      const profile = profileMap.get(String(r.other_id)) || {};

      return {
        otherUser: {
          id: String(r.other_id),
          name: profile.name || 'مستخدم',
          avatar: profile.avatar || profile.avatar_url || undefined,
        },
        lastMessage: {
          body: r.body,
          createdAt: new Date(r.created_at).toISOString(),
          senderId: r.sender_id,
        },
        unreadCount: unreadMap.get(String(r.other_id)) || 0,
      };
    });

    // A recipient fetching their inbox means the (pending) incoming
    // messages have physically arrived on their device, so promote
    // 'sent' -> 'delivered'. 'read' is only set when they open the
    // thread, so unread counts remain accurate.
    try {
      await followSql`
        UPDATE messages
        SET status = 'delivered'
        WHERE recipient_id = ${me} AND status = 'sent' AND conversation_id IS NULL
      `;
    } catch (updErr: any) {
      console.error('[MESSAGES DELIVER]', updErr?.message || updErr);
    }

    return res.json({
      success: true,
      conversations,
    });
  } catch (error: any) {
    console.error('[MESSAGES CONVERSATIONS]', error?.message || error);

    return res.status(500).json({
      success: false,
      error: 'تعذر تحميل المحادثات.',
    });
  }
});

/* GET /api/messages/:userId
   Returns the message history between the current user and :userId.
   Authorization: only messages where (me <-> userId) are returned,
   so a user can never read another participant's conversation. */
app.get('/api/messages/:userId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await ensureMessagesTable();

    const me = req.user!.id;
    const other = String(req.params.userId || '').trim();

    if (!other || other === me) {
      return res.status(400).json({
        success: false,
        error: 'محادثة غير صالحة.',
      });
    }

    const beforeRaw = req.query.before;
    const before = typeof beforeRaw === 'string' ? new Date(beforeRaw) : null;
    const hasBefore = before && !isNaN(before.getTime());

    const rows = hasBefore
      ? await followSql`
          SELECT * FROM messages
          WHERE ((sender_id = ${me} AND recipient_id = ${other})
              OR (sender_id = ${other} AND recipient_id = ${me}))
            AND conversation_id IS NULL
            AND created_at < ${before!.toISOString()}
          ORDER BY created_at DESC
          LIMIT 50
        `
      : await followSql`
          SELECT * FROM messages
          WHERE ((sender_id = ${me} AND recipient_id = ${other})
             OR (sender_id = ${other} AND recipient_id = ${me}))
          AND conversation_id IS NULL
          ORDER BY created_at DESC
          LIMIT 50
        `;

    const messages: any[] = rows
      .map((m: any) => ({
        id: m.id,
        senderId: m.sender_id,
        recipientId: m.recipient_id,
        body: m.body,
        read: m.read,
        status: m.status || 'sent',
        createdAt: new Date(m.created_at).toISOString(),
      }))
      .reverse();

    // If the current user is the recipient, fetching this thread means
    // the pending incoming messages have arrived on their device.
    try {
      await followSql`
        UPDATE messages
        SET status = 'delivered'
        WHERE recipient_id = ${me} AND sender_id = ${other} AND status = 'sent' AND conversation_id IS NULL
      `;
    } catch (updErr: any) {
      console.error('[MESSAGES DELIVER THREAD]', updErr?.message || updErr);
    }

    return res.json({
      success: true,
      messages,
      hasMore: rows.length === 50,
    });
  } catch (error: any) {
    console.error('[MESSAGES HISTORY]', error?.message || error);

    return res.status(500).json({
      success: false,
      error: 'تعذر تحميل الرسائل.',
    });
  }
});

/* POST /api/messages
   Sends a private message. The sender identity is ALWAYS derived from
   the authenticated user (req.user.id); the recipient is validated and
   must exist and not be banned. Self-messaging is rejected. */
app.post('/api/messages', requireAuth, messageRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await ensureMessagesTable();

    const me = req.user!.id;
    const { recipientId, body } = req.body || {};

    const text = typeof body === 'string' ? body.trim() : '';

    if (!recipientId || typeof recipientId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'معرف المستلم مطلوب.',
      });
    }

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'نص الرسالة مطلوب.',
      });
    }

    // Message length validation (spam / abuse protection).
    const MAX_MESSAGE_LENGTH = 2000;
    if (text.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        error: 'الرسالة طويلة جداً (الحد الأقصى 2000 حرف).',
      });
    }

    if (recipientId === me) {
      return res.status(400).json({
        success: false,
        error: 'لا يمكنك إرسال رسالة إلى نفسك.',
      });
    }

    // Per-recipient cooldown to prevent rapid-fire / duplicate spam.
    const cooldownKey = `${me}->${recipientId}`;
    const lastSent = messageRecipientCooldown.get(cooldownKey) || 0;
    if (Date.now() - lastSent < MESSAGE_RECIPIENT_MIN_INTERVAL_MS) {
      return res.status(429).json({
        success: false,
        error: 'الرجاء الانتظار قليلاً قبل إرسال رسالة أخرى لنفس المستخدم.',
      });
    }

    const recipient =
      db.getUserById(recipientId) || (await db.getUserByIdFromNeon(recipientId));

    if (!recipient) {
      return res.status(404).json({
        success: false,
        error: 'المستخدم غير موجود.',
      });
    }

    if (recipient.isBanned) {
      return res.status(403).json({
        success: false,
        error: 'لا يمكن إرسال رسالة إلى هذا المستخدم.',
      });
    }

    const sender = db.getUserById(me) || (await db.getUserByIdFromNeon(me));

    if (sender?.isBanned) {
      return res.status(403).json({
        success: false,
        error: 'تم حظر حسابك من إرسال الرسائل.',
      });
    }

    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const createdAt = new Date().toISOString();

    messageRecipientCooldown.set(cooldownKey, Date.now());

    await followSql`
      INSERT INTO messages (id, sender_id, recipient_id, body, read, status, created_at)
      VALUES (${id}, ${me}, ${recipientId}, ${text}, FALSE, 'sent', ${createdAt})
    `;

    const message = {
      id,
      senderId: me,
      recipientId,
      body: text,
      read: false,
      status: 'sent',
      createdAt,
    };

    // Private messages are surfaced via the Messages badge (conversation
    // unread count) only — NOT as duplicate entries in the Notifications
    // section. Intentionally no `type: 'message'` notification is created
    // here (Messenger-style behaviour).

    return res.status(201).json({
      success: true,
      message,
    });
  } catch (error: any) {
    console.error('[SEND MESSAGE]', error?.message || error);

    return res.status(500).json({
      success: false,
      error: 'تعذر إرسال الرسالة.',
    });
  }
});

/* POST /api/messages/:userId/read
   Marks all messages FROM :userId TO the current user as read.
   Authorization: only rows where recipient_id = me are updated, so a
   user can never mark another user's incoming messages as read. */
app.post('/api/messages/:userId/read', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await ensureMessagesTable();

    const me = req.user!.id;
    const other = String(req.params.userId || '').trim();

    if (!other || other === me) {
      return res.status(400).json({
        success: false,
        error: 'طلب غير صالح.',
      });
    }

    await followSql`
      UPDATE messages
      SET read = TRUE, status = 'read'
      WHERE recipient_id = ${me}
        AND sender_id = ${other}
        AND read = FALSE
        AND conversation_id IS NULL
    `;

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[MESSAGES READ]', error?.message || error);

    return res.status(500).json({
      success: false,
      error: 'تعذر تحديث حالة القراءة.',
    });
  }
});

/* =========================================================
   STATIC FRONTEND
========================================================= */

app.get('/api/users/:id/public', async (req: Request, res: Response) => {
  try {
    const userId = String(req.params.id || '').trim();

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'معرّف المستخدم مطلوب.',
      });
    }

    const user = typeof (db as any).getUserByIdFromNeon === 'function'
      ? await (db as any).getUserByIdFromNeon(userId)
      : typeof (db as any).getUserById === 'function'
        ? await (db as any).getUserById(userId)
        : null;

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'المستخدم غير موجود.',
      });
    }

    const publicUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      avatarUrl: user.avatarUrl,
      role: user.role,
      city: user.city,
      bio: user.bio,
      salonId: user.salonId,
      createdAt: user.createdAt,
    };

    return res.json({
      success: true,
      user: publicUser,
    });
  } catch (error) {
    console.error('[PUBLIC PROFILE ERROR]', error);

    return res.status(500).json({
      success: false,
      error: 'تعذر تحميل الملف الشخصي.',
    });
  }
});


/* =========================================================
   HALAQI_FOLLOW_FIX_V2
   USER FOLLOW ROUTES
========================================================= */

app.get(
  '/api/users/:id/follow-status',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureHalaqiFollowTable();

      const targetUserId = String(req.params.id || '').trim();
      const currentUserId = req.user!.id;

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          error: 'معرف المستخدم مطلوب.',
        });
      }

      const rows = await followSql`
        SELECT
          EXISTS (
            SELECT 1
            FROM user_follows
            WHERE follower_id = ${currentUserId}
              AND following_id = ${targetUserId}
          ) AS is_following,

          COUNT(*) FILTER (
            WHERE following_id = ${targetUserId}
          ) AS followers_count,

          COUNT(*) FILTER (
            WHERE follower_id = ${targetUserId}
          ) AS following_count

        FROM user_follows
      `;

      const row = rows[0] || {};

      return res.json({
        success: true,
        isFollowing: Boolean(row.is_following),
        followersCount: Number(row.followers_count || 0),
        followingCount: Number(row.following_count || 0),
      });

    } catch (error) {
      console.error('[FOLLOW STATUS ERROR]', error);

      return res.status(500).json({
        success: false,
        error: 'تعذر تحميل معلومات المتابعة.',
      });
    }
  }
);

app.post(
  '/api/users/:id/follow-toggle',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureHalaqiFollowTable();

      const targetUserId = String(req.params.id || '').trim();
      const currentUserId = req.user!.id;

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          error: 'معرف المستخدم مطلوب.',
        });
      }

      if (currentUserId === targetUserId) {
        return res.status(400).json({
          success: false,
          error: 'لا يمكنك متابعة نفسك.',
        });
      }

      /* Single CTE: validate target, toggle follow, compute counts. */
      const toggleRows = await followSql`
        WITH target_check AS (
          SELECT id, name, is_active, is_banned
          FROM users
          WHERE id = ${targetUserId}
          LIMIT 1
        ),
        existing_follow AS (
          SELECT 1
          FROM user_follows
          WHERE follower_id = ${currentUserId}
            AND following_id = ${targetUserId}
          LIMIT 1
        ),
        unfollowed AS (
          DELETE FROM user_follows
          WHERE EXISTS (SELECT 1 FROM existing_follow)
            AND follower_id = ${currentUserId}
            AND following_id = ${targetUserId}
          RETURNING 1
        ),
        new_follow AS (
          INSERT INTO user_follows (id, follower_id, following_id)
          SELECT
            'follow_' || ${Date.now()} || '_' || substr(md5(random()::text), 1, 8),
            ${currentUserId},
            ${targetUserId}
          WHERE NOT EXISTS (SELECT 1 FROM existing_follow)
            AND EXISTS (SELECT 1 FROM target_check tc WHERE tc.is_active IS NOT FALSE AND tc.is_banned IS NOT TRUE)
          ON CONFLICT (follower_id, following_id) DO NOTHING
          RETURNING 1
        ),
        did_follow AS (
          SELECT EXISTS(SELECT 1 FROM new_follow) AS val
        ),
        counts AS (
          SELECT
            COUNT(*) FILTER (WHERE following_id = ${targetUserId})
              + CASE WHEN (SELECT val FROM did_follow) THEN 1 ELSE 0 END
              - CASE WHEN EXISTS(SELECT 1 FROM unfollowed) THEN 1 ELSE 0 END
              AS followers_count,
            COUNT(*) FILTER (WHERE follower_id = ${targetUserId}) AS following_count
          FROM user_follows
        )
        SELECT
          tc.id AS target_valid,
          tc.name AS target_name,
          COALESCE(
            (SELECT val FROM did_follow),
            FALSE
          ) AS is_following,
          c.followers_count,
          c.following_count
        FROM target_check tc
        LEFT JOIN counts c ON true
      `;

      const row = toggleRows[0] as any;

      if (!row?.target_valid) {
        return res.status(404).json({
          success: false,
          error: 'هذا الحساب غير متاح.',
        });
      }

      const isFollowing = Boolean(row.is_following);

      /* Fire-and-forget notification on follow. */
      if (isFollowing) {
        db.createNotification({
          userId: targetUserId,
          actorUserId: currentUserId,
          title: 'متابع جديد',
          titleEn: 'New Follower',
          message: `${row.target_name || 'مستخدم'} بدأ بمتابعتك.`,
          messageEn: `${row.target_name || 'A user'} started following you.`,
          type: 'system',
          link: `/profile/${currentUserId}`,
        }).catch(() => {});
      }

      return res.json({
        success: true,
        isFollowing,
        followersCount: Number(
          row.followers_count || 0
        ),
        followingCount: Number(
          row.following_count || 0
        ),
      });

    } catch (error) {

      console.error('[FOLLOW TOGGLE ERROR]', error);
      console.error('[FOLLOW TOGGLE ERROR DETAILS]', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });

      return res.status(500).json({
        success: false,
        error: error instanceof Error
          ? `تعذر تحديث المتابعة: ${error.message}`
          : 'تعذر تحديث المتابعة.',
      });
    }
  }
);


app.get('/api/users/:id/posts', async (req: Request, res: Response) => {
  try {
    const posts = await db.getUserPosts(req.params.id);

    return res.json({
      success: true,
      posts: Array.isArray(posts) ? posts : [],
    });
  } catch (error) {
    console.error('[USER POSTS ERROR]', error);

    return res.status(500).json({
      success: false,
      posts: [],
      error: 'تعذر جلب منشورات المستخدم.',
    });
  }
});

/* =========================================================
   USER POST LIKES
========================================================= */

app.post(
  '/api/user-posts/:id/like',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await db.togglePostLike(
        req.params.id,
        req.user!,
        'user'
      );

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error || 'المنشور غير موجود.',
        });
      }

      return res.json({
        success: true,
        liked: result.liked,
        likeCount: result.likeCount,
      });
    } catch (error) {
      console.error('[USER POST LIKE ERROR]', error);

      return res.status(500).json({
        success: false,
        error: 'تعذر تنفيذ الإعجاب.',
      });
    }
  }
);

app.get(
  '/api/user-posts/:id/like',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await db.getPostLikeStatus(
        req.params.id,
        req.user!.id,
        'user'
      );

      return res.json({
        success: true,
        liked: result.liked,
        likeCount: result.likeCount,
      });
    } catch (error) {
      console.error('[USER POST LIKE STATUS ERROR]', error);

      return res.status(500).json({
        success: false,
        liked: false,
        likeCount: 0,
      });
    }
  }
);

/* =========================================================
   SALON POST LIKES
========================================================= */

app.post(
  '/api/salon-posts/:id/like',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await db.togglePostLike(
        req.params.id,
        req.user!,
        'salon'
      );

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error || 'المنشور غير موجود.',
        });
      }

      return res.json({
        success: true,
        liked: result.liked,
        likeCount: result.likeCount,
      });
    } catch (error) {
      console.error('[SALON POST LIKE ERROR]', error);

      return res.status(500).json({
        success: false,
        error: 'تعذر تنفيذ الإعجاب.',
      });
    }
  }
);

app.get(
  '/api/salon-posts/:id/like',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await db.getPostLikeStatus(
        req.params.id,
        req.user!.id,
        'salon'
      );

      return res.json({
        success: true,
        liked: result.liked,
        likeCount: result.likeCount,
      });
    } catch (error) {
      console.error('[SALON POST LIKE STATUS ERROR]', error);

      return res.status(500).json({
        success: false,
        liked: false,
        likeCount: 0,
      });
    }
  }
);

/* =========================================================
   COMMENTS
========================================================= */

/* =========================================================
   USER POST COMMENTS
========================================================= */

app.get('/api/user-posts/:id/comments', async (req: Request, res: Response) => {
  try {
    const comments = await db.getPostComments(req.params.id);

    return res.json({
      success: true,
      comments: Array.isArray(comments) ? comments : [],
    });
  } catch (error) {
    console.error('[USER POST COMMENTS ERROR]', error);

    return res.status(500).json({
      success: false,
      comments: [],
    });
  }
});

app.post(
  '/api/user-posts/:id/comments',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { comment } = req.body || {};

      if (!comment?.trim()) {
        return res.status(400).json({
          success: false,
          error: 'التعليق لا يمكن أن يكون فارغاً.',
        });
      }

      const result = await db.addPostComment(
        {
          postId: req.params.id,
          comment,
        },
        req.user!
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      return res.json({
        success: true,
        comment: result.comment,
      });
    } catch (error) {
      console.error('[USER POST COMMENT ERROR]', error);

      return res.status(500).json({
        success: false,
        error: 'تعذر إضافة التعليق.',
      });
    }
  }
);

app.get('/api/salon-posts/:id/comments', async (req: Request, res: Response) => {
  try {
    const comments = await db.getPostComments(req.params.id);

    return res.json({
      success: true,
      comments: Array.isArray(comments) ? comments : [],
    });
  } catch (error) {
    console.error('[COMMENTS ERROR]', error);

    return res.status(500).json({
      success: false,
      comments: [],
    });
  }
});

app.post(
  '/api/salon-posts/:id/comments',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { comment } = req.body || {};

      if (!comment?.trim()) {
        return res.status(400).json({
          success: false,
          error: 'التعليق لا يمكن أن يكون فارغاً.',
        });
      }

      const result = await db.addPostComment(
        {
          postId: req.params.id,
          comment,
        },
        req.user!
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      return res.status(201).json({
        success: true,
        comment: result.comment,
      });
    } catch (error) {
      console.error('[ADD COMMENT ERROR]', error);

      return res.status(500).json({
        success: false,
        error: 'تعذر إضافة التعليق.',
      });
    }
  }
);

/* =========================================================
   CONFIG / CITIES
========================================================= */

app.get('/api/cities', async (_req: Request, res: Response) => {
  try {
    const rows = await followSql`SELECT * FROM cities ORDER BY name ASC`;
    const cities = rows.map((c: any) => ({
      id: c.id,
      nameAr: c.name_ar ?? c.nameAr ?? c.name ?? '',
      nameEn: c.name_en ?? c.nameEn ?? '',
      lat: Number(c.lat),
      lng: Number(c.lng),
      active: c.active ?? true,
      salonCount: Number(c.salon_count ?? c.salonCount ?? 0),
    }));

    return res.json({ success: true, cities });
  } catch (error) {
    console.error('[CITIES ERROR]', error);
    return res.status(500).json({
      success: false,
      cities: [],
      error: 'تعذر جلب المدن.',
    });
  }
});

/* =========================================================
   AUTH: TOKEN REFRESH
   Re-issue a fresh 365-day token so the session stays alive
   as long as the user is active.
========================================================= */

app.post('/api/auth/refresh', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'غير مصرح.' });
    }

    const newToken = generateToken(req.user);

    return res.json({
      success: true,
      token: newToken,
      user: req.user,
    });
  } catch (error) {
    console.error('[TOKEN REFRESH ERROR]', error);
    return res.status(500).json({ success: false, error: 'تعذر تجديد الجلسة.' });
  }
});

/* =========================================================
   ADMIN: SALON STATUS UPDATE
   Handles approve / reject / suspend / banned / toggle-verified
   and commission rate updates.
========================================================= */

app.put(
  '/api/admin/salons/:id/status',
  requireAuth,
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const salonId = req.params.id;
      const {
        status,
        isVerified,
        commissionRate,
        suspensionReason,
        suspensionHours,
      } = req.body || {};

      // Validate status if provided
      const validStatuses = ['approved', 'rejected', 'pending', 'suspended', 'banned'];
      if (status !== undefined && !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'حالة الصالون غير صحيحة.',
        });
      }

      // Update status in Neon
      if (status !== undefined) {
        const updatedSalon = await db.updateSalonStatusInNeon(
          salonId,
          status,
          isVerified
        );

        if (!updatedSalon) {
          return res.status(404).json({
            success: false,
            error: 'الصالون غير موجود.',
          });
        }

        // Also update in-memory state
        const memSalon = db.getState().salons.find((s) => s.id === salonId);
        if (memSalon) {
          memSalon.status = status as any;
          if (isVerified !== undefined) memSalon.isVerified = isVerified;
          if (suspensionReason) memSalon.suspensionReason = suspensionReason;
          if (suspensionHours && status === 'suspended') {
            memSalon.suspensionStartedAt = new Date().toISOString();
            memSalon.suspensionEndsAt = new Date(
              Date.now() + suspensionHours * 60 * 60 * 1000
            ).toISOString();
          }
        }

        // Notify salon owner about approval
        if (status === 'approved') {
          db.createNotification({
            userId: updatedSalon.ownerId,
            title: 'تم اعتماد صالونك!',
            titleEn: 'Your Salon Has Been Approved!',
            message: `تهانينا! تم اعتماد صالون "${updatedSalon.name}" وهو الآن ظاهر للزبائن.`,
            messageEn: `Congratulations! Your salon "${updatedSalon.name}" has been approved and is now visible to customers.`,
            type: 'salon_approved',
            link: '/salon_dashboard',
            salonId: salonId,
          }).catch(() => {});

          // Upgrade owner role to salon_owner and link salon in Neon
          if (updatedSalon.ownerId) {
            const owner = db.getUserById(updatedSalon.ownerId);
            if (owner) {
              owner.role = 'salon_owner';
              owner.salonId = salonId;
              try {
                await updateUserSalonOwnerInNeon(owner.id, salonId);
              } catch (err: any) {
                console.error('[SALON APPROVE] Failed to upgrade owner role:', err?.message || err);
              }
            }
          }
        }

        // Notify salon owner about rejection
        if (status === 'rejected') {
          db.createNotification({
            userId: updatedSalon.ownerId,
            title: 'تم رفض طلب الصالون',
            titleEn: 'Salon Application Rejected',
            message: `نعتذر، تم رفض طلب تسجيل صالون "${updatedSalon.name}". يمكنك التواصل مع الدعم لمزيد من التفاصيل.`,
            messageEn: `Unfortunately, your salon registration for "${updatedSalon.name}" was rejected. Please contact support for more details.`,
            type: 'salon_rejected',
            salonId: salonId,
          }).catch(() => {});
        }

        // Audit log
        db.addAuditLog({
          userId: req.user!.id,
          userEmail: req.user!.email,
          userRole: 'admin',
          action: `SALON_${status.toUpperCase()}`,
          targetType: 'salon',
          targetId: salonId,
          details: `تغيير حالة الصالون "${updatedSalon.name}" إلى ${status}`,
          ip: req.ip || '127.0.0.1',
          status: 'success',
        });

        return res.json({
          success: true,
          salon: updatedSalon,
        });
      }

      // Update isVerified without changing status
      if (isVerified !== undefined) {
        const memSalon = db.getState().salons.find((s) => s.id === salonId);
        if (memSalon) {
          memSalon.isVerified = isVerified;
        }

        // Also persist to Neon
        await followSql`
          UPDATE salons
          SET is_verified = ${isVerified}
          WHERE id = ${salonId}
        `;

        db.addAuditLog({
          userId: req.user!.id,
          userEmail: req.user!.email,
          userRole: 'admin',
          action: isVerified ? 'SALON_VERIFY' : 'SALON_UNVERIFY',
          targetType: 'salon',
          targetId: salonId,
          details: `${isVerified ? 'توثيق' : 'إلغاء توثيق'} الصالون ${salonId}`,
          ip: req.ip || '127.0.0.1',
          status: 'success',
        });

        return res.json({ success: true });
      }

      // Update commission rate
      if (commissionRate !== undefined) {
        const memSalon = db.getState().salons.find((s) => s.id === salonId);
        if (memSalon) {
          memSalon.commissionRate = commissionRate;
        }

        await followSql`
          UPDATE salons
          SET commission_rate = ${commissionRate}
          WHERE id = ${salonId}
        `;

        return res.json({ success: true });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN SALON STATUS ERROR]', error);
      return res.status(500).json({
        success: false,
        error: 'تعذر تحديث حالة الصالون.',
      });
    }
  }
);

/* =========================================================
   ADMIN SANCTION
========================================================= */

app.put(
  '/api/admin/salons/:id/lift-sanction',
  requireAuth,
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const salon = db.getSalonById(req.params.id);

      if (!salon) {
        return res.status(404).json({
          success: false,
          error: 'الصالون غير موجود.',
        });
      }

      salon.status = 'approved';
      delete salon.suspensionReason;
      delete salon.suspensionStartedAt;
      delete salon.suspensionEndsAt;

      return res.json({
        success: true,
        salon,
      });
    } catch (error) {
      console.error('[LIFT SANCTION ERROR]', error);

      return res.status(500).json({
        success: false,
        error: 'تعذر رفع العقوبة.',
      });
    }
  }
);

/* =========================================================
   SEARCH
========================================================= */

app.get('/api/search', async (req: Request, res: Response) => {
  // مهم جداً: نتائج البحث يجب أن تكون لحظية بعد تغيير الاسم
  // ولا يجوز تخزينها في Cache المتصفح أو Vercel/CDN.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  try {
    const q = String(req.query.q || '').trim();

    if (!q) {
      return res.json({
        success: true,
        salons: [],
        users: [],
      });
    }

    const search = `%${q}%`;

    /*
     * البحث عن المستخدمين مباشرة من Neon
     * حتى يظهر الاسم الجديد مباشرة بعد تعديله
     * ولا نعتمد على db.getState().users القديم.
     */
    console.log('[SEARCH DEBUG] q =', q);
      console.log('[SEARCH DEBUG] DATABASE_URL host =', (() => {
        try {
          return new URL(process.env.DATABASE_URL || '').host;
        } catch {
          return 'INVALID_DATABASE_URL';
        }
      })());

      const userRows = await followSql`
      SELECT
        id,
        name,
        email,
        phone,
        role,
        city,
        avatar,
        is_active,
        is_banned
      FROM users
      WHERE
        COALESCE(is_active, true) = true
        AND COALESCE(is_banned, false) = false
        AND (
          name ILIKE ${search}
          OR email ILIKE ${search}
          OR phone ILIKE ${search}
        )
      ORDER BY name ASC
      LIMIT 50
    `;

    const users = userRows.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      city: u.city || 'baghdad',
      avatar: u.avatar || undefined,
    }));

    const salonRows = await followSql`
      SELECT *
      FROM salons
      WHERE COALESCE(status, 'approved') = 'approved'
        AND (
          name ILIKE ${search}
          OR COALESCE(name_en, '') ILIKE ${search}
          OR COALESCE(area, '') ILIKE ${search}
          OR COALESCE(address, '') ILIKE ${search}
        )
      ORDER BY name ASC
      LIMIT 50
    `;

    const salons = salonRows.map((s: any) => ({
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
    }));

    return res.json({
      success: true,
      salons,
      users,
    });
  } catch (error) {
    console.error('[SEARCH ERROR]', error);

    return res.status(500).json({
      success: false,
      salons: [],
      users: [],
    });
  }
});

/* =========================================================
   NOTIFICATIONS
========================================================= */

app.get(
  '/api/notifications',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const notifications = await getNotificationsFromNeon(userId);

      return res.json({
        success: true,
        notifications,
      });
    } catch (error: any) {
      console.error(
        '[NOTIFICATIONS GET ERROR]',
        error?.message || error
      );

      return res.status(500).json({
        success: false,
        notifications: [],
        error: 'تعذر تحميل الإشعارات.',
      });
    }
  }
);


/* =========================================================
   NOTIFICATION READ
   ========================================================= */
app.put(
  '/api/notifications/:id/read',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const notificationId = req.params.id;
      const userId = req.user!.id;

      const result = await followSql`
        UPDATE notifications
        SET read = true
        WHERE id = ${notificationId}
          AND user_id = ${userId}
      `;

      const notification = db.getState().notifications.find(
        (n) => n.id === notificationId && n.userId === userId
      );

      if (notification) {
        notification.read = true;
      }

      return res.json({
        success: true,
        updated: Array.isArray(result) ? result.length : 0,
      });
    } catch (error: any) {
      console.error(
        '[NOTIFICATION READ] Failed to persist read state:',
        error?.message || error
      );

      return res.status(500).json({
        success: false,
        error: 'تعذر تحديث حالة الإشعار.',
      });
    }
  }
);

/* =========================================================
   STATIC FRONTEND
========================================================= */

/* =========================================================
   DISCOVER — meet someone new via shared interests
   Self-contained: adds users.interests column + the
   connection_requests, user_blocks and user_reports tables.
   No existing tables/schemas are modified beyond the new
   users.interests column.
======================================================== */

let discoverTablesReady: Promise<void> | null = null;

async function ensureDiscoverTables(): Promise<void> {
  if (!discoverTablesReady) {
    discoverTablesReady = (async () => {
      await followSql`
        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS interests TEXT[] NOT NULL DEFAULT '{}'
      `;
      await followSql`
        CREATE TABLE IF NOT EXISTS connection_requests (
          id TEXT PRIMARY KEY,
          sender_id TEXT NOT NULL,
          receiver_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await followSql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_conn_pending_unique
          ON connection_requests (sender_id, receiver_id)
          WHERE status = 'pending'
      `;
      await followSql`
        CREATE TABLE IF NOT EXISTS user_blocks (
          id TEXT PRIMARY KEY,
          blocker_id TEXT NOT NULL,
          blocked_id TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT user_blocks_unique_pair UNIQUE (blocker_id, blocked_id)
        )
      `;
      await followSql`
        CREATE TABLE IF NOT EXISTS user_reports (
          id TEXT PRIMARY KEY,
          reporter_id TEXT NOT NULL,
          reported_id TEXT NOT NULL,
          reason TEXT NOT NULL,
          details TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await followSql`
        CREATE TABLE IF NOT EXISTS anonymous_conversations (
          id TEXT PRIMARY KEY,
          user_a TEXT NOT NULL,
          user_b TEXT NOT NULL,
          connection_id TEXT,
          expires_at TIMESTAMPTZ NOT NULL,
          revealed BOOLEAN NOT NULL DEFAULT FALSE,
          reveal_consent_a BOOLEAN NOT NULL DEFAULT FALSE,
          reveal_consent_b BOOLEAN NOT NULL DEFAULT FALSE,
          ended BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
    })()
      .then(() => undefined)
      .catch((err: unknown) => {
        discoverTablesReady = null;
        throw err;
      });
  }

  await discoverTablesReady;
}

/* ---------- Interests ---------- */

app.get(
  '/api/discover/interests',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureDiscoverTables();
      const currentUserId = req.user!.id;
      const rows = await followSql`
        SELECT interests FROM users WHERE id = ${currentUserId} LIMIT 1
      `;
      return res.json({
        success: true,
        interests: Array.isArray(rows[0]?.interests) ? rows[0].interests : [],
      });
    } catch (error) {
      console.error('[DISCOVER INTERESTS GET]', error);
      return res.status(500).json({ success: false, error: 'تعذر تحميل الاهتمامات.' });
    }
  }
);

app.put(
  '/api/discover/interests',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureDiscoverTables();
      const currentUserId = req.user!.id;
      const raw = Array.isArray(req.body?.interests) ? req.body.interests : [];
      const interests = raw
        .filter((x: unknown) => typeof x === 'string')
        .map((x: string) => x.slice(0, 40))
        .filter((x: string, i: number, a: string[]) => x && a.indexOf(x) === i)
        .slice(0, 20);

      await followSql`
        UPDATE users SET interests = ${interests} WHERE id = ${currentUserId}
      `;
      return res.json({ success: true, interests });
    } catch (error) {
      console.error('[DISCOVER INTERESTS PUT]', error);
      return res.status(500).json({ success: false, error: 'تعذر حفظ الاهتمامات.' });
    }
  }
);

/* ---------- Recommendations ---------- */

app.get(
  '/api/discover/recommendations',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureDiscoverTables();
      const currentUserId = req.user!.id;
      const limit = Math.min(
        Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1),
        50
      );

      const me = await followSql`
        SELECT interests FROM users WHERE id = ${currentUserId} LIMIT 1
      `;
      const myInterests: string[] = Array.isArray(me[0]?.interests) ? me[0].interests : [];

      if (myInterests.length === 0) {
        return res.json({ success: true, users: [] });
      }

      const rows = await followSql`
        SELECT id, name, avatar, city, interests
        FROM users
        WHERE id != ${currentUserId}
          AND COALESCE(is_active, true) = true
          AND COALESCE(is_banned, false) = false
          AND id NOT IN (
            SELECT blocked_id FROM user_blocks WHERE blocker_id = ${currentUserId}
            UNION
            SELECT blocker_id FROM user_blocks WHERE blocked_id = ${currentUserId}
          )
          AND id NOT IN (
            SELECT receiver_id FROM connection_requests
            WHERE sender_id = ${currentUserId} AND status IN ('pending', 'accepted')
            UNION
            SELECT sender_id FROM connection_requests
            WHERE receiver_id = ${currentUserId} AND status IN ('pending', 'accepted')
          )
          AND ${myInterests}::text[] && interests
        ORDER BY array_length(interests, 1) DESC NULLS LAST, name ASC
        LIMIT ${limit}
      `;

      const users = (rows as any[]).map((u: any) => {
        const theirInterests: string[] = Array.isArray(u.interests) ? u.interests : [];
        const shared = myInterests.filter((i) => theirInterests.includes(i));
        return {
          id: u.id,
          anonymousName: 'Anonymous',
          anonymousAvatar: null,
          sharedInterests: shared,
        };
      });

      return res.json({ success: true, users });
    } catch (error) {
      console.error('[DISCOVER RECOMMENDATIONS]', error);
      return res.status(500).json({ success: false, error: 'تعذر تحميل الاقتراحات.' });
    }
  }
);

/* ---------- Connect / Connections ---------- */

app.post(
  '/api/discover/connect',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureDiscoverTables();
      const currentUserId = req.user!.id;
      const targetUserId = String(req.body?.userId || '').trim();

      if (!targetUserId || targetUserId === currentUserId) {
        return res.status(400).json({ success: false, error: 'معرف المستخدم غير صالح.' });
      }

      const target = await followSql`
        SELECT id FROM users WHERE id = ${targetUserId} AND COALESCE(is_banned, false) = false LIMIT 1
      `;
      if (!target[0]) {
        return res.status(404).json({ success: false, error: 'المستخدم غير موجود.' });
      }

      const blocked = await followSql`
        SELECT 1 FROM user_blocks
        WHERE (blocker_id = ${currentUserId} AND blocked_id = ${targetUserId})
           OR (blocker_id = ${targetUserId} AND blocked_id = ${currentUserId})
        LIMIT 1
      `;
      if (blocked[0]) {
        return res.status(400).json({ success: false, error: 'لا يمكن إرسال طلب لهذا المستخدم.' });
      }

      const id = 'conn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      await followSql`
        INSERT INTO connection_requests (id, sender_id, receiver_id, status)
        VALUES (${id}, ${currentUserId}, ${targetUserId}, 'pending')
        ON CONFLICT (sender_id, receiver_id) WHERE status = 'pending' DO NOTHING
      `;
      return res.json({ success: true, status: 'pending' });
    } catch (error) {
      console.error('[DISCOVER CONNECT]', error);
      return res.status(500).json({ success: false, error: 'تعذر إرسال طلب الاتصال.' });
    }
  }
);

app.post(
  '/api/discover/connections/:id/accept',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureDiscoverTables();
      const currentUserId = req.user!.id;
      const id = String(req.params.id || '').trim();

      const existing = await followSql`
        SELECT id, sender_id, receiver_id, status
        FROM connection_requests
        WHERE id = ${id} AND receiver_id = ${currentUserId} AND status = 'pending'
        LIMIT 1
      `;
      if (!existing[0]) {
        return res.status(404).json({ success: false, error: 'طلب الاتصال غير موجود.' });
      }

      await followSql`
        UPDATE connection_requests
        SET status = 'accepted', updated_at = NOW()
        WHERE id = ${id}
      `;

      const senderId = existing[0].sender_id;
      const receiverId = existing[0].receiver_id;

      // Create (or reuse) the anonymous conversation for both users.
      const already = await followSql`
        SELECT id FROM anonymous_conversations
        WHERE (user_a = ${senderId} AND user_b = ${receiverId})
           OR (user_a = ${receiverId} AND user_b = ${senderId})
        LIMIT 1
      `;

      let conversationId: string;
      if (already[0]) {
        conversationId = already[0].id;
      } else {
        conversationId = 'anon_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
        const expiresAt = new Date(Date.now() + 40 * 60 * 1000).toISOString();
        await followSql`
          INSERT INTO anonymous_conversations (id, user_a, user_b, connection_id, expires_at, revealed, reveal_consent_a, reveal_consent_b, ended, created_at)
          VALUES (${conversationId}, ${senderId}, ${receiverId}, ${id}, ${expiresAt}, FALSE, FALSE, FALSE, FALSE, NOW())
        `;
      }

      return res.json({ success: true, status: 'accepted', conversationId });
    } catch (error) {
      console.error('[DISCOVER ACCEPT]', error);
      return res.status(500).json({ success: false, error: 'تعذر قبول الطلب.' });
    }
  }
);

app.post(
  '/api/discover/connections/:id/decline',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureDiscoverTables();
      const currentUserId = req.user!.id;
      const id = String(req.params.id || '').trim();
      const rows = await followSql`
        UPDATE connection_requests
        SET status = 'declined', updated_at = NOW()
        WHERE id = ${id} AND receiver_id = ${currentUserId} AND status = 'pending'
        RETURNING id
      `;
      if (!rows[0]) {
        return res.status(404).json({ success: false, error: 'طلب الاتصال غير موجود.' });
      }
      return res.json({ success: true, status: 'declined' });
    } catch (error) {
      console.error('[DISCOVER DECLINE]', error);
      return res.status(500).json({ success: false, error: 'تعذر رفض الطلب.' });
    }
  }
);

app.get(
  '/api/discover/connections/requests',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureDiscoverTables();
      const currentUserId = req.user!.id;
      const meRows = await followSql`SELECT interests FROM users WHERE id = ${currentUserId} LIMIT 1`;
      const myInterests: string[] = (meRows as any[])[0]?.interests || [];
      const rows = await followSql`
        SELECT cr.id, cr.sender_id, u.interests AS sender_interests
        FROM connection_requests cr
        JOIN users u ON u.id = cr.sender_id
        WHERE cr.receiver_id = ${currentUserId} AND cr.status = 'pending'
        ORDER BY cr.created_at DESC
      `;
      return res.json({
        success: true,
        requests: (rows as any[]).map((r: any) => {
          const senderInterests: string[] = r.sender_interests || [];
          const sharedInterests = senderInterests.filter((i: string) => myInterests.includes(i));
          return {
            id: r.id,
            senderId: r.sender_id,
            anonymousName: 'Anonymous',
            sharedInterests,
          };
        }),
      });
    } catch (error) {
      console.error('[DISCOVER REQUESTS]', error);
      return res.status(500).json({ success: false, error: 'تعذر تحميل الطلبات.' });
    }
  }
);

/* ---------- Block / Unblock ---------- */

app.post(
  '/api/discover/block',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureDiscoverTables();
      const currentUserId = req.user!.id;
      const targetUserId = String(req.body?.userId || '').trim();

      if (!targetUserId || targetUserId === currentUserId) {
        return res.status(400).json({ success: false, error: 'معرف المستخدم غير صالح.' });
      }

      const id = 'blk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      await followSql`
        INSERT INTO user_blocks (id, blocker_id, blocked_id)
        VALUES (${id}, ${currentUserId}, ${targetUserId})
        ON CONFLICT (blocker_id, blocked_id) DO NOTHING
      `;
      await followSql`
        DELETE FROM connection_requests
        WHERE status = 'pending'
          AND ((sender_id = ${currentUserId} AND receiver_id = ${targetUserId})
            OR (sender_id = ${targetUserId} AND receiver_id = ${currentUserId}))
      `;
      return res.json({ success: true });
    } catch (error) {
      console.error('[DISCOVER BLOCK]', error);
      return res.status(500).json({ success: false, error: 'تعذر حظر المستخدم.' });
    }
  }
);

app.delete(
  '/api/discover/block/:userId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureDiscoverTables();
      const currentUserId = req.user!.id;
      const targetUserId = String(req.params.userId || '').trim();
      await followSql`
        DELETE FROM user_blocks
        WHERE blocker_id = ${currentUserId} AND blocked_id = ${targetUserId}
      `;
      return res.json({ success: true });
    } catch (error) {
      console.error('[DISCOVER UNBLOCK]', error);
      return res.status(500).json({ success: false, error: 'تعذر إلغاء الحظر.' });
    }
  }
);

/* ---------- Report ---------- */

app.post(
  '/api/discover/report',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureDiscoverTables();
      const currentUserId = req.user!.id;
      const targetUserId = String(req.body?.userId || '').trim();
      const reason = String(req.body?.reason || '').trim();
      const details = typeof req.body?.details === 'string' ? req.body.details.slice(0, 500) : null;

      if (!targetUserId || targetUserId === currentUserId) {
        return res.status(400).json({ success: false, error: 'معرف المستخدم غير صالح.' });
      }
      if (!reason) {
        return res.status(400).json({ success: false, error: 'سبب البلاغ مطلوب.' });
      }

      const target = await followSql`
        SELECT id FROM users WHERE id = ${targetUserId} LIMIT 1
      `;
      if (!target[0]) {
        return res.status(404).json({ success: false, error: 'المستخدم غير موجود.' });
      }

      const id = 'rpt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      await followSql`
        INSERT INTO user_reports (id, reporter_id, reported_id, reason, details, status)
        VALUES (${id}, ${currentUserId}, ${targetUserId}, ${reason}, ${details}, 'pending')
      `;
      return res.json({ success: true });
    } catch (error) {
      console.error('[DISCOVER REPORT]', error);
      return res.status(500).json({ success: false, error: 'تعذر إرسال البلاغ.' });
    }
  }
);

/* ---------- Anonymous conversations (reuse the messages table) ---------- */

const ANON_DURATION_MS = 40 * 60 * 1000;

async function getAnonymousConversation(convId: string, userId: string): Promise<any | null> {
  const rows = await followSql`
    SELECT * FROM anonymous_conversations WHERE id = ${convId} LIMIT 1
  `;
  const conv = (rows as any[])[0];
  if (!conv) return null;
  if (conv.user_a !== userId && conv.user_b !== userId) return null;
  return conv;
}

app.get(
  '/api/discover/connections',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureDiscoverTables();
      const me = req.user!.id;
      const rows = await followSql`
        SELECT * FROM anonymous_conversations
        WHERE (user_a = ${me} OR user_b = ${me}) AND ended = FALSE
        ORDER BY created_at DESC
      `;
      const now = Date.now();
      const list = await Promise.all(
        (rows as any[]).map(async (c: any) => {
          const expired = !c.revealed && new Date(c.expires_at).getTime() <= now;
          if (expired) {
            await followSql`UPDATE anonymous_conversations SET ended = TRUE WHERE id = ${c.id}`;
          }
          const otherId = c.user_a === me ? c.user_b : c.user_a;
          const iAmA = c.user_a === me;
          return {
            conversationId: c.id,
            otherId,
            expiresAt: c.expires_at,
            revealed: Boolean(c.revealed) && !expired,
            ended: Boolean(c.ended) || expired,
            myConsent: Boolean(iAmA ? c.reveal_consent_a : c.reveal_consent_b),
            otherConsent: Boolean(iAmA ? c.reveal_consent_b : c.reveal_consent_a),
          };
        })
      );
      return res.json({ success: true, connections: list.filter((c: any) => !c.ended) });
    } catch (error) {
      console.error('[DISCOVER CONNECTIONS]', error);
      return res.status(500).json({ success: false, error: 'تعذر تحميل المحادثات.' });
    }
  }
);

app.get(
  '/api/discover/conversation/:convId/messages',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureDiscoverTables();
      const me = req.user!.id;
      const convId = String(req.params.convId || '').trim();
      const conv = await getAnonymousConversation(convId, me);
      if (!conv) return res.status(404).json({ success: false, error: 'المحادثة غير موجودة.' });

      const expired = !conv.revealed && !conv.ended && new Date(conv.expires_at).getTime() <= Date.now();
      if (expired) {
        await followSql`UPDATE anonymous_conversations SET ended = TRUE WHERE id = ${convId}`;
      }
      const ended = Boolean(conv.ended) || expired;
      const revealed = Boolean(conv.revealed) && !ended;

      const rows = await followSql`
        SELECT * FROM messages WHERE conversation_id = ${convId} ORDER BY created_at ASC
      `;
      const messages = (rows as any[]).map((m: any) => ({
        id: m.id,
        senderId: m.sender_id,
        body: m.body,
        createdAt: new Date(m.created_at).toISOString(),
      }));

      const otherId = conv.user_a === me ? conv.user_b : conv.user_a;
      const iAmA = conv.user_a === me;
      const meta: any = {
        conversationId: convId,
        otherId,
        expiresAt: conv.expires_at,
        revealed,
        ended,
        myConsent: Boolean(iAmA ? conv.reveal_consent_a : conv.reveal_consent_b),
        otherConsent: Boolean(iAmA ? conv.reveal_consent_b : conv.reveal_consent_a),
      };
      if (revealed) {
        const prof = await followSql`SELECT name, avatar FROM users WHERE id = ${otherId} LIMIT 1`;
        meta.otherName = prof[0]?.name || 'مستخدم';
        meta.otherAvatar = prof[0]?.avatar || undefined;
      }

      return res.json({ success: true, messages, meta });
    } catch (error) {
      console.error('[DISCOVER MSG GET]', error);
      return res.status(500).json({ success: false, error: 'تعذر تحميل الرسائل.' });
    }
  }
);

app.post(
  '/api/discover/conversation/:convId/messages',
  requireAuth,
  messageRateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureDiscoverTables();
      const me = req.user!.id;
      const convId = String(req.params.convId || '').trim();
      const text = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
      if (!text) return res.status(400).json({ success: false, error: 'نص الرسالة مطلوب.' });
      if (text.length > 2000) return res.status(400).json({ success: false, error: 'الرسالة طويلة جداً.' });

      const conv = await getAnonymousConversation(convId, me);
      if (!conv) return res.status(404).json({ success: false, error: 'المحادثة غير موجودة.' });

      // Enforce the 40-minute anonymous window unless identities are revealed.
      if (!conv.revealed && new Date(conv.expires_at).getTime() <= Date.now()) {
        await followSql`UPDATE anonymous_conversations SET ended = TRUE WHERE id = ${convId}`;
        return res.status(410).json({ success: false, error: 'انتهت المحادثة المجهولة.' });
      }
      if (conv.ended) return res.status(410).json({ success: false, error: 'انتهت المحادثة.' });

      const otherId = conv.user_a === me ? conv.user_b : conv.user_a;
      const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      const createdAt = new Date().toISOString();
      await followSql`
        INSERT INTO messages (id, sender_id, recipient_id, body, read, status, created_at, conversation_id)
        VALUES (${msgId}, ${me}, ${otherId}, ${text}, FALSE, 'sent', ${createdAt}, ${convId})
      `;
      return res.status(201).json({
        success: true,
        message: { id: msgId, senderId: me, recipientId: otherId, body: text, read: false, status: 'sent', createdAt },
      });
    } catch (error) {
      console.error('[DISCOVER MSG SEND]', error);
      return res.status(500).json({ success: false, error: 'تعذر إرسال الرسالة.' });
    }
  }
);

app.post(
  '/api/discover/conversation/:convId/end',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureDiscoverTables();
      const me = req.user!.id;
      const convId = String(req.params.convId || '').trim();
      const conv = await getAnonymousConversation(convId, me);
      if (!conv) return res.status(404).json({ success: false, error: 'المحادثة غير موجودة.' });
      await followSql`UPDATE anonymous_conversations SET ended = TRUE WHERE id = ${convId}`;
      return res.json({ success: true });
    } catch (error) {
      console.error('[DISCOVER END]', error);
      return res.status(500).json({ success: false, error: 'تعذر إنهاء المحادثة.' });
    }
  }
);

app.post(
  '/api/discover/conversation/:convId/reveal',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await ensureDiscoverTables();
      const me = req.user!.id;
      const convId = String(req.params.convId || '').trim();
      const conv = await getAnonymousConversation(convId, me);
      if (!conv) return res.status(404).json({ success: false, error: 'المحادثة غير موجودة.' });
      if (conv.ended) return res.status(410).json({ success: false, error: 'انتهت المحادثة.' });
      if (conv.revealed) return res.json({ success: true, revealed: true });
      if (!conv.revealed && new Date(conv.expires_at).getTime() <= Date.now()) {
        return res.status(410).json({ success: false, error: 'انتهت المحادثة المجهولة.' });
      }

      const iAmA = conv.user_a === me;
      if (iAmA) {
        await followSql`UPDATE anonymous_conversations SET reveal_consent_a = TRUE WHERE id = ${convId}`;
      } else {
        await followSql`UPDATE anonymous_conversations SET reveal_consent_b = TRUE WHERE id = ${convId}`;
      }
      const updated = await followSql`SELECT * FROM anonymous_conversations WHERE id = ${convId} LIMIT 1`;
      const u = (updated as any[])[0];
      const nowRevealed = Boolean(u.reveal_consent_a) && Boolean(u.reveal_consent_b);
      if (nowRevealed) {
        await followSql`UPDATE anonymous_conversations SET revealed = TRUE WHERE id = ${convId}`;
      }
      return res.json({
        success: true,
        revealed: nowRevealed,
        myConsent: true,
        otherConsent: Boolean(iAmA ? u.reveal_consent_b : u.reveal_consent_a),
      });
    } catch (error) {
      console.error('[DISCOVER REVEAL]', error);
      return res.status(500).json({ success: false, error: 'تعذر كشف الهوية.' });
    }
  }
);

const distPath = path.resolve(process.cwd(), 'dist');

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distPath));

  app.get('*', (req: Request, res: Response) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        success: false,
        error: 'API endpoint not found',
      });
    }

    return res.sendFile(path.join(distPath, 'index.html'));
  });
}

export default app;
