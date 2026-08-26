import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ar' | 'en';

interface LanguageContextType {
  language: Language;
  isRtl: boolean;
  setLanguage: (lang: Language) => void;
  t: (key: string, defaultText?: string) => string;
}

const translations: Record<string, { ar: string; en: string }> = {
  // Brand & Nav
  appName: { ar: 'حلاقي', en: 'HALAQI' },
  appTagline: { ar: 'منصة حجز صالونات الحلاقة والتجميل الأولى', en: 'Premier Barber & Beauty Booking Platform' },
  home: { ar: 'الرئيسية', en: 'Home' },
  explore: { ar: 'استكشف الصالونات', en: 'Explore Salons' },
  map: { ar: 'الخريطة', en: 'Map' },
  myBookings: { ar: 'حجوزاتي', en: 'My Bookings' },
  favorites: { ar: 'المفضلة', en: 'Favorites' },
  salonPortal: { ar: 'لوحة الصالون', en: 'Salon Portal' },
  adminPanel: { ar: 'لوحة الإدارة', en: 'Admin Panel' },
  login: { ar: 'تسجيل الدخول', en: 'Login' },
  register: { ar: 'إنشاء حساب', en: 'Register' },
  logout: { ar: 'تسجيل الخروج', en: 'Logout' },
  profile: { ar: 'الملف الشخصي', en: 'Profile' },
  notifications: { ar: 'الإشعارات', en: 'Notifications' },

  // Filters & Types
  menSalons: { ar: 'صالونات رجالية', en: 'Men Salons' },
  womenSalons: { ar: 'صالونات نسائية', en: 'Women Salons' },
  allSalons: { ar: 'جميع الصالونات', en: 'All Salons' },
  featuredSalons: { ar: 'صالونات مميزة', en: 'Featured Salons' },
  topRated: { ar: 'الأعلى تقييماً', en: 'Top Rated' },
  nearestToMe: { ar: 'الأقرب إليّ', en: 'Nearest to Me' },
  specialOffers: { ar: 'عروض وخصومات حصرية', en: 'Special Offers & Discounts' },
  mostPopularServices: { ar: 'الخدمات الأكثر طلباً', en: 'Most Popular Services' },
  verifiedSalon: { ar: 'صالون معتمد وموثق', en: 'Verified Salon' },

  // Actions
  bookNow: { ar: 'احجز الآن', en: 'Book Now' },
  viewSalon: { ar: 'عرض الصالون', en: 'View Salon' },
  getDirections: { ar: 'الاتجاهات', en: 'Directions' },
  callSalon: { ar: 'اتصال بالصالون', en: 'Call Salon' },
  chatWhatsApp: { ar: 'مراسلة عبر واتساب', en: 'Chat on WhatsApp' },
  openGoogleMaps: { ar: 'فتح في خرائط Google', en: 'Open in Google Maps' },
  rateSalon: { ar: 'تقييم الصالون', en: 'Rate Salon' },
  cancelBooking: { ar: 'إلغاء الموعد', en: 'Cancel Booking' },
  rebook: { ar: 'حجز مرة أخرى', en: 'Re-book' },
  searchPlaceholder: { ar: 'ابحث باسم الصالون، المنطقة، الخدمة، الحلاق...', en: 'Search by salon, area, service, barber...' },
  allCities: { ar: 'كل المدن', en: 'All Cities' },
  selectCity: { ar: 'اختر المدينة', en: 'Select City' },

  // Status
  openNow: { ar: 'مفتوح الآن', en: 'Open Now' },
  closedNow: { ar: 'مغلق حالياً', en: 'Closed Now' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed' },
  pending: { ar: 'قيد الانتظار', en: 'Pending' },
  completed: { ar: 'مكتمل', en: 'Completed' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
  available: { ar: 'متاح', en: 'Available' },
  occupied: { ar: 'محجوز', en: 'Occupied' },

  // Booking Flow
  selectService: { ar: '1. اختر الخدمة', en: '1. Select Service' },
  selectBarber: { ar: '2. اختر الحلاق / الأخصائي', en: '2. Select Barber / Stylist' },
  selectDate: { ar: '3. اختر التاريخ', en: '3. Select Date' },
  selectTime: { ar: '4. اختر الوقت المتاح', en: '4. Select Time Slot' },
  customerInfo: { ar: '5. بيانات الحجز والدفع', en: '5. Customer & Payment' },
  bookingConfirmation: { ar: 'تأكيد الحجز', en: 'Booking Confirmation' },
  bookingSuccessTitle: { ar: 'تم تأكيد حجزك بنجاح!', en: 'Booking Successfully Confirmed!' },
  bookingNumber: { ar: 'رقم الحجز', en: 'Booking Number' },
  anyAvailableBarber: { ar: 'أي حلاق متاح', en: 'Any Available Barber' },
  totalPrice: { ar: 'المجموع الكلي', en: 'Total Price' },
  applyCoupon: { ar: 'تطبيق الكوبون', en: 'Apply Coupon' },
  couponApplied: { ar: 'تم تطبيق الخصم بنجاح', en: 'Coupon applied successfully' },
  couponCodePlaceholder: { ar: 'أدخل كود الخصم (مثل HALAQI10)', en: 'Enter coupon code (e.g. HALAQI10)' },
  payOnArrival: { ar: 'الدفع عند الوصول للصالون (نقداً)', en: 'Pay on Arrival (Cash)' },
  payZainCash: { ar: 'زين كاش (ZainCash)', en: 'ZainCash' },
  payQiCard: { ar: 'بطاقة كي كارد (Qi Card)', en: 'Qi Card' },
  notesOptional: { ar: 'ملاحظات خاصة للصالون (اختياري)', en: 'Special notes for the salon (optional)' },
  fullName: { ar: 'الاسم الكامل', en: 'Full Name' },
  phoneNumber: { ar: 'رقم الهاتف (عراقي)', en: 'Phone Number' },
  iqd: { ar: 'د.ع', en: 'IQD' },
  startingFrom: { ar: 'يبدأ من', en: 'Starts from' },
  minutes: { ar: 'دقيقة', en: 'min' },
  km: { ar: 'كم', en: 'km' },
  meters: { ar: 'متر', en: 'm' },

  // Policies
  privacyPolicy: { ar: 'سياسة الخصوصية', en: 'Privacy Policy' },
  termsAndConditions: { ar: 'الشروط والأحكام', en: 'Terms & Conditions' },
  cancellationPolicy: { ar: 'سياسة الإلغاء', en: 'Cancellation Policy' },
  refundPolicy: { ar: 'سياسة الاسترجاع', en: 'Refund Policy' },

  // Smart Home
  upcomingAppointmentTitle: { ar: 'موعدك القادم', en: 'Your Upcoming Appointment' },
  bookFirstAppointment: { ar: 'احجز موعدك الأول واستمتع بتجربة راقية', en: 'Book your first appointment today' },
  nearbySalonsHeading: { ar: 'صالونات قريبة منك', en: 'Salons Near You' },
  youAreHere: { ar: 'أنت هنا', en: 'You are here' },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('halaqi_lang');
    return saved === 'en' ? 'en' : 'ar';
  });

  const isRtl = language === 'ar';

  useEffect(() => {
    localStorage.setItem('halaqi_lang', language);
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isRtl]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string, defaultText?: string): string => {
    if (translations[key]) {
      return translations[key][language] || translations[key].ar || defaultText || key;
    }
    return defaultText || key;
  };

  return (
    <LanguageContext.Provider value={{ language, isRtl, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
