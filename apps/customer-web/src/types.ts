export type CustomerGender = "MALE" | "FEMALE" | "OTHER";
export type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED";

export type QuickSlot = {
  id: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
};

export type PublicBookingPayload = {
  customerName: string;
  customerPhone?: string;
  gender: CustomerGender;
  skillLevel: SkillLevel;
  bookingDate: string;
  startTime: string;
  endTime: string;
  notes?: string;
  photoUrl?: string;
  photoPublicId?: string;
};

export type PublicBookingResponse = {
  booking: {
    id: number;
    customerName: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    depositAmount: number;
    depositPaid: boolean;
    depositReference?: string | null;
    status: BookingStatus;
  };
  payment: {
    bankName: string;
    bankBin: string;
    accountNumber: string;
    accountName: string;
    amount: number;
    transferContent: string;
    qrImageUrl: string | null;
    isConfigured: boolean;
    expiresAt?: string | null;
  };
};

export type PublicPaymentStatus = {
  reference?: string | null;
  depositAmount: number;
  depositPaid: boolean;
  depositPaidAt?: string | null;
  depositExpiresAt?: string | null;
  isExpired?: boolean;
  status: BookingStatus;
  customerName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  payment: PublicBookingResponse["payment"];
};
