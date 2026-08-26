import { neon } from "@neondatabase/serverless";
import express, { Request, Response } from 'express';
import path from 'path';
import { db } from './db.js';
import { getNotificationsFromNeon } from './db.js';
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

app.get('/api/salons', async (_req: Request, res: Response) => {
  try {
    const salons =
      typeof (db as any).getAllSalonsFromNeon === 'function'
        ? await (db as any).getAllSalonsFromNeon()
        : db.getState().salons;

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

app.get('/api/salons/:id', async (req: Request, res: Response) => {
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
app.get('/api/posts/feed', async (_req: Request, res: Response) => {
  try {
    const posts = await db.getUnifiedPostsFeed();

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

      /* التأكد من وجود الحساب */
      const targetRows = await followSql`
        SELECT id, name, is_active, is_banned
        FROM users
        WHERE id = ${targetUserId}
        LIMIT 1
      `;

      const target = targetRows[0];

      if (
        !target ||
        target.is_active === false ||
        target.is_banned === true
      ) {
        return res.status(404).json({
          success: false,
          error: 'هذا الحساب غير متاح.',
        });
      }

      /* هل توجد متابعة أصلًا؟ */
      const existing = await followSql`
        SELECT id
        FROM user_follows
        WHERE follower_id = ${currentUserId}
          AND following_id = ${targetUserId}
        LIMIT 1
      `;

      let isFollowing = false;

      if (existing.length > 0) {

        /* إلغاء المتابعة */
        await followSql`
          DELETE FROM user_follows
          WHERE follower_id = ${currentUserId}
            AND following_id = ${targetUserId}
        `;

        isFollowing = false;

      } else {

        /* إضافة المتابعة */
        await followSql`
          INSERT INTO user_follows (
            id,
            follower_id,
            following_id
          )
          VALUES (
            ${`follow_${Date.now()}_${Math.random()
              .toString(36)
              .slice(2, 10)}`},
            ${currentUserId},
            ${targetUserId}
          )
          ON CONFLICT (follower_id, following_id)
          DO NOTHING
        `;

        isFollowing = true;

        /*
         * إرسال إشعار للهدف عند المتابعة فقط.
         * نستخدم نظام الإشعارات المركزي الموجود في db.ts
         * حتى يتم الحفظ في Neon بنفس البنية التي يقرأها التطبيق.
         */
        try {
          const follower =
            db.getUserById(currentUserId) ||
            await db.getUserByIdFromNeon(currentUserId);

          if (follower) {
            await db.createNotification({
              userId: targetUserId,
              title: 'متابع جديد',
              titleEn: 'New Follower',
              message: `${follower.name || 'مستخدم'} بدأ بمتابعتك.`,
              messageEn: `${follower.name || 'A user'} started following you.`,
              type: 'system',
              link: `/profile/${currentUserId}`,
            });

            console.log(
              '[FOLLOW NOTIFICATION] notification created',
              {
                followerId: currentUserId,
                targetUserId,
              }
            );
          }
        } catch (notificationError: any) {
          /*
           * فشل الإشعار لا يلغي عملية المتابعة.
           */
          console.error(
            '[FOLLOW NOTIFICATION ERROR]',
            notificationError?.message || notificationError
          );
        }
      }

      /* تحديث العدادات */
      const counts = await followSql`
        SELECT
          COUNT(*) FILTER (
            WHERE following_id = ${targetUserId}
          ) AS followers_count,

          COUNT(*) FILTER (
            WHERE follower_id = ${targetUserId}
          ) AS following_count

        FROM user_follows
      `;

      return res.json({
        success: true,
        isFollowing,
        followersCount: Number(
          counts[0]?.followers_count || 0
        ),
        followingCount: Number(
          counts[0]?.following_count || 0
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

app.get('/api/cities', (_req: Request, res: Response) => {
  try {
    return res.json({
      success: true,
      cities: db.getState().cities || [],
    });
  } catch {
    return res.json({
      success: true,
      cities: [],
    });
  }
});

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
  try {
    const q = String(req.query.q || '').trim();

    if (!q) {
      return res.json({
        success: true,
        salons: [],
        users: [],
      });
    }

    const state = db.getState();

    const salons = (state.salons || []).filter((salon: any) =>
      String(salon.name || '').toLowerCase().includes(q.toLowerCase())
    );

    // المستخدمون: القراءة مباشرة من Neon حتى يظهر الاسم الحالي بعد تغييره
    const userRows = await followSql`
      SELECT
        id,
        name,
        email,
        phone,
        role,
        city,
        salon_id,
        avatar,
        is_active,
        is_banned,
        created_at
      FROM users
      WHERE LOWER(COALESCE(name, '')) LIKE ${'%' + q.toLowerCase() + '%'}
      ORDER BY name ASC
      LIMIT 50
    `;

    const users = userRows.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      city: u.city,
      salonId: u.salon_id || undefined,
      avatar: u.avatar || undefined,
      isActive: u.is_active !== false,
      isBanned: u.is_banned === true,
      createdAt: u.created_at
        ? new Date(u.created_at).toISOString()
        : undefined,
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
