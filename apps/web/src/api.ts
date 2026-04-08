import type {
  Booking,
  Court,
  CourtPayload,
  CreateBookingPayload,
  DashboardOverview,
  EquipmentItem,
} from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
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
  getOverview: () => request<DashboardOverview>('/dashboard/overview'),
  getCourts: () => request<Court[]>('/courts'),
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
