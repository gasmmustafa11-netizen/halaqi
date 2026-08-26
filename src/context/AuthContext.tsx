import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api, setAuthToken, getAuthToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authError: string | null;
  login: (emailOrPhone: string, role?: UserRole, password?: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { name: string; phone: string; email?: string; password?: string; role?: UserRole; city?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchRoleDemo: (role: UserRole) => Promise<void>;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  refreshUser: () => Promise<void>;
}

const defaultCustomerUser: User = {
  id: 'user_cust_1',
  name: 'أحمد الموسوي',
  email: 'ahmed@halaqi.iq',
  phone: '+9647801234567',
  role: 'customer',
  city: 'baghdad',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  createdAt: '2026-01-10T10:00:00Z',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('halaqi_user') : null;
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Validate session on load
  useEffect(() => {
    let mounted = true;

    async function verifySession() {
      const token = getAuthToken();

      if (!token) {
        return;
      }

      try {
        const meRes = await api.getMe();

        if (mounted && meRes.success && meRes.user) {
          setUser(meRes.user);
          localStorage.setItem('halaqi_user', JSON.stringify(meRes.user));
        } else if (mounted) {
          // Token is invalid/expired.
          setAuthToken(null);
          localStorage.removeItem('halaqi_user');
          setUser(null);
        }
      } catch (error) {
        console.error('[AUTH SESSION VERIFY]', error);
      }
    }

    verifySession();

    return () => {
      mounted = false;
    };
  }, []);

  // Rolling session:
  // Renew the 1-year token automatically every 24 hours
  // while the user remains logged in.
  useEffect(() => {
    if (!user || !getAuthToken()) {
      return;
    }

    let cancelled = false;

    const refreshSession = async () => {
      if (cancelled || !getAuthToken()) {
        return;
      }

      try {
        const result = await api.refreshToken();

        if (cancelled) {
          return;
        }

        if (result.success && result.user) {
          setUser(result.user);
          localStorage.setItem('halaqi_user', JSON.stringify(result.user));
          console.log('[AUTH] Session renewed for another 365 days');
        } else {
          console.warn('[AUTH] Automatic session refresh failed:', result.error);
        }
      } catch (error) {
        console.error('[AUTH] Automatic session refresh error:', error);
      }
    };

    // Refresh immediately when the authenticated session becomes active.
    refreshSession();

    // Then refresh every 24 hours.
    const interval = window.setInterval(
      refreshSession,
      24 * 60 * 60 * 1000
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('halaqi_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('halaqi_user');
      setAuthToken(null);
    }
  }, [user]);

  const refreshUser = async () => {
    const meRes = await api.getMe();
    if (meRes.success && meRes.user) {
      setUser(meRes.user);
    }
  };

  const login = async (emailOrPhone: string, role?: UserRole, password?: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const res = await api.login(emailOrPhone, role, password);
      if (res.success && res.user) {
        setUser(res.user);
        setIsAuthModalOpen(false);
        setIsLoading(false);
        return { success: true };
      }
      setAuthError(res.error || 'فشل تسجيل الدخول');
      setIsLoading(false);
      return { success: false, error: res.error };
    } catch (err) {
      console.error('Login error:', err);
      const msg = 'حدث خطأ أثناء الاتصال بالخادم';
      setAuthError(msg);
      setIsLoading(false);
      return { success: false, error: msg };
    }
  };

  const register = async (data: { name: string; phone: string; email?: string; password?: string; role?: UserRole; city?: string }): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const res = await api.register(data);
      if (res.success && res.user) {
        setUser(res.user);
        setIsAuthModalOpen(false);
        setIsLoading(false);
        return { success: true };
      }
      setAuthError(res.error || 'فشل إنشاء الحساب');
      setIsLoading(false);
      return { success: false, error: res.error };
    } catch (err) {
      console.error('Register error:', err);
      const msg = 'حدث خطأ أثناء الاتصال بالخادم';
      setAuthError(msg);
      setIsLoading(false);
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem('halaqi_user');
  };

  const switchRoleDemo = async (newRole: UserRole) => {
    setIsLoading(true);
    if (newRole === 'salon_owner') {
      await login('wissam@royalbarber.iq', 'salon_owner', 'Owner@Royal2026!');
    } else if (newRole === 'admin') {
      await login('admin@halaqi.iq', 'admin', 'Admin@Halaqi2026!');
    } else {
      await login('ahmed@halaqi.iq', 'customer', 'Customer@2026!');
    }
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'customer',
        isAuthenticated: !!user,
        isLoading,
        isAuthModalOpen,
        authError,
        login,
        register,
        logout,
        switchRoleDemo,
        openAuthModal: () => {
          setAuthError(null);
          setIsAuthModalOpen(true);
        },
        closeAuthModal: () => {
          setAuthError(null);
          setIsAuthModalOpen(false);
        },
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
