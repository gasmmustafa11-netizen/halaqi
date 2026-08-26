import React, { createContext, useContext, useState } from 'react';
import { Salon, Service, Barber, Booking, PaymentMethod, Coupon } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface BookingContextType {
  isBookingOpen: boolean;
  activeSalon: Salon | null;
  selectedService: Service | null;
  selectedBarber: Barber | null;
  selectedDate: string;
  selectedTimeSlot: string;
  customerName: string;
  customerPhone: string;
  customerNotes: string;
  paymentMethod: PaymentMethod;
  appliedCoupon: Coupon | null;
  discountAmount: number;
  step: number;
  isLoading: boolean;
  error: string | null;
  confirmedBooking: Booking | null;
  occupiedSlots: string[];

  // Actions
  openBookingWizard: (salon: Salon, service?: Service, barber?: Barber) => void;
  closeBookingWizard: () => void;
  setStep: (step: number) => void;
  setSelectedService: (service: Service | null) => void;
  setSelectedBarber: (barber: Barber | null) => void;
  setSelectedDate: (date: string) => void;
  setSelectedTimeSlot: (timeSlot: string) => void;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  setCustomerNotes: (notes: string) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  applyCouponCode: (code: string) => Promise<boolean>;
  removeCoupon: () => void;
  fetchOccupiedSlots: (barberId: string, date: string) => Promise<void>;
  confirmBooking: () => Promise<Booking | null>;
  resetBookingState: () => void;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

// Helper to get tomorrow's date string YYYY-MM-DD
export const getTomorrowDate = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [isBookingOpen, setIsBookingOpen] = useState<boolean>(false);
  const [activeSalon, setActiveSalon] = useState<Salon | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getTomorrowDate());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState<string>(user?.phone || '');
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [occupiedSlots, setOccupiedSlots] = useState<string[]>([]);

  const resetBookingState = () => {
    setSelectedService(null);
    setSelectedBarber(null);
    setSelectedDate(getTomorrowDate());
    setSelectedTimeSlot('');
    setCustomerNotes('');
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setStep(1);
    setError(null);
    setConfirmedBooking(null);
    setOccupiedSlots([]);
  };

  const openBookingWizard = (salon: Salon, service?: Service, barber?: Barber) => {
    setActiveSalon(salon);
    if (user) {
      setCustomerName(user.name);
      setCustomerPhone(user.phone);
    }
    if (service) {
      setSelectedService(service);
      setStep(2);
    } else {
      setSelectedService(null);
      setStep(1);
    }
    if (barber) {
      setSelectedBarber(barber);
    } else {
      setSelectedBarber(null);
    }
    setSelectedDate(getTomorrowDate());
    setSelectedTimeSlot('');
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setError(null);
    setConfirmedBooking(null);
    setIsBookingOpen(true);
  };

  const closeBookingWizard = () => {
    setIsBookingOpen(false);
  };

  const fetchOccupiedSlots = async (barberId: string, date: string) => {
    if (!barberId || !date) return;
    try {
      const slots = await api.getOccupiedSlots(barberId, date);
      setOccupiedSlots(slots);
    } catch {
      setOccupiedSlots([]);
    }
  };

  const applyCouponCode = async (code: string): Promise<boolean> => {
    if (!code || !selectedService) return false;
    setIsLoading(true);
    setError(null);
    const result = await api.validateCoupon(code, selectedService.price);
    setIsLoading(false);
    if (result.valid && result.coupon && result.discount !== undefined) {
      setAppliedCoupon(result.coupon);
      setDiscountAmount(result.discount);
      return true;
    } else {
      setError(result.message || 'الكوبون غير صالح');
      return false;
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
  };

  const confirmBooking = async (): Promise<Booking | null> => {
    if (!activeSalon || !selectedService || !selectedBarber || !selectedDate || !selectedTimeSlot) {
      setError('يرجى إكمال جميع خطوات الحجز');
      return null;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      setError('يرجى كتابة الاسم ورقم الهاتف للتواصل');
      return null;
    }

    setIsLoading(true);
    setError(null);

    const rawPrice = selectedService.price;
    const finalPrice = Math.max(0, rawPrice - discountAmount);

    const bookingPayload = {
      salonId: activeSalon.id,
      salonName: activeSalon.name,
      salonAddress: activeSalon.address,
      salonPhone: activeSalon.phone,
      salonType: activeSalon.type,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      barberId: selectedBarber.id,
      barberName: selectedBarber.name,
      customerId: user?.id || `cust_${Date.now()}`,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: user?.email || '',
      notes: customerNotes.trim() || undefined,
      date: selectedDate,
      timeSlot: selectedTimeSlot,
      durationMinutes: selectedService.durationMinutes,
      price: rawPrice,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      finalPrice,
      status: 'confirmed',
      paymentMethod,
      paymentStatus: paymentMethod === 'cash' ? 'unpaid' : 'paid',
    };

    const res = await api.createBooking(bookingPayload);
    setIsLoading(false);

    if (res.success && res.booking) {
      setConfirmedBooking(res.booking);
      setStep(6); // Confirmation screen
      return res.booking;
    } else {
      setError(res.error || 'فشل في إتمام الحجز. يرجى تجربة موعد آخر.');
      return null;
    }
  };

  return (
    <BookingContext.Provider
      value={{
        isBookingOpen,
        activeSalon,
        selectedService,
        selectedBarber,
        selectedDate,
        selectedTimeSlot,
        customerName,
        customerPhone,
        customerNotes,
        paymentMethod,
        appliedCoupon,
        discountAmount,
        step,
        isLoading,
        error,
        confirmedBooking,
        occupiedSlots,
        openBookingWizard,
        closeBookingWizard,
        setStep,
        setSelectedService,
        setSelectedBarber,
        setSelectedDate,
        setSelectedTimeSlot,
        setCustomerName,
        setCustomerPhone,
        setCustomerNotes,
        setPaymentMethod,
        applyCouponCode,
        removeCoupon,
        fetchOccupiedSlots,
        confirmBooking,
        resetBookingState,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
};

export const useBooking = (): BookingContextType => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};
