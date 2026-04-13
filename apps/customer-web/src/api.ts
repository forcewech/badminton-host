import type {
  PublicBookingPayload,
  PublicBookingResponse,
  PublicPaymentStatus,
  QuickSlot,
} from "./types";

function getDefaultApiUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3000`;
}

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const API_URL = configuredApiUrl || getDefaultApiUrl();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormDataBody = init?.body instanceof FormData;
  const response = await fetch(`${API_URL}/api${path}`, {
    headers: {
      ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ message: "Yêu cầu thất bại." }));
    throw new Error(body.message ?? "Yêu cầu thất bại.");
  }

  return response.json() as Promise<T>;
}

export const api = {
  createBooking: (payload: PublicBookingPayload) =>
    request<PublicBookingResponse>("/bookings/public", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  uploadBookingPhoto: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    return request<{ url: string; publicId: string }>("/bookings/upload-photo", {
      method: "POST",
      body: formData,
    });
  },
  getPaymentStatus: (reference: string) =>
    request<PublicPaymentStatus>(`/bookings/public/${reference}/status`),
  getQuickSlots: (date: string) =>
    request<QuickSlot[]>(`/quick-slots?date=${encodeURIComponent(date)}`),
};
