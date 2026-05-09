import type {
  AddPlayerPayload,
  AuthSession,
  Booking,
  BookingSlot,
  Court,
  CourtPayload,
  CreateBookingPayload,
  UpdateBookingPayload,
  CreatePlaySessionPayload,
  DashboardOverview,
  EquipmentItem,
  LoginPayload,
  PlaySession,
  PublicBookingSettings,
  QuickSlot,
  QuickSlotPayload,
  ShopItem,
  ShopItemPayload,
  StartMatchPayload,
} from './types';

function getDefaultApiUrl() {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3000`;
}

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const API_URL = configuredApiUrl || getDefaultApiUrl();
let accessToken = '';

export function setApiAccessToken(token: string) {
  accessToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormDataBody = init?.body instanceof FormData;
  const response = await fetch(`${API_URL}/api${path}`, {
    headers: {
      ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(body.message ?? 'Request failed');
  }

  return response.json() as Promise<T>;
}

export const api = {
  login: (payload: LoginPayload) =>
    request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getOverview: () => request<DashboardOverview>('/dashboard/overview'),
  getCourts: () => request<Court[]>('/courts'),
  getPublicBookingSettings: () =>
    request<PublicBookingSettings>('/settings/public-booking'),
  updatePublicBookingSettings: (depositAmount: number) =>
    request<PublicBookingSettings>('/settings/public-booking', {
      method: 'PATCH',
      body: JSON.stringify({ depositAmount }),
    }),
  getQuickSlots: (date: string) =>
    request<QuickSlot[]>(`/quick-slots?date=${encodeURIComponent(date)}`),
  createQuickSlot: (payload: QuickSlotPayload) =>
    request<QuickSlot>('/quick-slots', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateQuickSlotMaxPlayers: (id: number, maxPlayers: number) =>
    request<QuickSlot>(`/quick-slots/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ maxPlayers }),
    }),
  deleteQuickSlot: (id: number) =>
    request<{ id: number; deleted: boolean }>(`/quick-slots/${id}`, {
      method: 'DELETE',
    }),
  createCourt: (payload: CourtPayload) =>
    request<Court>('/courts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCourt: (id: number, payload: Partial<CourtPayload>) =>
    request<Court>(`/courts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteCourt: (id: number) =>
    request<{ id: number; deleted: boolean }>(`/courts/${id}`, {
      method: 'DELETE',
    }),
  getBookings: () => request<Booking[]>('/bookings'),
  updateBooking: (id: number, payload: UpdateBookingPayload) =>
    request<Booking>(`/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  createBooking: (payload: CreateBookingPayload) =>
    request<Booking>('/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  uploadBookingPhoto: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return request<{ url: string; publicId: string }>('/bookings/upload-photo', {
      method: 'POST',
      body: formData,
    });
  },
  assignCourt: (id: number, courtId: number) =>
    request<Booking>(`/bookings/${id}/assign-court`, {
      method: 'PATCH',
      body: JSON.stringify({ courtId }),
    }),
  updateMatchTracking: (id: number, slot: number, checked: boolean) =>
    request<Booking>(`/bookings/${id}/match-tracking`, {
      method: 'PATCH',
      body: JSON.stringify({ slot, checked }),
    }),
  confirmDeposit: (id: number) =>
    request<Booking>(`/bookings/${id}/deposit`, {
      method: 'PATCH',
    }),
  checkIn: (id: number) =>
    request<Booking>(`/bookings/${id}/check-in`, {
      method: 'PATCH',
    }),
  confirmFullPayment: (id: number) =>
    request<Booking>(`/bookings/${id}/full-payment`, {
      method: 'PATCH',
    }),
  markNoShow: (id: number) =>
    request<Booking>(`/bookings/${id}/no-show`, {
      method: 'PATCH',
    }),
  restoreBooking: (id: number) =>
    request<Booking>(`/bookings/${id}/restore`, {
      method: 'PATCH',
    }),
  deleteBooking: (id: number) =>
    request<{ id: number; deleted: boolean }>(`/bookings/${id}`, {
      method: 'DELETE',
    }),
  getBookingSlots: (date: string) =>
    request<BookingSlot[]>(`/play-sessions/booking-slots?date=${encodeURIComponent(date)}`),
  getSlotBookings: (date: string, startTime: string, endTime: string) =>
    request<Booking[]>(
      `/play-sessions/slot-bookings?date=${encodeURIComponent(date)}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`,
    ),
  createSessionFromSlot: (date: string, startTime: string, endTime: string, numberOfCourts?: number) =>
    request<PlaySession>('/play-sessions/from-booking-slot', {
      method: 'POST',
      body: JSON.stringify({ date, startTime, endTime, numberOfCourts }),
    }),
  getSessions: () => request<PlaySession[]>('/play-sessions'),
  getSession: (id: number) => request<PlaySession>(`/play-sessions/${id}`),
  getPublicBoard: (id: number) => request<PlaySession>(`/play-sessions/${id}/board`),
  createSession: (payload: CreatePlaySessionPayload) =>
    request<PlaySession>('/play-sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateSessionCourts: (id: number, numberOfCourts: number) =>
    request<PlaySession>(`/play-sessions/${id}/courts`, {
      method: 'PATCH',
      body: JSON.stringify({ numberOfCourts }),
    }),
  updateSessionStatus: (id: number, status: 'ACTIVE' | 'ENDED') =>
    request<PlaySession>(`/play-sessions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  addSessionPlayer: (id: number, payload: AddPlayerPayload) =>
    request<PlaySession>(`/play-sessions/${id}/players`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  removeSessionPlayer: (id: number, playerId: number) =>
    request<PlaySession>(`/play-sessions/${id}/players/${playerId}`, {
      method: 'DELETE',
    }),
  checkInSessionPlayer: (id: number, playerId: number) =>
    request<PlaySession>(`/play-sessions/${id}/players/${playerId}/check-in`, {
      method: 'PATCH',
    }),
  startMatch: (id: number, payload: StartMatchPayload) =>
    request<PlaySession>(`/play-sessions/${id}/matches`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMatchScore: (id: number, matchId: number, scoreA: number, scoreB: number) =>
    request<PlaySession>(`/play-sessions/${id}/matches/${matchId}/score`, {
      method: 'PATCH',
      body: JSON.stringify({ scoreA, scoreB }),
    }),
  endMatch: (id: number, matchId: number) =>
    request<PlaySession>(`/play-sessions/${id}/matches/${matchId}/end`, {
      method: 'PATCH',
    }),
  getEquipment: () => request<EquipmentItem[]>('/equipment'),
  updateEquipment: (id: number, payload: Partial<EquipmentItem>) =>
    request<EquipmentItem>(`/equipment/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  resetPastData: () =>
    request<{ message: string; deleted: { sessions: number; bookings: number; quickSlots: number } }>(
      '/admin/reset-past',
      { method: 'DELETE' },
    ),
  getShopItemsAdmin: () => request<ShopItem[]>('/shop/admin/items'),
  createShopItem: (payload: ShopItemPayload) =>
    request<ShopItem>('/shop/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateShopItem: (id: number, payload: Partial<ShopItemPayload>) =>
    request<ShopItem>(`/shop/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteShopItem: (id: number) =>
    request<{ id: number; deleted: boolean }>(`/shop/items/${id}`, {
      method: 'DELETE',
    }),
  uploadShopImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ url: string; publicId: string }>('/shop/items/upload-image', {
      method: 'POST',
      body: formData,
    });
  },
};
