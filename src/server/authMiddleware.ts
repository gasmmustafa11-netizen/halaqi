import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db, UserWithAuth } from './db';
import { User, UserRole } from '../types';

// Server-side signing secret
const AUTH_SECRET = process.env.HALAQI_AUTH_SECRET;

if (!AUTH_SECRET) {
  throw new Error('HALAQI_AUTH_SECRET is required');
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  salonId?: string;
  iat: number;
  exp: number;
}

// Extend Express Request type
export interface AuthenticatedRequest extends Request {
  user?: User;
  rawUser?: UserWithAuth;
}

// Generate signed HMAC token
export function generateToken(user: User, expiresInDays: number = 365): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    salonId: user.salonId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60,
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${payloadStr}`)
    .digest('base64url');

  return `${header}.${payloadStr}.${signature}`;
}

// Verify signed HMAC token
export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payloadStr, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', AUTH_SECRET)
      .update(`${header}.${payloadStr}`)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

// Middleware: Extract & verify user if token exists (non-blocking)
export function optionalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const payload = verifyToken(token);

  if (payload) {
    const user = db.getUserById(payload.userId);
    if (user && !user.isBanned && user.isActive) {
      req.rawUser = user;
      req.user = db.sanitizeUser(user);
    }
  }

  next();
}

// Middleware: Strictly require valid login
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      error: 'يجب تسجيل الدخول للوصول إلى هذا الإجراء (401 Unauthorized)',
    });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_TOKEN',
      error: 'جلسة تسجيل الدخول غير صالحة أو منتهية. يرجى تسجيل الدخول مجدداً.',
    });
  }

  let user = db.getUserById(payload.userId);

  if (!user) {
    try {
      user = await db.getUserByIdFromNeon(payload.userId);

      if (user) {
        const existsInMemory = db.getState().users.some(
          (u) => u.id === user!.id
        );

        if (!existsInMemory) {
          db.getState().users.push(user);
        }
      }
    } catch (error: any) {
      console.error(
        '[AUTH NEON FALLBACK] Failed to load user:',
        error?.message || error
      );
    }
  }

  if (!user) {
    return res.status(401).json({
      success: false,
      code: 'USER_NOT_FOUND',
      error: 'المستخدم غير مسجل في النظام.',
    });
  }

  if (user.isBanned) {
    return res.status(403).json({
      success: false,
      code: 'USER_BANNED',
      error: 'تم إيقاف هذا الحساب من قبل إدارة المنصة.',
    });
  }

  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      code: 'USER_INACTIVE',
      error: 'هذا الحساب غير نشط حالياً.',
    });
  }

  req.rawUser = user;
  req.user = db.sanitizeUser(user);
  next();
}

// Middleware: Role-Based Access Control (RBAC)
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        error: 'يجب تسجيل الدخول أولاً للتحقق من الصلاحيات.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Log unauthorized intrusion attempt in audit logs
      db.addAuditLog({
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        targetType: 'system',
        details: `محاولة وصول غير مصرح بها إلى المسار ${req.originalUrl} من قبل المستخدم (${req.user.role})`,
        ip: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
        status: 'failure',
      });

      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'عذراً، ليس لديك صلاحية كافية لتنفيذ هذا الإجراء (403 Forbidden)',
      });
    }

    next();
  };
}

// Middleware: Require Salon Owner or Admin
export async function requireSalonOwnerOrAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  console.error('[SERVICE_AUTH] ENTER', {
    userId: req.user?.id,
    role: req.user?.role,
    bodySalonId: req.body?.salonId,
    paramSalonId: req.params?.salonId,
    querySalonId: req.query?.salonId,
  });

  if (!req.user) {
    console.error('[SERVICE_AUTH] REJECT_NO_USER');
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      error: 'يجب تسجيل الدخول أولاً.',
    });
  }

  if (req.user.role === 'admin') {
    console.error('[SERVICE_AUTH] ALLOW_ADMIN');
    return next();
  }

  if (req.user.role !== 'salon_owner' && req.user.role !== 'staff') {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      error: 'هذا الإجراء مخصص لأصحاب الصالونات ومديري النظام فقط.',
    });
  }

  // Determine target salonId from params, body, or query
  const targetSalonId = req.params.salonId || req.params.id || req.body.salonId || (req.query.salonId as string);

  console.error('[SERVICE_AUTH] TARGET', {
    targetSalonId,
    userId: req.user.id,
    role: req.user.role,
  });

  if (targetSalonId) {
    const isOwner = await db.isApprovedSalonOwnerFromNeon(
      req.user.id,
      targetSalonId
    );

    console.error('[SERVICE_AUTH] OWNERSHIP_RESULT', {
      targetSalonId,
      userId: req.user.id,
      isOwner,
    });
    if (!isOwner) {
      db.addAuditLog({
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'CROSS_SALON_ACCESS_BLOCKED',
        targetType: 'salon',
        targetId: targetSalonId,
        details: `محاولة تعديل أو إدارة صالون لا يملكه المستخدم: ${targetSalonId}`,
        ip: req.ip || '127.0.0.1',
        status: 'failure',
      });

      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN_SALON_OWNERSHIP',
        error: 'غير مصرح لك بإدارة أو تعديل بيانات هذا الصالون.',
      });
    }
  }

  next();
}
