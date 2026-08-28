import { notify } from '../utils/notifications';
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
  UserPost,
  Message,
  Conversation,
  MessageMediaMetadata
} from '../types';

const API_BASE =
  typeof window !== 'undefined'
    ? window.location.origin
    : ((import.meta as any).env?.VITE_API_URL || '');

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

  const token =
    currentAuthToken ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('halaqi_auth_token')
      : null);

  if (token) {
    currentAuthToken = token;
    headers.set('Authorization', `Bearer ${token}`);
  }

  console.log('[AUTH REQUEST DEBUG]', {
    url,
    method: options.method || 'GET',
    hasToken: !!token,
    tokenLength: token?.length || 0,
    authorizationHeader: headers.get('Authorization') ? 'PRESENT' : 'MISSING',
  });

  const fullUrl =
    url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `${API_BASE}${url}`;

  console.log('[API REQUEST]', {
    url: fullUrl,
    method: options.method || 'GET',
  });

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    console.error('[AUTH 401]', {
      url,
      hasToken: !!token,
      tokenLength: token?.length || 0,
    });
  }

  return response;
}

export const api = {

  async search(query: string): Promise<{ salons: any[]; users: any[] }> {
    try {
      const q = query.trim();

      if (!q) {
        return { salons: [], users: [] };
      }

      const res = await fetchWithAuth(
        `/api/search?q=${encodeURIComponent(q)}&_=${Date.now()}`,
        {
          cache: 'no-store',
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error('[SEARCH API]', data);
        return { salons: [], users: [] };
      }

      return {
        salons: Array.isArray(data.salons) ? data.salons : [],
        users: Array.isArray(data.users) ? data.users : [],
      };
    } catch (error) {
      console.error('[SEARCH ERROR]', error);
      return { salons: [], users: [] };
    }
  },


  async getUserPosts(userId: string): Promise<{
    success: boolean;
    posts?: UserPost[];
    error?: string;
  }> {
    try {
      const res = await fetchWithAuth(
        `/api/users/${encodeURIComponent(userId)}/posts`
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error('[USER POSTS API]', data);
        return {
          success: false,
          posts: [],
          error: data?.error || 'تعذر تحميل منشورات المستخدم.',
        };
      }

      return {
        success: true,
        posts: Array.isArray(data.posts) ? data.posts : [],
      };
    } catch (error) {
      console.error('[USER POSTS ERROR]', error);
      return {
        success: false,
        posts: [],
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },


  async getUserPostById(
    postId: string
  ): Promise<{ success: boolean; post?: UserPost; error?: string }> {
    try {
      const res = await fetchWithAuth(
        `/api/user-posts/${encodeURIComponent(postId)}`
      );

      return await res.json();
    } catch (err) {
      console.error('API Error [getUserPostById]:', err);
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },

  async getUserPostsFeed(): Promise<{ success: boolean; posts?: UserPost[]; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/user-posts/feed');

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return {
          success: false,
          error: body.error || 'تعذر جلب منشورات المستخدمين.',
        };
      }

      return await res.json();
    } catch (err) {
      console.error('API Error [getUserPostsFeed]:', err);
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },

  // ============================================================
  // UNIFIED POSTS API
  // salon_posts + user_posts
  // ============================================================

  async getUnifiedPostsFeed(): Promise<{
    success: boolean;
    posts?: any[];
    error?: string;
  }> {
    try {
      const res = await fetchWithAuth('/api/posts/feed');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          success: false,
          posts: [],
          error: data?.error || 'تعذر جلب المنشورات.',
        };
      }

      return {
        success: true,
        posts: Array.isArray(data.posts) ? data.posts : [],
      };
    } catch (error) {
      console.error('[getUnifiedPostsFeed]', error);
      return {
        success: false,
        posts: [],
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },

  async toggleUnifiedPostLike(
    postId: string,
    postType: 'salon' | 'user'
  ): Promise<{
    success: boolean;
    liked?: boolean;
    likeCount?: number;
    error?: string;
  }> {
    try {
      const base =
        postType === 'user'
          ? '/api/user-posts'
          : '/api/salon-posts';

      const res = await fetchWithAuth(
        `${base}/${encodeURIComponent(postId)}/like`,
        { method: 'POST' }
      );

      const data = await res.json().catch(() => ({}));

      return {
        success: res.ok && data.success,
        liked: data.liked,
        likeCount: data.likeCount,
        error: data.error,
      };
    } catch (error) {
      console.error('[toggleUnifiedPostLike]', error);
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },

  async getUnifiedPostLikeStatus(
    postId: string,
    postType: 'salon' | 'user'
  ): Promise<{
    success: boolean;
    liked?: boolean;
    likeCount?: number;
    error?: string;
  }> {
    try {
      const base =
        postType === 'user'
          ? '/api/user-posts'
          : '/api/salon-posts';

      const res = await fetchWithAuth(
        `${base}/${encodeURIComponent(postId)}/like`
      );

      const data = await res.json().catch(() => ({}));

      return {
        success: res.ok && data.success,
        liked: data.liked,
        likeCount: data.likeCount,
        error: data.error,
      };
    } catch (error) {
      console.error('[getUnifiedPostLikeStatus]', error);
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },

  async getUnifiedPostComments(
    postId: string,
    postType: 'salon' | 'user',
    userId?: string
  ): Promise<PostComment[]> {
    try {
      const base =
        postType === 'user'
          ? '/api/user-posts'
          : '/api/salon-posts';

      const url =
        userId
          ? `${base}/${encodeURIComponent(postId)}/comments?userId=${encodeURIComponent(userId)}`
          : `${base}/${encodeURIComponent(postId)}/comments`;

      const res = await fetchWithAuth(url);

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error('[getUnifiedPostComments]', data);
        return [];
      }

      return Array.isArray(data.comments) ? data.comments : [];
    } catch (error) {
      console.error('[getUnifiedPostComments]', error);
      return [];
    }
  },

  async addUnifiedPostComment(
    postId: string,
    postType: 'salon' | 'user',
    comment: string
  ): Promise<{
    success: boolean;
    comment?: PostComment;
    error?: string;
  }> {
    try {
      const base =
        postType === 'user'
          ? '/api/user-posts'
          : '/api/salon-posts';

      const res = await fetchWithAuth(
        `${base}/${encodeURIComponent(postId)}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({ comment }),
        }
      );

      const data = await res.json().catch(() => ({}));

      return {
        success: res.ok && data.success,
        comment: data.comment,
        error: data.error,
      };
    } catch (error) {
      console.error('[addUnifiedPostComment]', error);
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },

  async reactToComment(
    commentId: string,
    reaction: 'like' | 'dislike' | null
  ): Promise<{
    success: boolean;
    likes?: number;
    dislikes?: number;
    myReaction?: 'like' | 'dislike' | null;
    error?: string;
  }> {
    try {
      const res = await fetchWithAuth(
        `/api/post-comments/${encodeURIComponent(commentId)}/react`,
        {
          method: 'POST',
          body: JSON.stringify({ reaction }),
        }
      );

      const data = await res.json().catch(() => ({}));

      return {
        success: res.ok && data.success,
        likes: data.likes,
        dislikes: data.dislikes,
        myReaction: data.myReaction,
        error: data.error,
      };
    } catch (error) {
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },

  /*
   * جلب منشور واحد مباشرة (مستخدم أو صالون) مع postType
   * حتى يتم توجيه اللايكات والتعليقات للـendpoint الصحيح.
   */
  async getUnifiedPostById(
    postId: string
  ): Promise<{ success: boolean; post?: any; error?: string }> {
    try {
      const res = await fetchWithAuth(
        `/api/posts/${encodeURIComponent(postId)}`
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          success: false,
          error: data?.error || 'تعذر جلب المنشور.',
        };
      }

      return {
        success: true,
        post: data.post,
      };
    } catch (error) {
      console.error('[getUnifiedPostById]', error);
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },

  async createUserPost(data: {
    imageUrl: string;
    caption?: string;
  }): Promise<{
    success: boolean;
    post?: any;
    error?: string;
  }> {
    try {
      const res = await fetchWithAuth('/api/user-posts', {
        method: 'POST',
        body: JSON.stringify({
          imageUrl: data.imageUrl,
          caption: data.caption || '',
        }),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok || !result.success) {
        console.error('[CREATE USER POST API]', result);
        return {
          success: false,
          error: result?.error || 'تعذر حفظ المنشور في قاعدة البيانات.',
        };
      }

      return {
        success: true,
        post: result.post,
      };
    } catch (error) {
      console.error('[CREATE USER POST ERROR]', error);

      return {
        success: false,
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },

  async suggestCaption(context?: string): Promise<{
    success: boolean;
    caption?: string;
    error?: string;
  }> {
    try {
      const res = await fetchWithAuth('/api/ai/suggest-caption', {
        method: 'POST',
        body: JSON.stringify({ context: context || '' }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'تعذر اقتراح تعليق.',
        };
      }

      return { success: true, caption: data.caption };
    } catch (err) {
      console.error('[SUGGEST CAPTION API]', err);
      return { success: false, error: 'تعذر اقتراح تعليق.' };
    }
  },

  async updateMyProfile(data: {
    name: string;
    phone?: string;
    city?: string;
  }): Promise<{
    success: boolean;
    user?: any;
    error?: string;
  }> {
    try {
      const res = await fetchWithAuth('/api/auth/me/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          success: false,
          error: result?.error || 'تعذر تحديث الملف الشخصي.',
        };
      }

      return {
        success: true,
        user: result?.user,
      };
    } catch (error) {
      console.error('[UPDATE PROFILE API ERROR]', error);

      return {
        success: false,
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },

  async getPublicUserProfile(userId: string): Promise<{
    success: boolean;
    user?: {
      id: string;
      name: string;
      avatar?: string | null;
      city?: string | null;
      role: User['role'];
      createdAt: string;
    };
    salon?: any;
    error?: string;
  }> {
    try {
      const res = await fetchWithAuth(
        `/api/users/${encodeURIComponent(userId)}/public`
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error('[PUBLIC PROFILE API]', data);

        return {
          success: false,
          error: data?.error || 'تعذر تحميل الملف الشخصي.',
        };
      }

      return {
        success: true,
        user: data.user,
        salon: data.salon || null,
      };
    } catch (error) {
      console.error('[PUBLIC PROFILE ERROR]', error);

      return {
        success: false,
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },


  async getFollowStatus(userId: string): Promise<{
    success: boolean;
    isFollowing?: boolean;
    followersCount?: number;
    followingCount?: number;
    error?: string;
  }> {
    try {
      const res = await fetchWithAuth(
        `/api/users/${encodeURIComponent(userId)}/follow-status`
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error('[FOLLOW STATUS API]', data);
        return {
          success: false,
          error: data?.error || 'تعذر تحميل معلومات المتابعة.',
        };
      }

      return {
        success: true,
        isFollowing: Boolean(data.isFollowing),
        followersCount: Number(data.followersCount || 0),
        followingCount: Number(data.followingCount || 0),
      };
    } catch (error) {
      console.error('[FOLLOW STATUS ERROR]', error);

      return {
        success: false,
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },

  async getFollowers(userId: string): Promise<{ success: boolean; users?: any[]; error?: string }> {
    try {
      const res = await fetchWithAuth(`/api/users/${encodeURIComponent(userId)}/followers`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data?.error || 'تعذر تحميل المتابعين.' };
      }
      return { success: true, users: Array.isArray(data.users) ? data.users : [] };
    } catch (error) {
      console.error('[GET FOLLOWERS ERROR]', error);
      return { success: false, error: 'تعذر الاتصال بالخادم.' };
    }
  },

  async getFollowing(userId: string): Promise<{ success: boolean; users?: any[]; error?: string }> {
    try {
      const res = await fetchWithAuth(`/api/users/${encodeURIComponent(userId)}/following`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data?.error || 'تعذر تحميل الحسابات المتابَعة.' };
      }
      return { success: true, users: Array.isArray(data.users) ? data.users : [] };
    } catch (error) {
      console.error('[GET FOLLOWING ERROR]', error);
      return { success: false, error: 'تعذر الاتصال بالخادم.' };
    }
  },

  async toggleFollow(userId: string): Promise<{
    success: boolean;
    isFollowing?: boolean;
    followersCount?: number;
    followingCount?: number;
    error?: string;
  }> {
    try {
      const res = await fetchWithAuth(
        `/api/users/${encodeURIComponent(userId)}/follow-toggle`,
        {
          method: 'POST',
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error('[FOLLOW TOGGLE API]', data);
        return {
          success: false,
          error: data?.error || 'تعذر تحديث المتابعة.',
        };
      }

      return {
        success: true,
        isFollowing: Boolean(data.isFollowing),
        followersCount: Number(data.followersCount || 0),
        followingCount: Number(data.followingCount || 0),
      };
    } catch (error) {
      console.error('[FOLLOW TOGGLE ERROR]', error);

      return {
        success: false,
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },

  async refreshToken(): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/auth/refresh', {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok && data.success && data.token) {
        setAuthToken(data.token);

        return {
          success: true,
          user: data.user,
          token: data.token,
        };
      }

      return {
        success: false,
        error: data.error || 'تعذر تجديد جلسة تسجيل الدخول',
      };
    } catch (err) {
      console.error('API Error [refreshToken]:', err);

      return {
        success: false,
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },

  async editUnifiedPostComment(
    commentId: string,
    comment: string
  ): Promise<{
    success: boolean;
    blocked?: boolean;
    comment?: PostComment;
    error?: string;
  }> {
    try {
      const res = await fetchWithAuth(
        `/api/post-comments/${encodeURIComponent(commentId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ comment }),
        }
      );

      const data = await res.json().catch(() => ({}));

      return {
        success: res.ok && data.success,
        blocked: data.blocked,
        comment: data.comment,
        error: data.error,
      };
    } catch (error) {
      console.error('[editUnifiedPostComment]', error);

      return {
        success: false,
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },

  async deleteUnifiedPostComment(
    commentId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetchWithAuth(
        `/api/post-comments/${encodeURIComponent(commentId)}`,
        {
          method: 'DELETE',
        }
      );

      const data = await res.json().catch(() => ({}));

      return {
        success: res.ok && data.success,
        error: data.error,
      };
    } catch (error) {
      console.error('[deleteUnifiedPostComment]', error);

      return {
        success: false,
        error: 'تعذر الاتصال بالخادم.',
      };
    }
  },



  async updateMyAvatar(imageUrl: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/auth/me/avatar', {
        method: 'PUT',
        body: JSON.stringify({ imageUrl }),
      });

      const data = await res.json();

      return {
        success: res.ok && data.success,
        user: data.user,
        error: data.error,
      };
    } catch (err) {
      console.error('API Error [updateMyAvatar]:', err);
      return {
        success: false,
        error: 'تعذر حفظ الصورة الشخصية',
      };
    }
  },

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
      console.log('[SALON AUTH CHECK]', {
        hasToken: !!getAuthToken(),
        tokenLength: getAuthToken()?.length || 0,
        user: typeof window !== 'undefined' ? localStorage.getItem('halaqi_user') : null
      });

      const res = await fetchWithAuth('/api/salons', {
        method: 'POST',
        body: JSON.stringify(salonData),
      });
      const data = await res.json();
      console.log('[REGISTER SALON]', {
        status: res.status,
        ok: res.ok,
        data,
        hasToken: !!getAuthToken()
      });
      return { success: res.ok && data.success !== false, salon: data.salon, error: data.error };
    } catch (err) {
      console.error('API Error [registerSalon]:', err);
      return { success: false, error: 'تعذر تسجيل الصالون' };
    }
  },

  async rejectSalon(salonId: string): Promise<boolean> {
    try {
      const res = await fetchWithAuth(`/api/admin/salons/${salonId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'rejected' }),
      });
      return res.ok;
    } catch {
      return false;
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

      const data = await res.json().catch(() => ({}));

      console.log('[SALON STATUS UPDATE]', {
        salonId,
        updates,
        status: res.status,
        ok: res.ok,
        data,
      });

      if (!res.ok && typeof window !== 'undefined') {
        notify(
          data?.error ||
          `فشل تحديث حالة الصالون. HTTP ${res.status}`
        );
      }

      return res.ok && data?.success !== false;
    } catch (error) {
      console.error('[SALON STATUS UPDATE ERROR]', error);
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

  async createService(serviceData: Partial<Service>): Promise<Service> {
    const res = await fetchWithAuth('/api/services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
    const data = await res.json();
    if (!res.ok || !data.service) {
      throw new Error(data.error || 'فشل إضافة الخدمة');
    }
    return data.service;
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

  async completeBookingByQr(
    bookingId: string,
    qrNonce: string
  ): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    try {
      const res = await fetchWithAuth(
        `/api/bookings/${bookingId}/complete-by-qr`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ qrNonce }),
        }
      );

      const data = await res.json();

      return {
        success: Boolean(res.ok && data.success),
        booking: data.booking,
        error: data.error,
      };
    } catch (err) {
      console.error('API Error [completeBookingByQr]:', err);
      return {
        success: false,
        error: 'تعذر إكمال الخدمة عبر QR.',
      };
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

  // Messaging / Direct Chat
  async getConversations(): Promise<Conversation[]> {
    try {
      const res = await fetchWithAuth('/api/messages/conversations');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('[GET CONVERSATIONS]', data);
        return [];
      }
      return data.conversations || [];
    } catch (err) {
      console.error('API Error [getConversations]:', err);
      return [];
    }
  },

  async getMessages(
    userId: string,
    before?: string
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    try {
      const qs = before ? `?before=${encodeURIComponent(before)}` : '';
      const res = await fetchWithAuth(`/api/messages/${userId}${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { messages: [], hasMore: false };
      }
      return {
        messages: data.messages || [],
        hasMore: Boolean(data.hasMore),
      };
    } catch (err) {
      console.error('API Error [getMessages]:', err);
      return { messages: [], hasMore: false };
    }
  },

  async uploadMessageMedia(payload: {
    kind: 'image' | 'audio';
    original: string;
    thumbnail?: string;
  }): Promise<{ success: boolean; url?: string; thumbnailUrl?: string; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/messages/media', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'فشل رفع الوسائط.' };
      }
      return { success: true, url: data.url, thumbnailUrl: data.thumbnailUrl };
    } catch (err) {
      console.error('API Error [uploadMessageMedia]:', err);
      return { success: false, error: 'تعذر الاتصال بالخادم.' };
    }
  },

  async sendMessage(
    recipientId: string,
    body: string,
    media?: {
      type: 'image' | 'audio';
      url: string;
      thumbnail?: string;
      metadata?: MessageMediaMetadata;
    }
  ): Promise<{ success: boolean; message?: Message; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          recipientId,
          body,
          type: media?.type ?? 'text',
          mediaUrl: media?.url,
          thumbnail: media?.thumbnail,
          metadata: media?.metadata,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'فشل إرسال الرسالة' };
      }
      return { success: true, message: data.message };
    } catch (err) {
      console.error('API Error [sendMessage]:', err);
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى.',
      };
    }
  },

  async markMessagesRead(userId: string): Promise<boolean> {
    try {
      const res = await fetchWithAuth(`/api/messages/${userId}/read`, {
        method: 'POST',
      });
      return res.ok;
    } catch (err) {
      console.error('API Error [markMessagesRead]:', err);
      return false;
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

  async getAdminBots(): Promise<{
    success: boolean;
    enabled: boolean;
    total: number;
    active: number;
    stopped: number;
  }> {
    try {
      const res = await fetchWithAuth('/api/admin/bots');
      if (!res.ok) throw new Error('Unauthorized');
      return await res.json();
    } catch (err) {
      console.error('API Error [getAdminBots]:', err);
      return { success: false, enabled: false, total: 0, active: 0, stopped: 0 };
    }
  },

  async startAllBots(): Promise<{
    success: boolean;
    total: number;
    active: number;
    stopped: number;
  }> {
    try {
      const res = await fetchWithAuth('/api/admin/bots/start', { method: 'POST' });
      if (!res.ok) throw new Error('Unauthorized');
      return await res.json();
    } catch (err) {
      console.error('API Error [startAllBots]:', err);
      return { success: false, total: 0, active: 0, stopped: 0 };
    }
  },

  async stopAllBots(): Promise<{
    success: boolean;
    total: number;
    active: number;
    stopped: number;
  }> {
    try {
      const res = await fetchWithAuth('/api/admin/bots/stop', { method: 'POST' });
      if (!res.ok) throw new Error('Unauthorized');
      return await res.json();
    } catch (err) {
      console.error('API Error [stopAllBots]:', err);
      return { success: false, total: 0, active: 0, stopped: 0 };
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

  async getAdminSettlements(params?: {
    year?: number;
    month?: number;
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<any> {
    try {
      const query = new URLSearchParams();

      if (params?.year != null) {
        query.set('year', String(params.year));
      }

      if (params?.month != null) {
        query.set('month', String(params.month));
      }

      if (params?.search) {
        query.set('search', params.search);
      }

      if (params?.status) {
        query.set('status', params.status);
      }

      if (params?.page != null) {
        query.set('page', String(params.page));
      }

      if (params?.pageSize != null) {
        query.set('pageSize', String(params.pageSize));
      }

      const res = await fetchWithAuth(
        `/api/admin/settlements?${query.toString()}`
      );

      return await res.json();
    } catch (err) {
      console.error('API Error [getAdminSettlements]:', err);

      return {
        success: false,
        items: [],
        total: 0,
        page: params?.page || 1,
        pageSize: params?.pageSize || 50,
        error: 'تعذر تحميل التسويات.',
      };
    }
  },

  async generateAdminSettlements(
    year: number,
    month: number
  ): Promise<any> {
    try {
      const res = await fetchWithAuth(
        '/api/admin/settlements/generate',
        {
          method: 'POST',
          body: JSON.stringify({ year, month }),
        }
      );

      return await res.json();
    } catch (err) {
      console.error(
        'API Error [generateAdminSettlements]:',
        err
      );

      return {
        success: false,
        error: 'تعذر توليد التسويات.',
      };
    }
  },

  async markAdminSettlementPaid(
    settlementId: string,
    paidAmount: number,
    notes?: string
  ): Promise<any> {
    try {
      const res = await fetchWithAuth(
        `/api/admin/settlements/${settlementId}/paid`,
        {
          method: 'PUT',
          body: JSON.stringify({
            paidAmount,
            notes,
          }),
        }
      );

      return await res.json();
    } catch (err) {
      console.error(
        'API Error [markAdminSettlementPaid]:',
        err
      );

      return {
        success: false,
        error: 'تعذر تسجيل الدفع.',
      };
    }
  },

  async processAdminSettlementEnforcement(): Promise<any> {
    try {
      const res = await fetchWithAuth(
        '/api/admin/settlements/process-overdue',
        {
          method: 'POST',
        }
      );

      return await res.json();
    } catch (err) {
      console.error(
        'API Error [processAdminSettlementEnforcement]:',
        err
      );

      return {
        success: false,
        markedOverdue: 0,
        suspended: 0,
        error: 'تعذر معالجة المستحقات المتأخرة.',
      };
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
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone, role, password }),
      });
      const data = await res.json();
      if (data.token) {
        setAuthToken(data.token);
      }
      return data;
    } catch (err) {
      console.error('[LOGIN FETCH ERROR]', err);

      return {
        success: false,
        error: `خطأ الاتصال: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  },

  async register(userData: { name: string; email?: string; phone: string; password?: string; role?: string; city?: string }): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
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

  async getMe(): Promise<{ success: boolean; user?: User; status?: number }> {
    try {
      const res = await fetchWithAuth('/api/auth/me', {
        cache: 'no-store',
      });
      if (!res.ok) return { success: false, status: res.status };
      const data = await res.json();
      return { success: true, user: data.user, status: res.status };
    } catch {
      return { success: false, status: 0 };
    }
  },

  async getMySalon(): Promise<{ success: boolean; salon?: Salon | null; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/salons/mine');
      const data = await res.json();
      return {
        success: res.ok && data.success !== false,
        salon: data.salon ?? null,
        error: data.error,
      };
    } catch (err) {
      console.error('API Error [getMySalon]:', err);
      return {
        success: false,
        salon: null,
        error: 'تعذر التحقق من طلب الصالون',
      };
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

  async toggleUserPostLike(id: string): Promise<{
    success: boolean;
    liked?: boolean;
    likeCount?: number;
    error?: string;
  }> {
    try {
      const res = await fetchWithAuth(`/api/user-posts/${id}/like`, {
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
      console.error('API Error [toggleUserPostLike]:', err);
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم',
      };
    }
  },

  async getUserPostLikeStatus(id: string): Promise<{
    success: boolean;
    liked?: boolean;
    likeCount?: number;
    error?: string;
  }> {
    try {
      const res = await fetchWithAuth(`/api/user-posts/${id}/like`);

      const data = await res.json();

      return {
        success: res.ok && data.success,
        liked: data.liked,
        likeCount: data.likeCount,
        error: data.error,
      };
    } catch (err) {
      console.error('API Error [getUserPostLikeStatus]:', err);
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم',
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

  /* ===================== DISCOVER ===================== */

  async getMyInterests(): Promise<{ success: boolean; interests: string[] }> {
    try {
      const res = await fetchWithAuth('/api/discover/interests');
      const data = await res.json().catch(() => ({}));
      return {
        success: res.ok && data.success !== false,
        interests: Array.isArray(data.interests) ? data.interests : [],
      };
    } catch (err) {
      console.error('API Error [getMyInterests]:', err);
      return { success: false, interests: [] };
    }
  },

  async setMyInterests(interests: string[]): Promise<{ success: boolean; interests: string[]; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/discover/interests', {
        method: 'PUT',
        body: JSON.stringify({ interests }),
      });
      const data = await res.json().catch(() => ({}));
      return {
        success: res.ok && data.success,
        interests: Array.isArray(data.interests) ? data.interests : [],
        error: data.error,
      };
    } catch (err) {
      console.error('API Error [setMyInterests]:', err);
      return { success: false, interests: [], error: 'تعذر الاتصال بالخادم' };
    }
  },

  async getDiscoverRecommendations(limit = 20): Promise<{ success: boolean; users: any[]; error?: string }> {
    try {
      const res = await fetchWithAuth(`/api/discover/recommendations?limit=${limit}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      return {
        success: res.ok && data.success,
        users: Array.isArray(data.users) ? data.users : [],
        error: data.error,
      };
    } catch (err) {
      console.error('API Error [getDiscoverRecommendations]:', err);
      return { success: false, users: [], error: 'تعذر الاتصال بالخادم' };
    }
  },

  async sendConnectionRequest(userId: string): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/discover/connect', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok && data.success, status: data.status, error: data.error };
    } catch (err) {
      console.error('API Error [sendConnectionRequest]:', err);
      return { success: false, error: 'تعذر الاتصال بالخادم' };
    }
  },

  async acceptConnectionRequest(id: string): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const res = await fetchWithAuth(`/api/discover/connections/${encodeURIComponent(id)}/accept`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok && data.success, status: data.status, error: data.error };
    } catch (err) {
      console.error('API Error [acceptConnectionRequest]:', err);
      return { success: false, error: 'تعذر الاتصال بالخادم' };
    }
  },

  async declineConnectionRequest(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetchWithAuth(`/api/discover/connections/${encodeURIComponent(id)}/decline`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok && data.success, error: data.error };
    } catch (err) {
      console.error('API Error [declineConnectionRequest]:', err);
      return { success: false, error: 'تعذر الاتصال بالخادم' };
    }
  },

  async getConnectionRequests(): Promise<{ success: boolean; requests: any[]; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/discover/connections/requests', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      return {
        success: res.ok && data.success,
        requests: Array.isArray(data.requests) ? data.requests : [],
        error: data.error,
      };
    } catch (err) {
      console.error('API Error [getConnectionRequests]:', err);
      return { success: false, requests: [], error: 'تعذر الاتصال بالخادم' };
    }
  },

  async blockUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/discover/block', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok && data.success, error: data.error };
    } catch (err) {
      console.error('API Error [blockUser]:', err);
      return { success: false, error: 'تعذر الاتصال بالخادم' };
    }
  },

  async getBlockStatus(
    userId: string
  ): Promise<{ success: boolean; isBlocking?: boolean; isBlockedBy?: boolean; error?: string }> {
    try {
      const res = await fetchWithAuth(`/api/users/${encodeURIComponent(userId)}/block-status`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data?.error || 'تعذر تحميل حالة الحظر.' };
      }
      return {
        success: true,
        isBlocking: Boolean(data.isBlocking),
        isBlockedBy: Boolean(data.isBlockedBy),
      };
    } catch (err) {
      console.error('API Error [getBlockStatus]:', err);
      return { success: false, error: 'تعذر الاتصال بالخادم' };
    }
  },

  async unblockUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetchWithAuth(`/api/discover/block/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok && data.success, error: data.error };
    } catch (err) {
      console.error('API Error [unblockUser]:', err);
      return { success: false, error: 'تعذر الاتصال بالخادم' };
    }
  },

  async reportUser(userId: string, reason: string, details?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/discover/report', {
        method: 'POST',
        body: JSON.stringify({ userId, reason, details }),
      });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok && data.success, error: data.error };
    } catch (err) {
      console.error('API Error [reportUser]:', err);
      return { success: false, error: 'تعذر الاتصال بالخادم' };
    }
  },

  async getDiscoverConnections(): Promise<{ success: boolean; connections: any[]; error?: string }> {
    try {
      const res = await fetchWithAuth('/api/discover/connections', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      return {
        success: res.ok && data.success,
        connections: Array.isArray(data.connections) ? data.connections : [],
        error: data.error,
      };
    } catch (err) {
      console.error('API Error [getDiscoverConnections]:', err);
      return { success: false, connections: [], error: 'تعذر الاتصال بالخادم' };
    }
  },

  async getDiscoverConversation(convId: string): Promise<{ success: boolean; messages: any[]; meta?: any; error?: string }> {
    try {
      const res = await fetchWithAuth(`/api/discover/conversation/${encodeURIComponent(convId)}/messages`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      return {
        success: res.ok && data.success,
        messages: Array.isArray(data.messages) ? data.messages : [],
        meta: data.meta,
        error: data.error,
      };
    } catch (err) {
      console.error('API Error [getDiscoverConversation]:', err);
      return { success: false, messages: [], error: 'تعذر الاتصال بالخادم' };
    }
  },

  async sendDiscoverMessage(convId: string, body: string): Promise<{ success: boolean; message?: any; error?: string }> {
    try {
      const res = await fetchWithAuth(`/api/discover/conversation/${encodeURIComponent(convId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok && data.success, message: data.message, error: data.error };
    } catch (err) {
      console.error('API Error [sendDiscoverMessage]:', err);
      return { success: false, error: 'تعذر الاتصال بالخادم' };
    }
  },

  async endDiscoverConversation(convId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetchWithAuth(`/api/discover/conversation/${encodeURIComponent(convId)}/end`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok && data.success, error: data.error };
    } catch (err) {
      console.error('API Error [endDiscoverConversation]:', err);
      return { success: false, error: 'تعذر الاتصال بالخادم' };
    }
  },

  async revealDiscoverIdentity(convId: string): Promise<{ success: boolean; revealed?: boolean; myConsent?: boolean; otherConsent?: boolean; error?: string }> {
    try {
      const res = await fetchWithAuth(`/api/discover/conversation/${encodeURIComponent(convId)}/reveal`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      return {
        success: res.ok && data.success,
        revealed: data.revealed,
        myConsent: data.myConsent,
        otherConsent: data.otherConsent,
        error: data.error,
      };
    } catch (err) {
      console.error('API Error [revealDiscoverIdentity]:', err);
      return { success: false, error: 'تعذر الاتصال بالخادم' };
    }
  },

};
