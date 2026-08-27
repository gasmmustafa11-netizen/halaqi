export type UserRole = 'customer' | 'salon_owner' | 'staff' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  city?: string;
  salonId?: string; // If salon owner or staff
  isActive?: boolean;
  isBanned?: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  action: string; // e.g. "ADMIN_LOGIN", "ROLE_CHANGE", "SALON_APPROVE", "SALON_SUSPEND", "USER_BAN", "SETTINGS_UPDATE", "BOOKING_CANCEL"
  targetType: 'user' | 'salon' | 'booking' | 'service' | 'system' | 'auth';
  targetId?: string;
  details: string;
  ip?: string;
  status: 'success' | 'failure' | 'warning';
  timestamp: string;
}

export type SalonType = 'men' | 'women' | 'unisex';
export type SalonStatus = 'approved' | 'pending' | 'rejected' | 'suspended' | 'banned';

export interface WorkingDayHours {
  open: string; // e.g. "09:00"
  close: string; // e.g. "22:00"
  isOpen: boolean;
}

export interface WeeklyWorkingHours {
  saturday: WorkingDayHours;
  sunday: WorkingDayHours;
  monday: WorkingDayHours;
  tuesday: WorkingDayHours;
  wednesday: WorkingDayHours;
  thursday: WorkingDayHours;
  friday: WorkingDayHours;
}

export interface Salon {
  id: string;
  name: string;
  nameEn: string;
  slug: string;
  type: SalonType;
  city: string;
  area: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  whatsapp: string;
  description: string;
  descriptionEn: string;
  rating: number;
  reviewCount: number;
  startingPrice: number; // IQD
  coverImage: string;
  gallery: string[];
  isVerified: boolean;
  isFeatured?: boolean;
  status: SalonStatus;
  suspensionReason?: string;
  suspensionStartedAt?: string;
  suspensionEndsAt?: string;
  workingHours: WeeklyWorkingHours;
  features: string[]; // e.g. ["VIP Room", "WiFi", "Coffee & Drinks", "Valet Parking", "Air Conditioned"]
  commissionRate?: number; // e.g. 10 (%)
  ownerId: string;
  createdAt: string;
}

export interface Barber {
  id: string;
  salonId: string;
  name: string;
  nameEn: string;
  avatar: string;
  title: string;
  titleEn: string;
  experienceYears: number;
  rating: number;
  reviewCount: number;
  specializations: string[];
  isAvailable: boolean;
  phone?: string;
}

export interface Service {
  id: string;
  salonId: string;
  name: string;
  nameEn: string;
  category: string; // "haircut", "beard", "styling", "skincare", "color", "bridal", "packages"
  categoryEn: string;
  description: string;
  price: number; // IQD
  durationMinutes: number;
  image?: string;
  barberIds?: string[]; // IDs of staff who provide this service (or all if empty)
  isPopular?: boolean;
}

export type BookingStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'zain_cash' | 'qi_card' | 'credit_card';

export interface Booking {
  id: string;
  bookingNumber: string; // e.g. "HLQ-2026-9842"
  salonId: string;
  salonName: string;
  salonAddress: string;
  salonPhone: string;
  salonType: SalonType;
  serviceId: string;
  serviceName: string;
  additionalServices?: { id: string; name: string; price: number }[];
  barberId: string;
  barberName: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "14:30"
  durationMinutes: number;
  price: number; // IQD
  discountAmount?: number;
  finalPrice: number; // IQD
  commissionAmount: number; // IQD (e.g. 10%)
  salonPayout: number; // IQD
  status: BookingStatus;

  // Service completion verification
  completionQrNonce?: string;
  completionQrExpiresAt?: string;
  completedAt?: string;
  completedBy?: string;

  paymentMethod: PaymentMethod;
  paymentStatus: 'unpaid' | 'paid' | 'deposit_paid' | 'refunded';
  createdAt: string;
  rated?: boolean;
  cancellationReason?: string;
}

export interface Review {
  id: string;
  salonId: string;
  salonName: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  customerAvatar?: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
  reply?: string;
  replyDate?: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountPercent: number; // e.g. 10
  discountAmount?: number; // IQD
  maxDiscount?: number;
  minBookingAmount: number; // IQD
  validUntil: string;
  usageCount: number;
  maxUsage: number;
  isActive: boolean;
  salonId?: string; // If specific to salon or platform-wide
}

export interface Notification {
  id: string;
  userId: string;
  actorUserId?: string;
  actorName?: string;
  title: string;
  titleEn: string;
  message: string;
  messageEn: string;
  type: 'message' | 'booking_created' | 'booking_confirmed' | 'booking_reminder' | 'booking_cancelled' | 'booking_completed' | 'offer' | 'system' | 'new_user' | 'new_salon' | 'salon_approved' | 'salon_rejected' | 'salon_suspended' | 'post_like' | 'post_comment';
  read: boolean;
  createdAt: string;
  link?: string;
  salonId?: string;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  read: boolean;
  status?: 'sent' | 'delivered' | 'read';
  createdAt: string;
}

export interface Conversation {
  otherUser: {
    id: string;
    name: string;
    avatar?: string;
  };
  lastMessage: {
    body: string;
    createdAt: string;
    senderId: string;
  };
  unreadCount: number;
}

export interface City {
  id: string;
  nameAr: string;
  nameEn: string;
  lat: number;
  lng: number;
  active: boolean;
  salonCount?: number;
}

export interface BlockedTime {
  id: string;
  salonId: string;
  barberId?: string; // If specific barber or entire salon
  date: string; // YYYY-MM-DD
  startTime: string; // "14:00"
  endTime: string; // "16:00"
  reason?: string;
}

export interface PlatformSettings {
  commissionRate: number; // e.g. 10 (%)
  currency: string; // "IQD"
  currencySymbol: string; // "د.ع"
  googleMapsApiKey?: string;
  supportPhone: string;
  supportEmail: string;
  termsAr: string;
  termsEn: string;
  privacyAr: string;
  privacyEn: string;
  cancellationAr: string;
  cancellationEn: string;
  refundAr: string;
  refundEn: string;
}

export interface SalonPost {
  id: string;
  salonId: string;
  ownerId: string;
  salonName: string;
  imageUrl: string;
  caption: string;
  createdAt: string;
  updatedAt?: string;
  likeCount: number;
  commentCount: number;
}

export interface UserPost {
  id: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  imageUrl: string;
  caption: string;
  createdAt: string;
  updatedAt?: string;
  likeCount: number;
  commentCount: number;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  comment: string;
  createdAt: string;
}

export interface PostLike {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
}
