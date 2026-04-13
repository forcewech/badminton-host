import type {
  AuthSession,
  Booking,
  Court,
  CourtPayload,
  CreateBookingPayload,
  DashboardOverview,
  EquipmentItem,
  LoginPayload,
  QuickSlot,
  QuickSlotPayload,
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
  getQuickSlots: (date: string) =>
    request<QuickSlot[]>(`/quick-slots?date=${encodeURIComponent(date)}`),
  createQuickSlot: (payload: QuickSlotPayload) =>
    request<QuickSlot>('/quick-slots', {
      method: 'POST',
      body: JSON.stringify(payload),
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
  deleteBooking: (id: number) =>
    request<{ id: number; deleted: boolean }>(`/bookings/${id}`, {
      method: 'DELETE',
    }),
  getEquipment: () => request<EquipmentItem[]>('/equipment'),
  updateEquipment: (id: number, payload: Partial<EquipmentItem>) =>
    request<EquipmentItem>(`/equipment/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};
