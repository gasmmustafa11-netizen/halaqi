import { neon } from "@neondatabase/serverless";
import express, { Request, Response } from 'express';
import path from 'path';
import { db } from './db.js';
import { getNotificationsFromNeon, loadAllFromNeon } from './db.js';
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

    return res.json({
      success: true,
      salon,
    });
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
        error: 'تعذر حفظ المنشور.',
      });
    }
  }
);


/* =========================================================
   PUBLIC USER PROFILE
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
