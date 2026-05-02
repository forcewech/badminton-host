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

export type PublicBookingSettings = {
  depositAmount: number;
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
  depositReference?: string | null;
  depositPaidAt?: string | null;
  depositExpiresAt?: string | null;
  depositTransactionId?: string | null;
  depositTransferNote?: string | null;
  depositReceivedWhileCancelled?: boolean;
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

// ── Play-session coordination types ───────────────────────────────────────────

export type PlayerSkillLevel = 'TB' | 'TB_PLUS' | 'KHA' | 'GIOI';
export type SessionStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED';
export type MatchStatus = 'PLAYING' | 'ENDED';

export type PlaySessionPlayer = {
  id: number;
  sessionId: number;
  name: string;
  skillLevel: PlayerSkillLevel;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  matchesPlayed: number;
  consecutiveMatches: number;
  lastMatchEndedAt: string | null;
  isCurrentlyPlaying: boolean;
  createdAt: string;
};

export type PlaySessionMatch = {
  id: number;
  sessionId: number;
  courtNumber: number;
  teamAPlayer1Id: number;
  teamAPlayer2Id: number;
  teamBPlayer1Id: number;
  teamBPlayer2Id: number;
  scoreA: number;
  scoreB: number;
  status: MatchStatus;
  startedAt: string;
  endedAt: string | null;
};

export type SuggestionReason = {
  type: 'success' | 'warning' | 'info';
  text: string;
};

export type TeamOption = {
  teamA: PlaySessionPlayer[];
  teamB: PlaySessionPlayer[];
  skillDiff: number;
  reasons: SuggestionReason[];
};

export type PairingSuggestion = {
  court: number;
  options: TeamOption[];
};

export type PlaySession = {
  id: number;
  name: string;
  venue: string;
  date: string;
  startTime: string;
  endTime: string;
  numberOfCourts: number;
  status: SessionStatus;
  startedAt: string | null;
  createdAt: string;
  players: PlaySessionPlayer[];
  matches: PlaySessionMatch[];
  suggestions: PairingSuggestion[];
};

export type BookingSlot = {
  startTime: string;
  endTime: string;
  courts: string[];
  totalBookings: number;
  checkedInCount: number;
  unassignedCount: number;
  existingSessionId: number | null;
};

export type CreatePlaySessionPayload = {
  name: string;
  venue?: string;
  date: string;
  startTime: string;
  endTime: string;
  numberOfCourts: number;
};

export type AddPlayerPayload = {
  name: string;
  skillLevel: PlayerSkillLevel;
};

export type StartMatchPayload = {
  courtNumber: number;
  teamAPlayer1Id: number;
  teamAPlayer2Id: number;
  teamBPlayer1Id: number;
  teamBPlayer2Id: number;
};

// ──────────────────────────────────────────────────────────────────────────────

export type UpdateBookingPayload = {
  customerName?: string;
  customerPhone?: string;
  gender?: CustomerGender;
  skillLevel?: SkillLevel;
  bookingDate?: string;
  startTime?: string;
  endTime?: string;
  depositAmount?: number;
  notes?: string;
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
