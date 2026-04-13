export type Court = {
  id: number;
  name: string;
  zone: string;
  hourlyRate: number;
  isActive: boolean;
};

export type CourtPayload = {
  name: string;
  zone: string;
  hourlyRate: number;
  isActive: boolean;
};

export type QuickSlot = {
  id: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
};

export type QuickSlotPayload = {
  bookingDate: string;
  startTime: string;
  endTime: string;
};

export type EquipmentItem = {
  id: number;
  name: string;
  quantityAvailable: number;
  quantityInUse: number;
  isChecked: boolean;
  conditionNotes: string;
};

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELLED';

export type CustomerGender = 'MALE' | 'FEMALE' | 'OTHER';
export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export type Booking = {
  id: number;
  customerName: string;
  customerPhone?: string;
  gender: CustomerGender;
  skillLevel: SkillLevel;
  bookingDate: string;
  startTime: string;
  endTime: string;
  depositAmount: number;
  depositPaid: boolean;
  fullPaymentTransferred: boolean;
  status: BookingStatus;
  notes: string;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  matchTracking: boolean[];
  checkInAt?: string;
  paymentTransferredAt?: string;
  court: Court | null;
};

export type DashboardOverview = {
  date: string;
  totals: {
    courts: number;
    todaysBookings: number;
    checkedInCount: number;
    pendingDeposits: number;
    pendingTransfers: number;
    equipmentIssues: number;
  };
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type AuthSession = {
  accessToken: string;
  user: {
    username: string;
    role: 'admin';
  };
};

export type CreateBookingPayload = {
  customerName: string;
  customerPhone?: string;
  gender: CustomerGender;
  skillLevel: SkillLevel;
  bookingDate: string;
  startTime: string;
  endTime: string;
  depositAmount: number;
  notes?: string;
  photoUrl?: string;
  photoPublicId?: string;
};
