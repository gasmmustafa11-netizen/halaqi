import { neon } from '@neondatabase/serverless';
import {
  initialCities,
  initialUsers,
  initialSalons,
  initialBarbers,
  initialServices,
  initialBookings,
  initialReviews,
  initialCoupons,
  initialNotifications,
  initialSettings,
} from '../src/server/db';

const sql = neon(process.env.DATABASE_URL!);

async function seed() {
  console.log('بدء نقل البيانات إلى Neon...');

  for (const c of initialCities) {
    await sql`
      INSERT INTO cities
      (id,name_ar,name_en,lat,lng,active,salon_count)
      VALUES
      (${c.id},${c.nameAr},${c.nameEn},${c.lat},${c.lng},${c.active},${c.salonCount ?? null})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  for (const s of initialSalons) {
    await sql`
      INSERT INTO salons
      (id,name,name_en,slug,type,city,area,address,lat,lng,phone,whatsapp,
       description,description_en,rating,review_count,starting_price,cover_image,
       gallery,is_verified,is_featured,status,owner_id,working_hours,features,created_at)
      VALUES
      (${s.id},${s.name},${s.nameEn},${s.slug},${s.type},${s.city},${s.area},
       ${s.address},${s.lat},${s.lng},${s.phone},${s.whatsapp},
       ${s.description},${s.descriptionEn},${s.rating},${s.reviewCount},
       ${s.startingPrice},${s.coverImage},${JSON.stringify(s.gallery)},
       ${s.isVerified},${s.isFeatured ?? false},${s.status},${s.ownerId},
       ${JSON.stringify(s.workingHours)},${JSON.stringify(s.features)},
       ${s.createdAt})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  for (const b of initialBarbers) {
    await sql`
      INSERT INTO barbers
      (id,salon_id,name,name_en,avatar,title,title_en,experience_years,
       rating,review_count,specializations,is_available,phone)
      VALUES
      (${b.id},${b.salonId},${b.name},${b.nameEn},${b.avatar},${b.title},
       ${b.titleEn},${b.experienceYears},${b.rating},${b.reviewCount},
       ${JSON.stringify(b.specializations)},${b.isAvailable},${b.phone ?? null})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  for (const s of initialServices) {
    await sql`
      INSERT INTO services
      (id,salon_id,name,name_en,category,category_en,description,price,
       duration_minutes,image,barber_ids,is_popular)
      VALUES
      (${s.id},${s.salonId},${s.name},${s.nameEn},${s.category},${s.categoryEn},
       ${s.description},${s.price},${s.durationMinutes},${s.image ?? null},
       ${JSON.stringify(s.barberIds ?? [])},${s.isPopular ?? false})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  for (const b of initialBookings) {
    await sql`
      INSERT INTO bookings
      (id,booking_number,salon_id,salon_name,salon_address,salon_phone,salon_type,
       service_id,service_name,barber_id,barber_name,customer_id,customer_name,
       customer_phone,customer_email,notes,date,time_slot,duration_minutes,price,
       discount_amount,final_price,commission_amount,salon_payout,status,
       payment_method,payment_status,created_at,rated,cancellation_reason)
      VALUES
      (${b.id},${b.bookingNumber},${b.salonId},${b.salonName},${b.salonAddress},
       ${b.salonPhone},${b.salonType},${b.serviceId},${b.serviceName},
       ${b.barberId},${b.barberName},${b.customerId},${b.customerName},
       ${b.customerPhone},${b.customerEmail ?? null},${b.notes ?? null},
       ${b.date},${b.timeSlot},${b.durationMinutes},${b.price},
       ${b.discountAmount ?? 0},${b.finalPrice},${b.commissionAmount},
       ${b.salonPayout},${b.status},${b.paymentMethod},${b.paymentStatus},
       ${b.createdAt},${b.rated ?? false},${b.cancellationReason ?? null})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  for (const r of initialReviews) {
    await sql`
      INSERT INTO reviews
      (id,salon_id,salon_name,booking_id,customer_id,customer_name,
       customer_avatar,rating,comment,created_at,reply,reply_date)
      VALUES
      (${r.id},${r.salonId},${r.salonName},${r.bookingId},${r.customerId},
       ${r.customerName},${r.customerAvatar ?? null},${r.rating},${r.comment},
       ${r.createdAt},${r.reply ?? null},${r.replyDate ?? null})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  for (const c of initialCoupons) {
    await sql`
      INSERT INTO coupons
      (id,code,discount_percent,discount_amount,max_discount,min_booking_amount,
       valid_until,usage_count,max_usage,is_active,salon_id)
      VALUES
      (${c.id},${c.code},${c.discountPercent},${c.discountAmount ?? null},
       ${c.maxDiscount ?? null},${c.minBookingAmount},${c.validUntil},
       ${c.usageCount},${c.maxUsage},${c.isActive},${c.salonId ?? null})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  for (const n of initialNotifications) {
    await sql`
      INSERT INTO notifications
      (id,user_id,title,title_en,message,message_en,type,read,created_at,link)
      VALUES
      (${n.id},${n.userId},${n.title},${n.titleEn},${n.message},${n.messageEn},
       ${n.type},${n.read},${n.createdAt},${n.link ?? null})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  await sql`
    INSERT INTO platform_settings
    (id,commission_rate,currency,currency_symbol,google_maps_api_key,
     support_phone,support_email,terms_ar,terms_en,privacy_ar,privacy_en,
     cancellation_ar,cancellation_en,refund_ar,refund_en)
    VALUES
    (1,${initialSettings.commissionRate},${initialSettings.currency},
     ${initialSettings.currencySymbol},${initialSettings.googleMapsApiKey ?? null},
     ${initialSettings.supportPhone},${initialSettings.supportEmail},
     ${initialSettings.termsAr},${initialSettings.termsEn},
     ${initialSettings.privacyAr},${initialSettings.privacyEn},
     ${initialSettings.cancellationAr},${initialSettings.cancellationEn},
     ${initialSettings.refundAr},${initialSettings.refundEn})
  `;
  
  console.log('✅ تم نقل البيانات الأساسية إلى Neon بنجاح');
}

seed().catch((e) => {
  console.error('❌ خطأ:', e.message);
  process.exit(1);
});
