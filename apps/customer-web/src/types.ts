export type CustomerGender = "MALE" | "FEMALE" | "OTHER";
export type SkillLevel = "Y" | "TB_MINUS" | "TB" | "TB_PLUS" | "KHA" | "TUYEN";
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
  maxPlayers: number;
  currentBookings: number;
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

export type ShopItem = {
  id: number;
  name: string;
  imageUrl?: string | null;
  priceLabel?: string | null;
  link?: string | null;
  displayOrder: number;
  isActive: boolean;
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
