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
  interests?: string[]; // Discover: user-selected interest ids
  isBot?: boolean; // Bot accounts are flagged internally and never shown as real humans
  botEnabled?: boolean; // Whether automated activity is allowed for this bot
  isPremium?: boolean; // Premium members get extended Reels duration (120s vs 60s)
  bio?: string;
  username?: string; // Unique, case-insensitive handle displayed as @username
  isRestricted?: boolean; // AI/Admin moderation: temporarily blocked from posting
isWarned?: boolean; // AI/Admin moderation: received a warning
   isVerified?: boolean; // Account verification status
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
  lastCoverUpdate?: string;
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
  actorIsVerified?: boolean;
  title: string;
  titleEn: string;
  message: string;
  messageEn: string;
  type: 'message' | 'booking_created' | 'booking_confirmed' | 'booking_reminder' | 'booking_cancelled' | 'booking_completed' | 'offer' | 'system' | 'new_user' | 'new_salon' | 'salon_approved' | 'salon_rejected' | 'salon_suspended' | 'post_like' | 'post_comment' | 'follow' | 'review'   | 'support_reply'
  | 'moderation';
  read: boolean;
  createdAt: string;
  link?: string;
  salonId?: string;
}

export type MessageType = 'text' | 'image' | 'audio';

export interface MessageMediaMetadata {
  size?: number;
  mime?: string;
  name?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  read: boolean;
  status?: 'sent' | 'delivered' | 'read';
  createdAt: string;
  type?: MessageType;
  mediaUrl?: string;
  mediaThumbnail?: string;
  mediaMetadata?: MessageMediaMetadata;
}

export interface Conversation {
    otherUser: {
    id: string;
    name: string;
    username?: string;
    avatar?: string;
    isVerified?: boolean;
  };
  lastMessage: {
    body: string;
    createdAt: string;
    senderId: string;
    type?: MessageType;
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
  isHidden?: boolean; // AI/Admin moderation: hidden from feeds
  hiddenReason?: string;
  moderationStatus?: string; // 'auto_hidden' | 'restored' | null
}

export interface UserPost {
  id: string;
  userId: string;
  userName?: string;
  username?: string;
  userAvatar?: string;
  isVerified?: boolean;
  imageUrl?: string; // Optional: text-only posts have no image
  caption: string;
  createdAt: string;
  updatedAt?: string;
  likeCount: number;
  commentCount: number;
  mediaType?: 'image' | 'video'; // Reels are stored as media_type='video'
  duration?: number; // Video duration in seconds (Reels only)
  isHidden?: boolean; // AI/Admin moderation: hidden from feeds
  hiddenReason?: string;
  moderationStatus?: string;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  isVerified?: boolean;
  comment: string;
  createdAt: string;
  likes?: number;
  dislikes?: number;
  myReaction?: 'like' | 'dislike' | null;
  isHidden?: boolean; // AI/Admin moderation: hidden from view
  hiddenReason?: string;
}

export interface PostLike {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
}

export interface NotificationPreferences {
  likes: boolean;
  comments: boolean;
  followers: boolean;
  messages: boolean;
  bookings: boolean;
  reviews: boolean;
  reels: boolean;
  admin: boolean;
}

export type PushCategory = keyof NotificationPreferences;

// ============================================================
// SUPPORT MAIL SYSTEM
// ============================================================

export type SupportTicketStatus =
  | 'new'
  | 'reviewing'
  | 'processing'
  | 'resolved'
  | 'closed';

export type SupportTicketType =
  | 'bug'
  | 'suggestion'
  | 'complaint'
  | 'other';

export interface SupportAttachment {
  url: string;
  type?: string;
  name?: string;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: 'user' | 'admin' | 'support';
  message: string;
  attachments: SupportAttachment[];
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  subject: string;
  type: SupportTicketType;
  message: string;
  status: SupportTicketStatus;
  attachments: SupportAttachment[];
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
  lastReplyAt?: string;
  lastReplyPreview?: string;
  replyCount?: number;
}

export interface SupportTicketDetail extends SupportTicket {
  messages: SupportTicketMessage[];
}

// ============================================================
// AI SMART MODERATION & CONTENT REPORTS
// ============================================================

export type ModerationContentType =
  | 'user'
  | 'user_post'
  | 'salon_post'
  | 'comment'
  | 'reel';

export type ModerationCategory =
  | 'hate_sectarian'
  | 'incitement_violence'
  | 'threat_violence'
  | 'harassment_bullying'
  | 'sexual_inappropriate'
  | 'scam_fraud'
  | 'spam'
  | 'impersonation'
  | 'illegal_dangerous'
  | 'doxxing'
  | 'policy_violation'
  | 'other';

export type ModerationSeverity = 'low' | 'medium' | 'high';

export type ModerationDecision = 'violation' | 'clean' | 'escalate';

export type ModerationAction =
  | 'keep_content'
  | 'hide_content'
  | 'remove_content'
  | 'warn_user'
  | 'restrict_user'
  | 'escalate_to_admin';

export type ModerationFinalDecision = 'upheld' | 'overturned' | 'pending';

export interface ContentReport {
  id: string;
  reporterId: string;
  reporterName?: string;
  contentType: ModerationContentType;
  contentId: string;
  contentOwnerId?: string;
  contentOwnerName?: string;
  reason?: string;
  details?: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'rejected';
  aiDecision?: ModerationDecision | null;
  createdAt: string;
}

export interface ModerationLog {
  id: string;
  reportId?: string;
  contentId: string;
  contentType: ModerationContentType;
  detectedCategories: ModerationCategory[];
  confidenceScores: Record<string, number>;
  severity: ModerationSeverity;
  confidence: number;
  decision: ModerationDecision;
  action?: ModerationAction;
  reason: string;
  model: string;
  createdAt: string;
  reviewedByAdmin?: boolean;
  finalDecision?: ModerationFinalDecision;
  adminNote?: string;
}
