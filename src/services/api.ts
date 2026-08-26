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
  User,
  AuditLog,
  UserRole,
  SalonPost,
  PostComment,
} from '../types';

let currentAuthToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('halaqi_auth_token') : null;

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('halaqi_auth_token', token);
    } else {
      localStorage.removeItem('halaqi_auth_token');
    }
  }
}

export function getAuthToken(): string | null {
  if (!currentAuthToken && typeof window !== 'undefined') {
    currentAuthToken = localStorage.getItem('halaqi_auth_token');
  }
  return currentAuthToken;
}

// Internal authenticated fetch wrapper
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

export const api = {
  async uploadImage(dataUrl: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/uploads/image', {
        method: 'POST',
        body: JSON.stringify({ dataUrl }),
      });

      const data = await res.json();

      return {
        success: res.ok && data.success,
        imageUrl: data.imageUrl,
        error: data.error,
      };
    } catch (err) {
      console.error('API Error [uploadImage]:', err);
      return {
        success: false,
        error: 'تعذر رفع الصورة إلى الخادم',
      };
    }
  },


  // Salons
  async getSalons(params?: { type?: string; city?: string; query?: string; includePending?: boolean }): Promise<Salon[]> {
    try {
      const query = new URLSearchParams();
      if (params?.type) query.append('type', params.type);
      if (params?.city) query.append('city', params.city);
      if (params?.query) query.append('query', params.query);
      if (params?.includePending) query.append('includePending', 'true');

      const res = await fetchWithAuth(`/api/salons?${query.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch salons');
      const data = await res.json();
      return data.salons || [];
    } catch (err) {
      console.error('API Error [getSalons]:', err);
      return [];
    }
  },

  async getSalonById(id: string): Promise<{
    salon: Salon;
    services: Service[];
    barbers: Barber[];
    reviews: Review[];
  } | null> {
    try {
      const res = await fetchWithAuth(`/api/salons/${id}`);
      if (!res.ok) throw new Error('Failed to fetch salon');
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('API Error [getSalonById]:', err);
      return null;
    }
  },

  async createSalon(salonData: Partial<Salon>): Promise<Salon | null> {
    try {
      const res = await fetchWithAuth('/api/salons', {
        method: 'POST',
        body: JSON.stringify(salonData),
      });
      const data = await res.json();
      return data.salon || null;
    } catch (err) {
      console.error('API Error [createSalon]:', err);
      return null;
    }
  },

  async updateSalon(id: string, updates: Partial<Salon>): Promise<Salon | null> {
    try {
      const res = await fetchWithAuth(`/api/salons/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      return data.salon || null;
    } catch (err) {
      console.error('API Error [updateSalon]:', err);
      return null;
    }
  },

  async registerSalon(salonData: Partial<Salon>): Promise<{ success: boolean; salon?: Salon; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/salons', {
        method: 'POST',
        body: JSON.stringify(salonData),
      });
      const data = await res.json();
      return { success: res.ok, salon: data.salon, error: data.error };
    } catch (err) {
      console.error('API Error [registerSalon]:', err);
      return { success: false, error: 'تعذر تسجيل الصالون' };
    }
  },

  async approveSalon(salonId: string): Promise<boolean> {
    try {
      const res = await fetchWithAuth(`/api/admin/salons/${salonId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'approved', isVerified: true }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async updateSalonStatus(salonId: string, updates: Partial<Salon>): Promise<boolean> {
    try {
      const res = await fetchWithAuth(`/api/admin/salons/${salonId}/status`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async liftSalonSanction(salonId: string): Promise<boolean> {
    try {
      const res = await fetchWithAuth(`/api/admin/salons/${salonId}/lift-sanction`, {
        method: 'PUT',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Services
  async getServices(salonId?: string): Promise<Service[]> {
    try {
      const url = salonId ? `/api/services?salonId=${salonId}` : '/api/services';
      const res = await fetchWithAuth(url);
      const data = await res.json();
      return data.services || [];
    } catch (err) {
      console.error('API Error [getServices]:', err);
      return [];
    }
  },

  async createService(serviceData: Partial<Service>): Promise<Service | null> {
    try {
      const res = await fetchWithAuth('/api/services', {
        method: 'POST',
        body: JSON.stringify(serviceData),
      });
      const data = await res.json();
      return data.service || null;
    } catch (err) {
      console.error('API Error [createService]:', err);
      return null;
    }
  },

  async updateService(id: string, updates: Partial<Service>): Promise<Service | null> {
    try {
      const res = await fetchWithAuth(`/api/services/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      return data.service || null;
    } catch (err) {
      console.error('API Error [updateService]:', err);
      return null;
    }
  },

  async deleteService(id: string): Promise<boolean> {
    try {
      const res = await fetchWithAuth(`/api/services/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (err) {
      console.error('API Error [deleteService]:', err);
      return false;
    }
  },

  // Barbers
  async getBarbers(salonId?: string): Promise<Barber[]> {
    try {
      const url = salonId ? `/api/barbers?salonId=${salonId}` : '/api/barbers';
      const res = await fetchWithAuth(url);
      const data = await res.json();
      return data.barbers || [];
    } catch (err) {
      console.error('API Error [getBarbers]:', err);
      return [];
    }
  },

  async createBarber(barberData: Partial<Barber>): Promise<Barber | null> {
    try {
      const res = await fetchWithAuth('/api/barbers', {
        method: 'POST',
        body: JSON.stringify(barberData),
      });
      const data = await res.json();
      return data.barber || null;
    } catch (err) {
      console.error('API Error [createBarber]:', err);
      return null;
    }
  },

  async updateBarber(id: string, updates: Partial<Barber>): Promise<Barber | null> {
    try {
      const res = await fetchWithAuth(`/api/barbers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      return data.barber || null;
    } catch (err) {
      console.error('API Error [updateBarber]:', err);
      return null;
    }
  },

  async deleteBarber(id: string): Promise<boolean> {
    try {
      const res = await fetchWithAuth(`/api/barbers/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (err) {
      console.error('API Error [deleteBarber]:', err);
      return false;
    }
  },

  // Bookings
  async getBookings(params?: { customerId?: string; salonId?: string; status?: string }): Promise<Booking[]> {
    try {
      const query = new URLSearchParams();
      if (params?.customerId) query.append('customerId', params.customerId);
      if (params?.salonId) query.append('salonId', params.salonId);
      if (params?.status) query.append('status', params.status);

      const res = await fetchWithAuth(`/api/bookings?${query.toString()}`);
      const data = await res.json();
      return data.bookings || [];
    } catch (err) {
      console.error('API Error [getBookings]:', err);
      return [];
    }
  },

  async getOccupiedSlots(barberId: string, date: string): Promise<string[]> {
    try {
      const res = await fetchWithAuth(`/api/bookings/occupied-slots?barberId=${barberId}&date=${date}`);
      const data = await res.json();
      return data.occupiedSlots || [];
    } catch (err) {
      console.error('API Error [getOccupiedSlots]:', err);
      return [];
    }
  },

  async createBooking(bookingPayload: Record<string, unknown>): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(bookingPayload),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'حدث خطأ أثناء حجز الموعد' };
      }
      return { success: true, booking: data.booking };
    } catch (err) {
      console.error('API Error [createBooking]:', err);
      return { success: false, error: 'تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى.' };
    }
  },

  async updateBookingStatus(id: string, status: string): Promise<boolean> {
    try {
      const res = await fetchWithAuth(`/api/bookings/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      return res.ok;
    } catch (err) {
      console.error('API Error [updateBookingStatus]:', err);
      return false;
    }
  },

  async cancelBooking(id: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetchWithAuth(`/api/bookings/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      return { success: res.ok, error: data.error };
    } catch (err) {
      console.error('API Error [cancelBooking]:', err);
      return { success: false, error: 'فشل في إلغاء الحجز' };
    }
  },

  // Reviews
  async getReviews(salonId?: string): Promise<Review[]> {
    try {
      const url = salonId ? `/api/reviews?salonId=${salonId}` : '/api/reviews';
      const res = await fetchWithAuth(url);
      const data = await res.json();
      return data.reviews || [];
    } catch (err) {
      console.error('API Error [getReviews]:', err);
      return [];
    }
  },

  async submitReview(reviewPayload: {
    salonId: string;
    bookingId?: string;
    customerId?: string;
    customerName?: string;
    rating: number;
    comment: string;
  }): Promise<{ success: boolean; review?: Review; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/reviews', {
        method: 'POST',
        body: JSON.stringify(reviewPayload),
      });
      const data = await res.json();
      return { success: res.ok, review: data.review, error: data.error };
    } catch (err) {
      console.error('API Error [submitReview]:', err);
      return { success: false, error: 'تعذر إرسال التقييم' };
    }
  },

  // Coupons
  async getCoupons(): Promise<Coupon[]> {
    try {
      const res = await fetchWithAuth('/api/coupons');
      const data = await res.json();
      return data.coupons || [];
    } catch (err) {
      console.error('API Error [getCoupons]:', err);
      return [];
    }
  },

  async validateCoupon(code: string, amount: number): Promise<{ valid: boolean; coupon?: Coupon; discount?: number; message?: string }> {
    try {
      const res = await fetchWithAuth('/api/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code, amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { valid: false, message: data.error || 'الكوبون غير صالح' };
      }
      return { valid: true, coupon: data.coupon, discount: data.discount };
    } catch {
      return { valid: false, message: 'تعذر التحقق من الكوبون' };
    }
  },

  async createCoupon(couponData: Partial<Coupon>): Promise<Coupon | null> {
    try {
      const res = await fetchWithAuth('/api/coupons', {
        method: 'POST',
        body: JSON.stringify(couponData),
      });
      const data = await res.json();
      return data.coupon || null;
    } catch {
      return null;
    }
  },

  // Favorites
  async getFavorites(userId?: string): Promise<{ salons: Salon[]; salonIds: string[] }> {
    try {
      const url = userId ? `/api/favorites?userId=${userId}` : '/api/favorites';
      const res = await fetchWithAuth(url);
      const data = await res.json();
      return { salons: data.salons || [], salonIds: data.salonIds || [] };
    } catch (err) {
      console.error('API Error [getFavorites]:', err);
      return { salons: [], salonIds: [] };
    }
  },

  async toggleFavorite(arg1: string, arg2?: string): Promise<boolean> {
    try {
      const salonId = arg2 || arg1;
      const res = await fetchWithAuth('/api/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({ salonId }),
      });
      const data = await res.json();
      return data.isFavorite;
    } catch (err) {
      console.error('API Error [toggleFavorite]:', err);
      return false;
    }
  },

  // Notifications
  async getNotifications(userId?: string): Promise<Notification[]> {
    try {
      const url = userId ? `/api/notifications?userId=${userId}` : '/api/notifications';
      const res = await fetchWithAuth(url);
      const data = await res.json();
      return data.notifications || [];
    } catch (err) {
      console.error('API Error [getNotifications]:', err);
      return [];
    }
  },


  async markNotificationAsRead(id: string): Promise<boolean> {
    try {
      const res = await fetchWithAuth(`/api/notifications/${id}/read`, { method: 'PUT' });
      return res.ok;
    } catch (err) {
      console.error('API Error [markNotificationAsRead]:', err);
      return false;
    }
  },

  // Cities
  async getCities(): Promise<City[]> {
    try {
      const res = await fetchWithAuth('/api/cities');
      const data = await res.json();
      return data.cities || [];
    } catch (err) {
      console.error('API Error [getCities]:', err);
      return [];
    }
  },

  async addCity(cityData: Partial<City>): Promise<City | null> {
    try {
      const res = await fetchWithAuth('/api/cities', {
        method: 'POST',
        body: JSON.stringify(cityData),
      });
      const data = await res.json();
      return data.city;
    } catch (err) {
      console.error('API Error [addCity]:', err);
      return null;
    }
  },

  // Admin & Security Management
  async getAuditLogs(): Promise<AuditLog[]> {
    try {
      const res = await fetchWithAuth('/api/admin/audit-logs');
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      return data.auditLogs || [];
    } catch (err) {
      console.error('API Error [getAuditLogs]:', err);
      return [];
    }
  },

  async getAdminUsers(): Promise<User[]> {
    try {
      const res = await fetchWithAuth('/api/admin/users');
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      return data.users || [];
    } catch (err) {
      console.error('API Error [getAdminUsers]:', err);
      return [];
    }
  },

  async updateUserRole(userId: string, role: UserRole): Promise<boolean> {
    try {
      const res = await fetchWithAuth(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async toggleUserBan(userId: string): Promise<{ success: boolean; isBanned?: boolean }> {
    try {
      const res = await fetchWithAuth(`/api/admin/users/${userId}/ban`, {
        method: 'PUT',
      });
      const data = await res.json();
      return { success: res.ok, isBanned: data.isBanned };
    } catch {
      return { success: false };
    }
  },

  async deleteUser(userId: string): Promise<boolean> {
    try {
      const res = await fetchWithAuth(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getAdminStats(): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetchWithAuth('/api/admin/stats');
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      return data.stats || null;
    } catch (err) {
      console.error('API Error [getAdminStats]:', err);
      return null;
    }
  },

  async getPlatformSettings(): Promise<PlatformSettings | null> {
    try {
      const res = await fetchWithAuth('/api/admin/settings');
      const data = await res.json();
      return data.settings || null;
    } catch (err) {
      console.error('API Error [getPlatformSettings]:', err);
      return null;
    }
  },

  async updatePlatformSettings(settings: Partial<PlatformSettings>): Promise<PlatformSettings | null> {
    try {
      const res = await fetchWithAuth('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      return data.settings || null;
    } catch (err) {
      console.error('API Error [updatePlatformSettings]:', err);
      return null;
    }
  },

  // Auth
  async login(emailOrPhone: string, role?: string, password?: string): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone, role, password }),
      });
      const data = await res.json();
      if (data.token) {
        setAuthToken(data.token);
      }
      return data;
    } catch {
      return { success: false, error: 'تعذر الاتصال بالخادم لتسجيل الدخول' };
    }
  },

  async register(userData: { name: string; email?: string; phone: string; password?: string; role?: string; city?: string }): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      const data = await res.json();
      if (data.token) {
        setAuthToken(data.token);
      }
      return data;
    } catch {
      return { success: false, error: 'تعذر إنشاء الحساب' };
    }
  },

  async getMe(): Promise<{ success: boolean; user?: User }> {
    try {
      const res = await fetchWithAuth('/api/auth/me');
      if (!res.ok) return { success: false };
      const data = await res.json();
      return { success: true, user: data.user };
    } catch {
      return { success: false };
    }
  },

  // Salon Posts
  async getSalonPosts(salonId: string): Promise<SalonPost[]> {
    try {
      const res = await fetchWithAuth(`/api/salon-posts?salonId=${encodeURIComponent(salonId)}`);
      const data = await res.json();
      return data.posts || [];
    } catch (err) {
      console.error('API Error [getSalonPosts]:', err);
      return [];
    }
  },

  async createSalonPost(payload: {
    salonId: string;
    imageUrl: string;
    caption: string;
  }): Promise<{ success: boolean; post?: SalonPost; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/salon-posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      return {
        success: res.ok && data.success,
        post: data.post,
        error: data.error,
      };
    } catch (err) {
      console.error('API Error [createSalonPost]:', err);
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم',
      };
    }
  },

  async deleteSalonPost(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetchWithAuth(`/api/salon-posts/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      return {
        success: res.ok && data.success,
        error: data.error,
      };
    } catch (err) {
      console.error('API Error [deleteSalonPost]:', err);
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم',
      };
    }
  },

  async togglePostLike(id: string): Promise<{
    success: boolean;
    liked?: boolean;
    likeCount?: number;
    error?: string;
  }> {
    try {
      const res = await fetchWithAuth(`/api/salon-posts/${id}/like`, {
        method: 'POST',
      });

      const data = await res.json();

      return {
        success: res.ok && data.success,
        liked: data.liked,
        likeCount: data.likeCount,
        error: data.error,
      };
    } catch (err) {
      console.error('API Error [togglePostLike]:', err);
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم',
      };
    }
  },

  async getPostLikeStatus(id: string): Promise<{
    success: boolean;
    liked?: boolean;
    likeCount?: number;
  }> {
    try {
      const res = await fetchWithAuth(`/api/salon-posts/${id}/like`);
      const data = await res.json();

      return {
        success: res.ok && data.success,
        liked: data.liked,
        likeCount: data.likeCount,
      };
    } catch (err) {
      console.error('API Error [getPostLikeStatus]:', err);
      return {
        success: false,
      };
    }
  },

  async getPostComments(id: string): Promise<PostComment[]> {
    try {
      const res = await fetchWithAuth(`/api/salon-posts/${id}/comments`);
      const data = await res.json();
      return data.comments || [];
    } catch (err) {
      console.error('API Error [getPostComments]:', err);
      return [];
    }
  },

  async addPostComment(
    id: string,
    comment: string
  ): Promise<{ success: boolean; comment?: PostComment; error?: string }> {
    try {
      const res = await fetchWithAuth(`/api/salon-posts/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ comment }),
      });

      const data = await res.json();

      return {
        success: res.ok && data.success,
        comment: data.comment,
        error: data.error,
      };
    } catch (err) {
      console.error('API Error [addPostComment]:', err);
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم',
      };
    }
  },

  async deletePostComment(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetchWithAuth(`/api/salon-posts/comments/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      return {
        success: res.ok && data.success,
        error: data.error,
      };
    } catch (err) {
      console.error('API Error [deletePostComment]:', err);
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم',
      };
    }
  },

};
