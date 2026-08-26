import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { db, loadUsersFromNeon } from './src/server/db';
import {
  AuthenticatedRequest,
  generateToken,
  optionalAuthMiddleware,
  requireAuth,
  requireRole,
  requireSalonOwnerOrAdmin,
} from './src/server/authMiddleware';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3001;

  app.use(express.json());

  // Attach optional auth extraction to all routes
  app.use(optionalAuthMiddleware);

  // Log incoming API requests
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      const userStr = (req as AuthenticatedRequest).user
        ? `[User: ${(req as AuthenticatedRequest).user?.role} - ${(req as AuthenticatedRequest).user?.email}]`
        : '[Public]';
      console.log(`[API] ${req.method} ${req.path} ${userStr}`);
    }
    next();
  });

  // Admin lift salon suspension
  app.put('/api/admin/salons/:id/lift-sanction', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
    const salon = db.getSalonById(req.params.id);

    if (!salon) {
      return res.status(404).json({ success: false, error: 'الصالون غير موجود' });
    }

    salon.status = 'approved';
    delete salon.suspensionReason;
    delete salon.suspensionStartedAt;
    delete salon.suspensionEndsAt;

    db.addAuditLog({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: 'admin',
      action: 'SALON_SANCTION_LIFT',
      targetType: 'salon',
      targetId: salon.id,
      details: `رفع عقوبة الصالون ${salon.name}`,
      ip: req.ip || '127.0.0.1',
      status: 'success',
    });

    res.json({ success: true, salon });
  });

  // ==========================================
  // AUTH ENDPOINTS
  // ==========================================
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { emailOrPhone, password, role } = req.body;
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';

    if (!emailOrPhone && !role) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال رقم الهاتف أو البريد الإلكتروني' });
    }

    let authResult = db.authenticate(emailOrPhone || '', password);


    if (!authResult.success || !authResult.user) {
      // Record failed login audit attempt
      db.addAuditLog({
        userId: 'unknown',
        userEmail: emailOrPhone || 'unknown',
        userRole: 'customer',
        action: 'LOGIN_FAILURE',
        targetType: 'auth',
        details: `محاولة تسجيل دخول فاشلة للمعرف ${emailOrPhone}`,
        ip,
        status: 'failure',
      });

      return res.status(401).json({
        success: false,
        error: authResult.error || 'بيانات الدخول غير صحيحة.',
      });
    }

    const user = authResult.user;
    const token = generateToken(user);

    // Record successful login audit log
    db.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: user.role === 'admin' ? 'ADMIN_LOGIN' : 'USER_LOGIN',
      targetType: 'auth',
      targetId: user.id,
      details: `تسجيل دخول ناجح للمستخدم ${user.name} (${user.role})`,
      ip,
      status: 'success',
    });

    res.json({
      success: true,
      user,
      token,
    });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { name, email, phone, password, role, city } = req.body;
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'الاسم ورقم الهاتف مطلوبان' });
    }

    // Role restrictions: Registration can NEVER create an admin
    if (role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'غير مصرح بإنشاء حساب مدير عبر التسجيل العام. يتم تعيين الإدارة مركزياً فقط.',
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
      password,
      ip
    );

    if (!result.success || !result.user) {
      return res.status(400).json({ success: false, error: result.error });
    }

    const token = generateToken(result.user);

    res.status(201).json({
      success: true,
      user: result.user,
      token,
    });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      user: req.user,
    });
  });

  // ==========================================
  // SALONS ENDPOINTS
  // ==========================================
  app.get('/api/salons', (req: AuthenticatedRequest, res: Response) => {
    const { type, city, query, includePending } = req.query;
    let salons = db.getState().salons;

    // Only Admin can see pending/rejected salons
    const isAdmin = req.user?.role === 'admin';
    const isOwner = req.user?.role === 'salon_owner';

    if (includePending === 'true') {
      if (isAdmin) {
        // admin sees all
      } else if (isOwner && req.user?.salonId) {
        // owner sees approved + their own
        salons = salons.filter((s) => s.status === 'approved' || s.id === req.user?.salonId || s.ownerId === req.user?.id);
      } else {
        salons = salons.filter((s) => s.status === 'approved');
      }
    } else {
      salons = salons.filter((s) => s.status === 'approved');
    }

    if (type && type !== 'all') {
      salons = salons.filter((s) => s.type === type || s.type === 'unisex');
    }

    if (city && city !== 'all') {
      salons = salons.filter((s) => s.city.toLowerCase() === (city as string).toLowerCase());
    }

    if (query && typeof query === 'string' && query.trim()) {
      const q = query.toLowerCase().trim();
      salons = salons.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.nameEn.toLowerCase().includes(q) ||
          s.area.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
    }

    res.json({ success: true, salons });
  });

  app.get('/api/salons/:id', (req: Request, res: Response) => {
    const salon = db.getSalonById(req.params.id);
    if (!salon) {
      return res.status(404).json({ success: false, error: 'الصالون غير موجود' });
    }
    const services = db.getServicesBySalon(salon.id);
    const barbers = db.getBarbersBySalon(salon.id);
    const reviews = db.getState().reviews.filter((r) => r.salonId === salon.id);

    res.json({
      success: true,
      salon,
      services,
      barbers,
      reviews,
    });
  });

  app.post('/api/salons', requireAuth, requireRole('salon_owner', 'admin'), (req: AuthenticatedRequest, res: Response) => {
    const data = req.body;
    const ip = req.ip || '127.0.0.1';

    const newSalon = {
      ...data,
      id: `salon_${Date.now()}`,
      ownerId: req.user!.id,
      slug: data.nameEn ? data.nameEn.toLowerCase().replace(/\s+/g, '-') : `salon-${Date.now()}`,
      rating: 5.0,
      reviewCount: 0,
      status: req.user!.role === 'admin' ? 'approved' : 'pending', // Requires admin approval for owners
      isVerified: req.user!.role === 'admin',
      createdAt: new Date().toISOString(),
    };

    db.getState().salons.push(newSalon);

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

  app.put('/api/salons/:id', requireAuth, requireSalonOwnerOrAdmin, (req: AuthenticatedRequest, res: Response) => {
    const index = db.getState().salons.findIndex((s) => s.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'الصالون غير موجود' });
    }

    // Salon owners cannot change their own approval status or commission rate (Admin only)
    const updatePayload = { ...req.body };
    if (req.user!.role !== 'admin') {
      delete updatePayload.status;
      delete updatePayload.commissionRate;
      delete updatePayload.isVerified;
      delete updatePayload.ownerId;
    }

    db.getState().salons[index] = { ...db.getState().salons[index], ...updatePayload };

    db.addAuditLog({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'SALON_UPDATE',
      targetType: 'salon',
      targetId: req.params.id,
      details: `تحديث بيانات الصالون ${db.getState().salons[index].name}`,
      ip: req.ip || '127.0.0.1',
      status: 'success',
    });

    res.json({ success: true, salon: db.getState().salons[index] });
  });

  app.delete('/api/salons/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
    const index = db.getState().salons.findIndex((s) => s.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'الصالون غير موجود' });
    }
    const targetSalon = db.getState().salons[index];
    db.getState().salons.splice(index, 1);

    db.addAuditLog({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: 'admin',
      action: 'SALON_DELETE',
      targetType: 'salon',
      targetId: targetSalon.id,
      details: `حذف الصالون ${targetSalon.name} نهائياً`,
      ip: req.ip || '127.0.0.1',
      status: 'warning',
    });

    res.json({ success: true });
  });

  // Admin approve/reject/suspend salon
  app.put('/api/admin/salons/:id/status', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
    const { status, isVerified, commissionRate, suspensionReason, suspensionHours } = req.body;
    const salon = db.getSalonById(req.params.id);
    if (!salon) {
      return res.status(404).json({ success: false, error: 'الصالون غير موجود' });
    }

    if (status) {
      salon.status = status;

      if (status === 'suspended') {
        const hours = Number(suspensionHours) > 0 ? Number(suspensionHours) : 24;
        salon.suspensionReason = String(suspensionReason || 'مخالفة شروط المنصة');
        salon.suspensionStartedAt = new Date().toISOString();
        salon.suspensionEndsAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      } else if (status === 'approved') {
        delete salon.suspensionReason;
        delete salon.suspensionStartedAt;
        delete salon.suspensionEndsAt;
      }
    }

    if (typeof isVerified === 'boolean') salon.isVerified = isVerified;
    if (typeof commissionRate === 'number') salon.commissionRate = commissionRate;

    db.addAuditLog({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: 'admin',
      action: status === 'approved' ? 'SALON_APPROVE' : status === 'suspended' ? 'SALON_SUSPEND' : 'SALON_STATUS_CHANGE',
      targetType: 'salon',
      targetId: salon.id,
      details: `تحديث حالة الصالون ${salon.name} إلى ${status || salon.status} (توثيق: ${salon.isVerified})`,
      ip: req.ip || '127.0.0.1',
      status: 'success',
    });

    res.json({ success: true, salon });
  });

  // ==========================================
  // SERVICES ENDPOINTS
  // ==========================================
  app.get('/api/services', (req: Request, res: Response) => {
    const { salonId } = req.query;
    if (salonId) {
      return res.json({ success: true, services: db.getServicesBySalon(salonId as string) });
    }
    res.json({ success: true, services: db.getState().services });
  });

  app.post('/api/services', requireAuth, requireSalonOwnerOrAdmin, (req: AuthenticatedRequest, res: Response) => {
    const newService = {
      ...req.body,
      id: `srv_${Date.now()}`,
    };
    db.getState().services.push(newService);

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

    res.status(201).json({ success: true, service: newService });
  });

  app.put('/api/services/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const idx = db.getState().services.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'الخدمة غير موجودة' });

    const targetService = db.getState().services[idx];
    if (req.user!.role !== 'admin' && !db.isSalonOwner(req.user!.id, targetService.salonId)) {
      return res.status(403).json({ success: false, error: 'غير مصرح لك بتعديل خدمات هذا الصالون.' });
    }

    db.getState().services[idx] = { ...targetService, ...req.body };
    res.json({ success: true, service: db.getState().services[idx] });
  });

  app.delete('/api/services/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const idx = db.getState().services.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'الخدمة غير موجودة' });

    const targetService = db.getState().services[idx];
    if (req.user!.role !== 'admin' && !db.isSalonOwner(req.user!.id, targetService.salonId)) {
      return res.status(403).json({ success: false, error: 'غير مصرح لك بحذف خدمات هذا الصالون.' });
    }

    db.getState().services.splice(idx, 1);
    res.json({ success: true });
  });

  // ==========================================
  // BARBERS / STAFF ENDPOINTS
  // ==========================================
  app.get('/api/barbers', (req: Request, res: Response) => {
    const { salonId } = req.query;
    if (salonId) {
      return res.json({ success: true, barbers: db.getBarbersBySalon(salonId as string) });
    }
    res.json({ success: true, barbers: db.getState().barbers });
  });

  app.post('/api/barbers', requireAuth, requireSalonOwnerOrAdmin, (req: AuthenticatedRequest, res: Response) => {
    const newBarber = {
      ...req.body,
      id: `barber_${Date.now()}`,
      rating: 5.0,
      reviewCount: 0,
      isAvailable: true,
    };
    db.getState().barbers.push(newBarber);
    res.status(201).json({ success: true, barber: newBarber });
  });

  app.put('/api/barbers/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const idx = db.getState().barbers.findIndex((b) => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'الحلاق غير موجود' });

    const targetBarber = db.getState().barbers[idx];
    if (req.user!.role !== 'admin' && !db.isSalonOwner(req.user!.id, targetBarber.salonId)) {
      return res.status(403).json({ success: false, error: 'غير مصرح لك بتعديل كادر هذا الصالون.' });
    }

    db.getState().barbers[idx] = { ...targetBarber, ...req.body };
    res.json({ success: true, barber: db.getState().barbers[idx] });
  });

  app.delete('/api/barbers/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const idx = db.getState().barbers.findIndex((b) => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'الحلاق غير موجود' });

    const targetBarber = db.getState().barbers[idx];
    if (req.user!.role !== 'admin' && !db.isSalonOwner(req.user!.id, targetBarber.salonId)) {
      return res.status(403).json({ success: false, error: 'غير مصرح لك بحذف كادر هذا الصالون.' });
    }

    db.getState().barbers.splice(idx, 1);
    res.json({ success: true });
  });

  // ==========================================
  // BOOKINGS (STRICT SERVER-AUTHORITATIVE & RBAC)
  // ==========================================
  app.get('/api/bookings', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { customerId, salonId, status } = req.query;
    let bookings = db.getState().bookings;
    const user = req.user!;

    // RBAC Data Isolation:
    // Customer can ONLY view their own bookings
    if (user.role === 'customer') {
      bookings = bookings.filter((b) => b.customerId === user.id);
    } else if (user.role === 'salon_owner' || user.role === 'staff') {
      // Salon owner can ONLY view bookings for their salon(s)
      const ownedSalonId = user.salonId;
      bookings = bookings.filter(
        (b) => (ownedSalonId && b.salonId === ownedSalonId) || db.isSalonOwner(user.id, b.salonId)
      );
    } else if (user.role === 'admin') {
      // Admin can filter by customerId or salonId if passed
      if (customerId) {
        bookings = bookings.filter((b) => b.customerId === customerId);
      }
      if (salonId) {
        bookings = bookings.filter((b) => b.salonId === salonId);
      }
    }

    if (status) {
      bookings = bookings.filter((b) => b.status === status);
    }

    res.json({ success: true, bookings });
  });

  app.get('/api/bookings/occupied-slots', (req: Request, res: Response) => {
    const { barberId, date } = req.query;
    if (!barberId || !date) {
      return res.status(400).json({ success: false, error: 'barberId and date are required' });
    }
    const slots = db.getOccupiedSlots(barberId as string, date as string);
    res.json({ success: true, occupiedSlots: slots });
  });

  app.post('/api/bookings', requireAuth, (req: AuthenticatedRequest, res: Response) => {
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
      !securePayload.barberId ||
      !securePayload.date ||
      !securePayload.timeSlot
    ) {
      return res.status(400).json({ success: false, error: 'يرجى إكمال جميع بيانات الحجز المطلوبة' });
    }

    const result = db.createBookingAtomic(securePayload, req.body.couponCode, ip);
    if (!result.success) {
      return res.status(409).json({ success: false, error: result.error });
    }

    res.status(201).json({ success: true, booking: result.booking });
  });

  app.put('/api/bookings/:id/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { status } = req.body;
    const user = req.user!;
    const booking = db.getState().bookings.find((b) => b.id === req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, error: 'الحجز غير موجود' });
    }

    // Role check: Only the salon owner of this booking or Admin can update status
    if (user.role !== 'admin' && !db.isSalonOwner(user.id, booking.salonId)) {
      return res.status(403).json({ success: false, error: 'غير مصرح لك بتغيير حالة هذا الحجز.' });
    }

    booking.status = status;

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

    res.json({ success: true, booking });
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

  // ==========================================
  // REVIEWS ENDPOINTS
  // ==========================================
  app.get('/api/reviews', (req: Request, res: Response) => {
    const { salonId } = req.query;
    if (salonId) {
      const reviews = db.getState().reviews.filter((r) => r.salonId === salonId);
      return res.json({ success: true, reviews });
    }
    res.json({ success: true, reviews: db.getState().reviews });
  });

  app.post('/api/reviews', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { salonId, bookingId, rating, comment } = req.body;
    const ip = req.ip || '127.0.0.1';

    if (!salonId || !rating || !comment) {
      return res.status(400).json({ success: false, error: 'بيانات التقييم غير مكتملة' });
    }

    const salon = db.getSalonById(salonId);
    if (!salon) {
      return res.status(404).json({ success: false, error: 'الصالون غير موجود' });
    }

    const result = db.addReview(
      {
        salonId,
        salonName: salon.name,
        bookingId: bookingId || '',
        customerId: req.user!.id,
        customerName: req.user!.name,
        rating: Number(rating),
        comment,
      },
      req.user!,
      ip
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.status(201).json({ success: true, review: result.review });
  });

  // ==========================================
  // COUPONS ENDPOINTS
  // ==========================================
  app.get('/api/coupons', (req: Request, res: Response) => {
    res.json({ success: true, coupons: db.getState().coupons });
  });

  app.post('/api/coupons/validate', (req: Request, res: Response) => {
    const { code, amount } = req.body;
    if (!code || !amount) {
      return res.status(400).json({ success: false, error: 'الكود والمبلغ مطلوبان' });
    }
    const result = db.validateCoupon(code, Number(amount));
    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.message });
    }
    res.json({ success: true, coupon: result.coupon, discount: result.discount });
  });

  app.post('/api/coupons', requireAuth, requireRole('admin', 'salon_owner'), (req: AuthenticatedRequest, res: Response) => {
    const newCoupon = {
      ...req.body,
      id: `cp_${Date.now()}`,
      usageCount: 0,
      isActive: true,
    };
    db.getState().coupons.push(newCoupon);
    res.status(201).json({ success: true, coupon: newCoupon });
  });

  // ==========================================
  // FAVORITES ENDPOINTS
  // ==========================================
  app.get('/api/favorites', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user!.id;
    const favSalonIds = db.getState().favorites.filter((f) => f.userId === uid).map((f) => f.salonId);
    const salons = db.getState().salons.filter((s) => favSalonIds.includes(s.id));
    res.json({ success: true, salons, salonIds: favSalonIds });
  });

  app.post('/api/favorites/toggle', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { salonId } = req.body;
    const uid = req.user!.id;
    const favorites = db.getState().favorites;
    const index = favorites.findIndex((f) => f.userId === uid && f.salonId === salonId);

    let isFavorite = false;
    if (index > -1) {
      favorites.splice(index, 1);
      isFavorite = false;
    } else {
      favorites.push({ userId: uid, salonId });
      isFavorite = true;
    }
    res.json({ success: true, isFavorite });
  });

  // ==========================================
  // NOTIFICATIONS ENDPOINTS
  // ==========================================
  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user!.id;
    const notifs = db.getState().notifications.filter((n) => n.userId === uid || n.type === 'offer' || n.type === 'system');
    res.json({ success: true, notifications: notifs });
  });

  app.put('/api/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const notif = db.getState().notifications.find((n) => n.id === req.params.id && n.userId === req.user!.id);
    if (notif) notif.read = true;
    res.json({ success: true });
  });

  // ==========================================
  // CITIES & SYSTEM CONFIG
  // ==========================================
  app.get('/api/cities', (req: Request, res: Response) => {
    res.json({ success: true, cities: db.getState().cities });
  });

  app.post('/api/cities', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
    const newCity = {
      ...req.body,
      id: req.body.nameEn ? req.body.nameEn.toLowerCase().replace(/\s+/g, '-') : `city-${Date.now()}`,
      active: true,
      salonCount: 0,
    };
    db.getState().cities.push(newCity);
    res.status(201).json({ success: true, city: newCity });
  });

  // ==========================================
  // STRICT ADMIN ENDPOINTS (RBAC PROTECTED)
  // ==========================================
  app.get('/api/admin/audit-logs', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
    const logs = db.getAuditLogs(200);
    res.json({ success: true, auditLogs: logs });
  });

  app.get('/api/admin/users', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
    const users = db.getState().users.map((u) => db.sanitizeUser(u));
    res.json({ success: true, users });
  });

  app.put('/api/admin/users/:id/role', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
    const { role } = req.body;
    const ip = req.ip || '127.0.0.1';
    const result = db.updateUserRole(req.params.id, role, req.user!, ip);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true });
  });

  app.put('/api/admin/users/:id/ban', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
    const ip = req.ip || '127.0.0.1';
    const result = db.toggleUserBan(req.params.id, req.user!, ip);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true, isBanned: result.isBanned });
  });

  app.delete('/api/admin/users/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
    const ip = req.ip || '127.0.0.1';
    const result = db.deleteUser(req.params.id, req.user!, ip);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true });
  });

  app.get('/api/admin/settings', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, settings: db.getState().settings });
  });

  app.put('/api/admin/settings', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
    const oldSettings = { ...db.getState().settings };
    db.getState().settings = { ...db.getState().settings, ...req.body };

    db.addAuditLog({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: 'admin',
      action: 'SETTINGS_UPDATE',
      targetType: 'system',
      details: `تحديث إعدادات المنصة (نسبة العمولة: ${db.getState().settings.commissionRate}%)`,
      ip: req.ip || '127.0.0.1',
      status: 'warning',
    });

    res.json({ success: true, settings: db.getState().settings });
  });

  app.get('/api/admin/stats', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
    const state = db.getState();
    const totalUsers = state.users.length;
    const totalSalons = state.salons.length;
    const activeSalons = state.salons.filter((s) => s.status === 'approved').length;
    const pendingSalons = state.salons.filter((s) => s.status === 'pending').length;
    const totalBookings = state.bookings.length;
    const confirmedBookings = state.bookings.filter((b) => b.status === 'confirmed').length;
    const completedBookings = state.bookings.filter((b) => b.status === 'completed').length;
    const cancelledBookings = state.bookings.filter((b) => b.status === 'cancelled').length;

    const totalRevenue = state.bookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((sum, b) => sum + (b.finalPrice || b.price), 0);

    const platformCommission = state.bookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((sum, b) => sum + (b.commissionAmount || 0), 0);

    const cancellationRate = totalBookings > 0 ? Math.round((cancelledBookings / totalBookings) * 100) : 0;

    const revenueTimeline = [
      { day: 'السبت', bookings: 18, revenue: 380000, commission: 38000 },
      { day: 'الأحد', bookings: 24, revenue: 520000, commission: 52000 },
      { day: 'الإثنين', bookings: 19, revenue: 410000, commission: 41000 },
      { day: 'الثلاثاء', bookings: 27, revenue: 610000, commission: 61000 },
      { day: 'الأربعاء', bookings: 32, revenue: 740000, commission: 74000 },
      { day: 'الخميس', bookings: 45, revenue: 1050000, commission: 105000 },
      { day: 'الجمعة', bookings: 50, revenue: 1280000, commission: 128000 },
    ];

    const cityDistribution = state.cities.map((c) => ({
      name: c.nameAr,
      count: state.salons.filter((s) => s.city.toLowerCase() === c.id.toLowerCase()).length,
    }));

    const topServices = [
      { name: 'قص شعر ملكي', count: 85, revenue: 1275000 },
      { name: 'تشذيب اللحية بالبخار', count: 68, revenue: 544000 },
      { name: 'مكياج سهرة VIP', count: 42, revenue: 2520000 },
      { name: 'تنظيف بشرة هيدرافيشل', count: 35, revenue: 875000 },
      { name: 'صبغة بالياج فرنسي', count: 28, revenue: 2520000 },
    ];

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalSalons,
        activeSalons,
        pendingSalons,
        totalBookings,
        confirmedBookings,
        completedBookings,
        cancelledBookings,
        totalRevenue,
        platformCommission,
        cancellationRate,
        revenueTimeline,
        cityDistribution,
        topServices,
        commissionRate: state.settings.commissionRate,
      },
    });
  });

  // Maps config route
  app.get('/api/config/maps', (req: Request, res: Response) => {
    res.json({
      hasGoogleMapsKey: Boolean(process.env.GOOGLE_MAPS_API_KEY),
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ? 'CONFIGURED' : '',
    });
  });

  // ==========================================
  // DIRECT PROJECT ZIP DOWNLOAD ENDPOINTS
  // ==========================================
  const handleZipDownload = (req: Request, res: Response) => {
    const zipPath = path.join(process.cwd(), 'HALAQI-Android-Project.zip');
    const publicZipPath = path.join(process.cwd(), 'public', 'HALAQI-Android-Project.zip');
    const targetPath = fs.existsSync(zipPath) ? zipPath : publicZipPath;

    if (fs.existsSync(targetPath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="HALAQI-Android-Project.zip"');
      res.download(targetPath, 'HALAQI-Android-Project.zip');
    } else {
      res.status(404).json({ error: 'ملف المشروع غير موجود حالياً' });
    }
  };

  app.get('/api/download-project-zip', handleZipDownload);
  app.get('/HALAQI-Android-Project.zip', handleZipDownload);
  app.get('/download', handleZipDownload);

  // Vite development / production fallback
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  await loadUsersFromNeon();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HALAQI Server] Secure Multi-User Engine Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
