import { FormEvent, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Toaster, toast } from "react-hot-toast";
import { api, setApiAccessToken } from "./api";
import type {
  AuthSession,
  Booking,
  Court,
  CourtPayload,
  CreateBookingPayload,
  CustomerGender,
  DashboardOverview,
  PublicBookingSettings,
  QuickSlot,
  SkillLevel,
} from "./types";

const AUTH_STORAGE_KEY = "badminton-host-auth";

type ToastKind = "success" | "info" | "warning" | "error";

function getLocalDateInputValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

const today = getLocalDateInputValue();

const genderOptions: CustomerGender[] = ["MALE", "FEMALE", "OTHER"];
const skillLevelOptions: SkillLevel[] = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
];

const quickTimeSlots = [
  {
    startTime: "19:00",
    endTime: "21:00",
    label: "7:00 PM - 9:00 PM",
    note: "Khung giờ tối phổ biến",
  },
  {
    startTime: "20:00",
    endTime: "22:00",
    label: "8:00 PM - 10:00 PM",
    note: "Phù hợp nhóm đi làm",
  },
  {
    startTime: "21:00",
    endTime: "23:00",
    label: "9:00 PM - 11:00 PM",
    note: "Khung giờ muộn",
  },
];

const mainSectionTabs = [
  {
    id: "management",
    label: "Quản lý sân",
    description: "Phân sân và theo dõi khách",
  },
  {
    id: "reception",
    label: "Tiếp nhận khách",
    description: "Nhập khách và tiền cọc",
  },
  {
    id: "inventory",
    label: "Danh sách sân",
    description: "Thêm, sửa và cập nhật sân",
  },
  {
    id: "quick_slots",
    label: "Khung giờ chơi",
    description: "Thêm và xóa khung giờ theo ngày",
  },
] as const;

const initialForm: CreateBookingPayload = {
  customerName: "",
  customerPhone: "",
  gender: "OTHER",
  skillLevel: "BEGINNER",
  bookingDate: today,
  startTime: "18:00",
  endTime: "19:00",
  depositAmount: 65000,
  notes: "",
  photoUrl: "",
  photoPublicId: "",
};

const initialCourtForm: CourtPayload = {
  name: "",
  zone: "",
  hourlyRate: 200000,
  isActive: true,
};

function formatQuickSlotLabel(startTime: string, endTime: string) {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

function getSkillLevelLabel(skillLevel: SkillLevel) {
  switch (skillLevel) {
    case "BEGINNER":
      return "Mới bắt đầu";
    case "INTERMEDIATE":
      return "Trung bình";
    case "ADVANCED":
      return "Nâng cao";
    default:
      return skillLevel;
  }
}

function getGenderLabel(gender: CustomerGender) {
  switch (gender) {
    case "MALE":
      return "Nam";
    case "FEMALE":
      return "Nữ";
    case "OTHER":
      return "Khác";
    default:
      return gender;
  }
}

function getMatchTracking(matchTracking?: boolean[]) {
  return Array.from(
    { length: 7 },
    (_, index) => matchTracking?.[index] ?? false,
  );
}

function normalizeCurrencyAmount(amount: number | string | null | undefined) {
  const numericAmount = Number(amount);
  return Number.isFinite(numericAmount) ? numericAmount : 0;
}

function formatCurrencyInputValue(amount: number | string) {
  const baseValue = Math.floor(normalizeCurrencyAmount(amount) / 1000);
  return baseValue.toLocaleString("en-US");
}

function formatCurrencyDisplay(amount: number | string) {
  return normalizeCurrencyAmount(amount).toLocaleString("en-US");
}

function parseCurrencyInputValue(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return Number(digits || "0") * 1000;
}

function getDisplayPhotoUrl(photoUrl?: string | null) {
  if (!photoUrl) {
    return "";
  }

  if (!photoUrl.includes("/upload/")) {
    return photoUrl;
  }

  if (photoUrl.includes("/upload/f_auto,q_auto/")) {
    return photoUrl;
  }

  return photoUrl.replace("/upload/", "/upload/f_auto,q_auto/");
}

function sortBookingsStable(bookings: Booking[]) {
  return [...bookings].sort((left, right) => {
    if (left.bookingDate !== right.bookingDate) {
      return left.bookingDate.localeCompare(right.bookingDate);
    }

    if (left.startTime !== right.startTime) {
      return left.startTime.localeCompare(right.startTime);
    }

    if (left.endTime !== right.endTime) {
      return left.endTime.localeCompare(right.endTime);
    }

    return left.id - right.id;
  });
}

function showAppToast(kind: ToastKind, title: string, message: string) {
  toast.custom(
    (toastItem) => (
      <div className={`app-toast app-toast-${kind}`}>
        <div className={`app-toast-icon app-toast-icon-${kind}`}>
          {kind === "success"
            ? "✓"
            : kind === "info"
              ? "i"
              : kind === "warning"
                ? "!"
                : "x"}
        </div>
        <div className="app-toast-copy">
          <strong>{title}</strong>
          <p>{message}</p>
        </div>
        <button
          type="button"
          className="app-toast-close"
          onClick={() => toast.remove(toastItem.id)}
          aria-label="Đóng thông báo"
        >
          ×
        </button>
      </div>
    ),
    {
      duration: 3200,
      position: "top-center",
    },
  );
}

export default function App() {
  const [publicBookingSettings, setPublicBookingSettings] =
    useState<PublicBookingSettings>({
      depositAmount: 65000,
    });
  const [activeSectionTab, setActiveSectionTab] =
    useState<(typeof mainSectionTabs)[number]["id"]>("management");
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const storedSession = window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (!storedSession) {
      return null;
    }

    try {
      return JSON.parse(storedSession) as AuthSession;
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  });
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [quickSlots, setQuickSlots] = useState<QuickSlot[]>([]);
  const [slotManagementDate, setSlotManagementDate] = useState<string>(today);
  const [slotManagementSlots, setSlotManagementSlots] = useState<QuickSlot[]>(
    [],
  );
  const [form, setForm] = useState<CreateBookingPayload>(initialForm);
  const [quickSlotDraft, setQuickSlotDraft] = useState({
    startTime: "19:00",
    endTime: "21:00",
  });
  const [selectedCourtId, setSelectedCourtId] = useState<number>(1);
  const [historyDate, setHistoryDate] = useState<string>(() =>
    getLocalDateInputValue(),
  );
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [transferFilter, setTransferFilter] = useState<
    "all" | "paid" | "unpaid"
  >("all");
  const [participationFilter, setParticipationFilter] = useState<
    "all" | "checked_in" | "no_show"
  >("all");
  const [courtForm, setCourtForm] = useState<CourtPayload>(initialCourtForm);
  const [isCourtModalOpen, setIsCourtModalOpen] = useState(false);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [fullscreenPhotoUrl, setFullscreenPhotoUrl] = useState<string | null>(
    null,
  );
  const [editingCourtId, setEditingCourtId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCourtSubmitting, setIsCourtSubmitting] = useState(false);
  const [isQuickSlotSubmitting, setIsQuickSlotSubmitting] = useState(false);
  const [isPublicBookingSettingsSubmitting, setIsPublicBookingSettingsSubmitting] =
    useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);

  useEffect(() => {
    setApiAccessToken(authSession?.accessToken ?? "");

    if (typeof window === "undefined") {
      return;
    }

    if (authSession) {
      window.localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify(authSession),
      );
    } else {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [authSession]);

  useEffect(() => {
    if (!error) {
      return;
    }

    showAppToast("error", "Something went wrong!", error);
  }, [error]);

  useEffect(() => {
    if (!loginError) {
      return;
    }

    showAppToast("warning", "Login failed", loginError);
  }, [loginError]);

  function renderCurrencyInput(
    value: number | string,
    onChange: (nextValue: number) => void,
    ariaLabel: string,
  ) {
    return (
      <div className="currency-input">
        <input
          type="text"
          inputMode="numeric"
          aria-label={ariaLabel}
          value={formatCurrencyInputValue(value)}
          onChange={(event) =>
            onChange(parseCurrencyInputValue(event.target.value))
          }
          required
        />
        <span className="currency-suffix">,000</span>
      </div>
    );
  }

  async function handlePhotoSelected(file: File | null) {
    if (!file) {
      setForm((currentForm) => ({
        ...currentForm,
        photoUrl: "",
        photoPublicId: "",
      }));
      return;
    }

    setIsPhotoUploading(true);

    try {
      const uploadResult = await api.uploadBookingPhoto(file);
      setForm((currentForm) => ({
        ...currentForm,
        photoUrl: uploadResult.url,
        photoPublicId: uploadResult.publicId,
      }));
      setError("");
      showAppToast(
        "success",
        "Tải ảnh thành công",
        "Ảnh khách đã được lưu sẵn.",
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Không thể tải ảnh khách lên",
      );
    } finally {
      setIsPhotoUploading(false);
    }
  }

  async function loadQuickSlots(bookingDate: string) {
    try {
      const quickSlotsData = await api.getQuickSlots(bookingDate);
      setQuickSlots(quickSlotsData);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "KhÃ´ng thá»ƒ táº£i khung giá» nhanh",
      );
    }
  }

  async function loadSlotManagementQuickSlots(bookingDate: string) {
    try {
      const quickSlotsData = await api.getQuickSlots(bookingDate);
      setSlotManagementSlots(quickSlotsData);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "KhÃ´ng thá»ƒ táº£i danh sÃ¡ch khung giá» theo ngÃ y",
      );
    }
  }

  async function loadData() {
    try {
      const [
        overviewData,
        courtsData,
        bookingsData,
        nextPublicBookingSettings,
      ] = await Promise.all([
        api.getOverview(),
        api.getCourts(),
        api.getBookings(),
        api.getPublicBookingSettings(),
      ]);

      setOverview(overviewData);
      setCourts(courtsData);
      setBookings(bookingsData);
      setPublicBookingSettings(nextPublicBookingSettings);
      setForm((currentForm) => ({
        ...currentForm,
        depositAmount: nextPublicBookingSettings.depositAmount,
      }));

      if (courtsData.length > 0) {
        const fallbackCourtId = courtsData.some(
          (court) => court.id === selectedCourtId,
        )
          ? selectedCourtId
          : courtsData[0].id;
        setSelectedCourtId(fallbackCourtId);
      } else {
        setSelectedCourtId(0);
      }

      setError("");
    } catch (loadError) {
      if (
        loadError instanceof Error &&
        loadError.message.includes("đăng nhập")
      ) {
        setAuthSession(null);
        setLoginError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải dữ liệu",
      );
    }
  }

  useEffect(() => {
    if (!authSession) {
      return;
    }

    void loadData();
  }, [authSession]);

  useEffect(() => {
    if (!authSession) {
      return;
    }

    void loadQuickSlots(form.bookingDate);
  }, [authSession, form.bookingDate]);

  useEffect(() => {
    if (!authSession) {
      return;
    }

    void loadSlotManagementQuickSlots(slotManagementDate);
  }, [authSession, slotManagementDate]);

  useEffect(() => {
    if (quickSlots.length === 0) {
      return;
    }

    const hasMatchingSlot = quickSlots.some(
      (slot) =>
        slot.startTime === form.startTime && slot.endTime === form.endTime,
    );

    if (hasMatchingSlot) {
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      startTime: quickSlots[0].startTime,
      endTime: quickSlots[0].endTime,
    }));
  }, [quickSlots, form.startTime, form.endTime]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoggingIn(true);

    try {
      const session = await api.login(loginForm);
      setAuthSession(session);
      setLoginError("");
      setError("");
      setLoginForm({
        username: "",
        password: "",
      });
      showAppToast("success", "Congratulations!", "Đăng nhập thành công.");
    } catch (loginSubmitError) {
      setLoginError(
        loginSubmitError instanceof Error
          ? loginSubmitError.message
          : "Không thể đăng nhập vào hệ thống.",
      );
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleLogout() {
    setAuthSession(null);
    setOverview(null);
    setCourts([]);
    setBookings([]);
    setDetailBooking(null);
    setFullscreenPhotoUrl(null);
    setError("");
    showAppToast("info", "Did you know?", "Bạn đã đăng xuất khỏi hệ thống.");
  }

  useEffect(() => {
    if (!detailBooking) {
      return;
    }

    const latestBooking = bookings.find(
      (booking) => booking.id === detailBooking.id,
    );

    if (latestBooking) {
      setDetailBooking(latestBooking);
    }
  }, [bookings, detailBooking]);

  async function handleBookingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await api.createBooking(form);
      setForm(initialForm);
      await loadData();
      showAppToast(
        "success",
        "Congratulations!",
        "Đã thêm khách vào danh sách.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Không thể tạo lượt đặt",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleQuickSlotCreate() {
    setIsQuickSlotSubmitting(true);

    try {
      await api.createQuickSlot({
        bookingDate: slotManagementDate,
        startTime: quickSlotDraft.startTime,
        endTime: quickSlotDraft.endTime,
      });
      await Promise.all([
        loadSlotManagementQuickSlots(slotManagementDate),
        form.bookingDate === slotManagementDate
          ? loadQuickSlots(slotManagementDate)
          : Promise.resolve(),
      ]);
      showAppToast(
        "success",
        "Congratulations!",
        "Thêm khung giờ chơi mới vào ngày đã chọn thành công.",
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "KhÃ´ng thá»ƒ thÃªm khung giá» nhanh",
      );
    } finally {
      setIsQuickSlotSubmitting(false);
    }
  }

  async function handleQuickSlotDelete(id: number) {
    try {
      await api.deleteQuickSlot(id);
      await Promise.all([
        loadSlotManagementQuickSlots(slotManagementDate),
        form.bookingDate === slotManagementDate
          ? loadQuickSlots(slotManagementDate)
          : Promise.resolve(),
      ]);
      showAppToast(
        "info",
        "Did you know?",
        "Đã xóa khung giờ chơi khỏi ngày đã chọn.",
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "KhÃ´ng thá»ƒ xÃ³a khung giá» nhanh",
      );
    }
  }

  async function handlePublicBookingSettingsSubmit() {
    setIsPublicBookingSettingsSubmitting(true);

    try {
      const nextSettings = await api.updatePublicBookingSettings(
        publicBookingSettings.depositAmount,
      );
      setPublicBookingSettings(nextSettings);
      setForm((currentForm) => ({
        ...currentForm,
        depositAmount: nextSettings.depositAmount,
      }));
      showAppToast(
        "success",
        "Congratulations!",
        "Đã cập nhật tiền cọc áp dụng cho booking QR ở site khách hàng.",
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Không thể cập nhật cấu hình tiền cọc QR",
      );
    } finally {
      setIsPublicBookingSettingsSubmitting(false);
    }
  }

  async function handleAssignCourt(id: number) {
    if (!selectedCourtId) {
      setError("Vui lòng tạo sân trước khi phân khách.");
      return;
    }

    try {
      await api.assignCourt(id, selectedCourtId);
      await loadData();
      showAppToast("success", "Congratulations!", "Đã phân sân cho khách.");
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Phân sân thất bại",
      );
    }
  }

  async function handleCheckIn(id: number) {
    try {
      await api.checkIn(id);
      await loadData();
      showAppToast("success", "Congratulations!", "Đã check-in khách.");
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Check-in thất bại",
      );
    }
  }

  async function handleFullPayment(id: number) {
    try {
      await api.confirmFullPayment(id);
      await loadData();
      showAppToast("success", "Congratulations!", "Đã xác nhận thanh toán đủ.");
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Cập nhật thanh toán đủ thất bại",
      );
    }
  }

  async function handleNoShow(id: number) {
    try {
      await api.markNoShow(id);
      await loadData();
      showAppToast("warning", "Warning!", "Khách đã được đánh dấu không đến.");
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Cập nhật trạng thái không đến thất bại",
      );
    }
  }

  async function handleDeleteBooking(id: number) {
    try {
      await api.deleteBooking(id);
      await loadData();
      showAppToast("info", "Did you know?", "Đã xóa booking của khách.");
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Xóa lượt đặt thất bại",
      );
    }
  }

  async function handleMatchTracking(
    id: number,
    slot: number,
    checked: boolean,
  ) {
    try {
      await api.updateMatchTracking(id, slot, checked);
      await loadData();
      showAppToast(
        "info",
        "Did you know?",
        checked
          ? "Đã đánh dấu hoàn thành lượt chơi."
          : "Đã bỏ đánh dấu lượt chơi.",
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Cập nhật lượt chơi thất bại",
      );
    }
  }

  function openCreateCourtModal() {
    setEditingCourtId(null);
    setCourtForm(initialCourtForm);
    setIsCourtModalOpen(true);
  }

  function openEditCourtModal(court: Court) {
    setEditingCourtId(court.id);
    setCourtForm({
      name: court.name,
      zone: court.zone,
      hourlyRate: Number(court.hourlyRate),
      isActive: court.isActive,
    });
    setIsCourtModalOpen(true);
  }

  function closeCourtModal() {
    setIsCourtModalOpen(false);
    setEditingCourtId(null);
    setCourtForm(initialCourtForm);
  }

  async function handleCourtSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCourtSubmitting(true);

    try {
      if (editingCourtId) {
        await api.updateCourt(editingCourtId, courtForm);
        showAppToast(
          "success",
          "Congratulations!",
          "Đã cập nhật thông tin sân.",
        );
      } else {
        await api.createCourt(courtForm);
        showAppToast("success", "Congratulations!", "Đã thêm sân mới.");
      }

      closeCourtModal();
      await loadData();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Cập nhật sân thất bại",
      );
    } finally {
      setIsCourtSubmitting(false);
    }
  }

  async function handleDeleteCourt(id: number) {
    try {
      await api.deleteCourt(id);
      await loadData();
      showAppToast("info", "Did you know?", "Đã xóa sân khỏi danh sách.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Xóa sân thất bại",
      );
    }
  }

  function renderAssignedBookingCard(
    booking: Booking,
    className = "booking-card",
  ) {
    return (
      <article
        key={booking.id}
        className={`${className} booking-card-clickable ${booking.gender === "FEMALE" ? "booking-card-female" : ""}`}
        onClick={() => setDetailBooking(booking)}
      >
        <div className="booking-card-top">
          <div>
            <h3>{booking.customerName}</h3>
            <p>
              {booking.bookingDate} - {booking.startTime} đến {booking.endTime}
            </p>
          </div>
          <span className={`status status-${booking.status.toLowerCase()}`}>
            {booking.status}
          </span>
        </div>

        <div className="booking-meta">
          {booking.customerPhone ? <span>{booking.customerPhone}</span> : null}
          <span>{getGenderLabel(booking.gender)}</span>
          <span>{getSkillLevelLabel(booking.skillLevel)}</span>
          <span>
            Cọc {booking.depositPaid ? "đã thanh toán" : "đang chờ"} (
            {formatCurrencyDisplay(booking.depositAmount)})
          </span>
          <span>
            Thanh toán đủ{" "}
            {booking.fullPaymentTransferred ? "đã xác nhận" : "đang chờ"}
          </span>
        </div>

        {booking.notes ? (
          <div className="booking-note">
            <strong>Ghi chú:</strong> {booking.notes}
          </div>
        ) : null}

        <div
          className="booking-actions"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="primary-button"
            disabled={
              booking.status === "CHECKED_IN" ||
              booking.status === "COMPLETED" ||
              booking.status === "NO_SHOW"
            }
            onClick={() => handleCheckIn(booking.id)}
          >
            Check-in
          </button>
          <button
            type="button"
            className="success-button"
            disabled={
              booking.status !== "CHECKED_IN" || booking.fullPaymentTransferred
            }
            onClick={() => handleFullPayment(booking.id)}
          >
            Xác nhận thanh toán đủ
          </button>
          <button
            type="button"
            className="warning-button"
            disabled={
              !booking.depositPaid ||
              booking.status === "CHECKED_IN" ||
              booking.status === "COMPLETED" ||
              booking.status === "NO_SHOW"
            }
            onClick={() => handleNoShow(booking.id)}
          >
            Không đến
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => handleDeleteBooking(booking.id)}
          >
            Xóa đặt sân
          </button>
        </div>

        <div
          className="match-tracking"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="match-tracking-head">
            <span className="selected-court-label">
              Theo dõi trận & trình độ sân nhóm
            </span>
            <strong>
              {getMatchTracking(booking.matchTracking).filter(Boolean).length}/7
              lượt
            </strong>
          </div>
          <div className="match-tracking-grid">
            {getMatchTracking(booking.matchTracking).map((checked, index) => (
              <label
                key={index}
                className={checked ? "match-box checked" : "match-box"}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) =>
                    void handleMatchTracking(
                      booking.id,
                      index,
                      event.target.checked,
                    )
                  }
                />
                <span>Lượt {index + 1}</span>
              </label>
            ))}
          </div>
        </div>
      </article>
    );
  }

  const selectedCourt =
    courts.find((court) => court.id === selectedCourtId) ?? courts[0];
  const unassignedBookings = sortBookingsStable(
    bookings
      .filter((booking) => booking.bookingDate === historyDate)
      .filter((booking) => booking.depositPaid)
      .filter((booking) => booking.status === "CONFIRMED")
      .filter((booking) => booking.court === null)
      .filter((booking) =>
        booking.customerName
          .toLowerCase()
          .includes(searchTerm.trim().toLowerCase()),
      ),
  );

  const courtBookings = sortBookingsStable(
    bookings.filter((booking) => booking.court?.id === selectedCourt?.id),
  );
  const historyBookings = sortBookingsStable(
    courtBookings
      .filter((booking) => booking.bookingDate === historyDate)
      .filter((booking) =>
        booking.customerName
          .toLowerCase()
          .includes(searchTerm.trim().toLowerCase()),
      )
      .filter((booking) => {
        if (transferFilter === "paid") {
          return booking.fullPaymentTransferred;
        }

        if (transferFilter === "unpaid") {
          return !booking.fullPaymentTransferred;
        }

        return true;
      })
      .filter((booking) => {
        if (participationFilter === "checked_in") {
          return (
            booking.status === "CHECKED_IN" || booking.status === "COMPLETED"
          );
        }

        if (participationFilter === "no_show") {
          return booking.status === "NO_SHOW";
        }

        return true;
      }),
  );

  function exportHistoryToExcel() {
    const rows = historyBookings.map((booking) => ({
      "Tên sân": booking.court?.name ?? "Chưa phân sân",
      Ngày: booking.bookingDate,
      "Giờ bắt đầu": booking.startTime,
      "Giờ kết thúc": booking.endTime,
      "Tên khách hàng": booking.customerName,
      "Giới tính": getGenderLabel(booking.gender),
      "Trình độ": getSkillLevelLabel(booking.skillLevel),
      "Số điện thoại": booking.customerPhone,
      "Số tiền cọc": booking.depositAmount,
      "Đã thanh toán cọc": booking.depositPaid ? "Có" : "Không",
      "Đã chuyển khoản": booking.fullPaymentTransferred ? "Có" : "Không",
      "Lượt đã chơi": getMatchTracking(booking.matchTracking).filter(Boolean)
        .length,
      "Trạng thái": booking.status,
      "Ghi chú": booking.notes,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "QuảnLýSân");
    XLSX.writeFile(
      workbook,
      `${selectedCourt?.name ?? "sân"}-${historyDate}-quản-lý.xlsx`,
    );
  }

  return (
    <div className="shell">
      <Toaster
        position="top-center"
        gutter={14}
        containerStyle={{
          top: 20,
          left: 16,
          right: 16,
        }}
      />
      <header className="hero">
        <div>
          <p className="eyebrow">Quản Lý Sân Cầu Lông</p>
          <h1>
            Tiếp nhận khách, sắp xếp sân và vận hành trong một giao diện duy
            nhất.
          </h1>
          <p className="intro">
            Nhập danh sách khách đã đặt và đã cọc trước, sau đó phân sân cho
            từng khách khi bạn sẵn sàng.
          </p>
        </div>
        <div className="hero-note">
          <span>Thông tin nhanh</span>
          <strong>
            {overview?.totals.todaysBookings ?? 0} lượt đặt hôm nay
          </strong>
          <p>
            {unassignedBookings.length} khách đang chờ phân sân và{" "}
            {overview?.totals.pendingTransfers ?? 0} giao dịch còn chờ xác nhận.
          </p>
          {authSession ? (
            <button
              type="button"
              className="ghost-button auth-logout"
              onClick={handleLogout}
            >
              Đăng xuất
            </button>
          ) : null}
        </div>
      </header>

      {!authSession ? (
        <div className="modal-backdrop auth-backdrop" role="presentation">
          <div
            className="modal-card auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="auth-modal-copy">
              <p className="panel-tag">Chào mừng</p>
              <h2 id="auth-modal-title">Chào mừng đến với web</h2>
              <p>
                Vui lòng đăng nhập trước khi sử dụng hệ thống quản lý sân cầu
                lông.
              </p>
            </div>

            <form className="booking-form auth-form" onSubmit={handleLogin}>
              <label>
                Tài khoản
                <input
                  value={loginForm.username}
                  onChange={(event) =>
                    setLoginForm({
                      ...loginForm,
                      username: event.target.value,
                    })
                  }
                  placeholder=""
                  required
                />
              </label>
              <label>
                Mật khẩu
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm({
                      ...loginForm,
                      password: event.target.value,
                    })
                  }
                  placeholder=""
                  required
                />
              </label>
              {loginError ? (
                <div className="alert auth-alert">{loginError}</div>
              ) : null}
              <button
                type="submit"
                className="primary-button"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {error ? <div className="alert">{error}</div> : null}

      <section className="stats-grid">
        <StatCard
          label="Sân đang hoạt động"
          value={overview?.totals.courts ?? 0}
        />
        <StatCard
          label="Lượt đặt hôm nay"
          value={overview?.totals.todaysBookings ?? 0}
        />
        <StatCard label="Chờ phân sân" value={unassignedBookings.length} />
        <StatCard
          label="Chờ xác nhận chuyển khoản"
          value={overview?.totals.pendingTransfers ?? 0}
        />
      </section>

      <nav className="section-tabs" aria-label="Điều hướng khu vực chính">
        {mainSectionTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={
              activeSectionTab === tab.id
                ? "section-tab-button active"
                : "section-tab-button"
            }
            onClick={() => setActiveSectionTab(tab.id)}
          >
            <span>{tab.label}</span>
            <small>{tab.description}</small>
          </button>
        ))}
      </nav>

      <main className="tab-panel-shell">
        {activeSectionTab === "reception" ? (
          <section className="panel panel-form">
            <div className="panel-head">
              <div>
                <p className="panel-tag">Tiếp nhận khách</p>
                <h2>Nhập danh sách khách đã cọc</h2>
              </div>
            </div>

            <div className="grid-two qr-settings-grid">
              <article className="selected-court-card qr-settings-card">
                <span className="selected-court-label qr-settings-label">
                  Cấu hình cọc booking QR
                </span>
                <strong className="qr-settings-value">
                  {formatCurrencyDisplay(publicBookingSettings.depositAmount)}{" "}
                  VND
                </strong>
                <small className="qr-settings-description">
                  Mức này áp dụng cho site khách hàng khi tạo booking và sinh mã QR chuyển khoản mới.
                </small>
              </article>

              <article className="selected-court-card qr-settings-card">
                <label className="qr-settings-input-label">
                  Tiền cọc áp dụng cho site khách hàng
                  {renderCurrencyInput(
                    publicBookingSettings.depositAmount,
                    (depositAmount) =>
                      setPublicBookingSettings((currentSettings) => ({
                        ...currentSettings,
                        depositAmount,
                      })),
                    "Tiền cọc booking QR",
                  )}
                </label>
                <div className="quick-slot-admin-actions qr-settings-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void handlePublicBookingSettingsSubmit()}
                    disabled={isPublicBookingSettingsSubmitting}
                  >
                    {isPublicBookingSettingsSubmitting
                      ? "Đang lưu mức cọc..."
                      : "Lưu tiền cọc QR"}
                  </button>
                </div>
              </article>
            </div>

            <form className="booking-form" onSubmit={handleBookingSubmit}>
              <div className="grid-two">
                <label>
                  Tên khách hàng
                  <input
                    value={form.customerName}
                    onChange={(event) =>
                      setForm({ ...form, customerName: event.target.value })
                    }
                    placeholder="Nguyễn Văn A"
                    required
                  />
                </label>
                <label>
                  Số điện thoại
                  <input
                    value={form.customerPhone}
                    onChange={(event) =>
                      setForm({ ...form, customerPhone: event.target.value })
                    }
                    placeholder="0812345678"
                  />
                </label>
              </div>

              <div className="grid-two">
                <label>
                  Giới tính
                  <select
                    value={form.gender}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        gender: event.target.value as CustomerGender,
                      })
                    }
                  >
                    {genderOptions.map((gender) => (
                      <option key={gender} value={gender}>
                        {getGenderLabel(gender)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Trình độ
                  <select
                    value={form.skillLevel}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        skillLevel: event.target.value as SkillLevel,
                      })
                    }
                  >
                    {skillLevelOptions.map((skillLevel) => (
                      <option key={skillLevel} value={skillLevel}>
                        {getSkillLevelLabel(skillLevel)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid-two">
                <label>
                  Ngày đặt
                  <input
                    type="date"
                    value={form.bookingDate}
                    onChange={(event) =>
                      setForm({ ...form, bookingDate: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Tiền cọc
                  {renderCurrencyInput(
                    form.depositAmount,
                    (depositAmount) =>
                      setForm({
                        ...form,
                        depositAmount,
                      }),
                    "Tiền cọc",
                  )}
                </label>
              </div>

              <div className="grid-two">
                <label>
                  Giờ bắt đầu
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                      setForm({ ...form, startTime: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Giờ kết thúc
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) =>
                      setForm({ ...form, endTime: event.target.value })
                    }
                    required
                  />
                </label>
              </div>

              <div className="time-slot-picker">
                <div className="panel-subhead">
                  <div>
                    <p className="panel-tag">Khung giờ chơi</p>
                    <h3>Chọn nhanh thời gian chơi</h3>
                  </div>
                </div>
                <div className="time-slot-grid">
                  {quickSlots.map((slot) => {
                    const isActive =
                      form.startTime === slot.startTime &&
                      form.endTime === slot.endTime;

                    return (
                      <button
                        key={`${slot.startTime}-${slot.endTime}`}
                        type="button"
                        className={
                          isActive
                            ? "time-slot-button active"
                            : "time-slot-button"
                        }
                        onClick={() =>
                          setForm({
                            ...form,
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                          })
                        }
                      >
                        <span className="time-slot-label">
                          {formatQuickSlotLabel(slot.startTime, slot.endTime)}
                        </span>
                        <small className="time-slot-meta">
                          {form.bookingDate}
                        </small>
                      </button>
                    );
                  })}
                </div>
                {quickSlots.length === 0 ? (
                  <p className="empty-state">
                    Chưa có khung giờ chơi cho ngày này. Hãy vào tab `Khung giờ
                    nhanh` để tạo trước khi tiếp nhận khách.
                  </p>
                ) : null}
              </div>

              <label>
                Ghi chú
                <input
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                  placeholder="Thuê vợt, đến muộn, nhóm mới"
                />
              </label>

              <label>
                Ảnh khách hàng (tùy chọn)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    void handlePhotoSelected(event.target.files?.[0] ?? null)
                  }
                />
              </label>

              <div className="photo-upload-card">
                <div className="avatar-frame avatar-frame-sm">
                  {form.photoUrl ? (
                    <img
                      src={getDisplayPhotoUrl(form.photoUrl)}
                      alt="Ảnh khách đang chọn"
                      className="avatar-image"
                    />
                  ) : (
                    <div className="avatar-placeholder avatar-placeholder-sm" />
                  )}
                </div>
                <div className="photo-upload-copy">
                  <strong>
                    {isPhotoUploading
                      ? "Đang tải ảnh lên..."
                      : "Ảnh đại diện khách"}
                  </strong>
                  <small>
                    {form.photoUrl
                      ? "Ảnh đã sẵn sàng và sẽ được lưu cùng thông tin khách."
                      : "Có thể bỏ qua nếu khách không cung cấp ảnh."}
                  </small>
                </div>
              </div>

              <div className="selected-court-card">
                <span className="selected-court-label">Quy trình</span>
                <strong>
                  Tiền cọc được ghi nhận đã thanh toán khi thêm khách
                </strong>
                <small>Phân sân sau trong mục Quản lý sân.</small>
              </div>

              <button
                className="primary-button"
                type="submit"
                disabled={isSubmitting || isPhotoUploading}
              >
                {isSubmitting || isPhotoUploading
                  ? "Đang lưu..."
                  : "Thêm khách đặt sân"}
              </button>
            </form>
          </section>
        ) : null}

        {activeSectionTab === "management" ? (
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-tag">Quản lý sân</p>
                <h2>
                  {selectedCourt
                    ? `${selectedCourt.name} - phân sân`
                    : "Quản lý sân"}
                </h2>
              </div>
            </div>

            <div
              className="court-tabs"
              role="tablist"
              aria-label="Danh sách sân"
            >
              {courts.map((court) => (
                <button
                  key={court.id}
                  type="button"
                  className={
                    court.id === selectedCourtId
                      ? "court-tab active"
                      : "court-tab"
                  }
                  onClick={() => setSelectedCourtId(court.id)}
                >
                  <span>{court.name}</span>
                  <small>{court.zone}</small>
                </button>
              ))}
            </div>

            <div className="management-toolbar">
              <label className="history-filter">
                <span>Ngày xem</span>
                <input
                  type="date"
                  value={historyDate}
                  onChange={(event) => setHistoryDate(event.target.value)}
                />
              </label>
              <label className="history-filter">
                <span>Tìm khách hàng</span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Nhập tên khách hàng"
                />
              </label>
              <label className="history-filter">
                <span>Thanh toán đủ</span>
                <select
                  value={transferFilter}
                  onChange={(event) =>
                    setTransferFilter(
                      event.target.value as "all" | "paid" | "unpaid",
                    )
                  }
                >
                  <option value="all">Tất cả khách</option>
                  <option value="paid">Đã thanh toán đủ</option>
                  <option value="unpaid">Chưa thanh toán đủ</option>
                </select>
              </label>
              <label className="history-filter">
                <span>Tham gia</span>
                <select
                  value={participationFilter}
                  onChange={(event) =>
                    setParticipationFilter(
                      event.target.value as "all" | "checked_in" | "no_show",
                    )
                  }
                >
                  <option value="all">Tất cả khách</option>
                  <option value="checked_in">Đã check-in</option>
                  <option value="no_show">Không đến</option>
                </select>
              </label>
              <button
                type="button"
                className="success-button export-button"
                onClick={exportHistoryToExcel}
              >
                Xuất Excel
              </button>
            </div>

            <div className="assignment-queue">
              <div className="panel-subhead history-subhead">
                <p className="panel-tag">Danh sách chờ</p>
                <div className="history-subhead-row">
                  <h3>Khách hàng đang chờ phân sân</h3>
                  <button
                    type="button"
                    className="ghost-button view-button"
                    onClick={() => setIsQueueModalOpen(true)}
                  >
                    <span className="view-icon" aria-hidden="true">
                      👁
                    </span>
                    <span>Xem</span>
                  </button>
                </div>
              </div>
              <div className="queue-list">
                {unassignedBookings.length === 0 ? (
                  <p className="empty-state">
                    Không có khách nào chờ phân sân trong ngày này.
                  </p>
                ) : (
                  unassignedBookings.map((booking) => (
                    <article
                      key={booking.id}
                      className={`booking-card compact-card booking-card-clickable ${booking.gender === "FEMALE" ? "booking-card-female" : ""}`}
                      onClick={() => setDetailBooking(booking)}
                    >
                      <div className="booking-card-top">
                        <div>
                          <h3>{booking.customerName}</h3>
                          <p>
                            {getGenderLabel(booking.gender)} -{" "}
                            {getSkillLevelLabel(booking.skillLevel)}
                          </p>
                        </div>
                        <span
                          className={`status status-${booking.status.toLowerCase()}`}
                        >
                          {booking.status}
                        </span>
                      </div>
                      <div className="booking-meta">
                        {booking.customerPhone ? (
                          <span>{booking.customerPhone}</span>
                        ) : null}
                        <span>
                          Đã cọc ({formatCurrencyDisplay(booking.depositAmount)}
                          )
                        </span>
                        <span>
                          {booking.startTime} - {booking.endTime}
                        </span>
                      </div>
                      {booking.notes ? (
                        <div className="booking-note">
                          <strong>Ghi chú:</strong> {booking.notes}
                        </div>
                      ) : null}
                      <div
                        className="booking-actions"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="primary-button"
                          disabled={!selectedCourtId}
                          onClick={() => handleAssignCourt(booking.id)}
                        >
                          Phân vào {selectedCourt?.name ?? "sân"}
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => handleDeleteBooking(booking.id)}
                        >
                          Xóa đặt sân
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="panel-subhead history-subhead">
              <p className="panel-tag">Lịch sử đã phân</p>
              <div className="history-subhead-row">
                <h3>
                  {selectedCourt
                    ? `${selectedCourt.name} - danh sách khách`
                    : "Khách đã phân sân"}
                </h3>
                <button
                  type="button"
                  className="ghost-button view-button"
                  onClick={() => setIsHistoryModalOpen(true)}
                >
                  <span className="view-icon" aria-hidden="true">
                    👁
                  </span>
                  <span>Xem</span>
                </button>
              </div>
            </div>

            <div className="schedule-list">
              {historyBookings.length === 0 ? (
                <p className="empty-state">
                  Không có khách nào được phân vào sân này trong ngày này.
                </p>
              ) : (
                historyBookings.map((booking) =>
                  renderAssignedBookingCard(booking),
                )
              )}
            </div>
          </section>
        ) : null}
      </main>

      {activeSectionTab === "inventory" ? (
        <section className="court-inventory-section">
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-tag">Danh sách sân</p>
                <h2>Sân</h2>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={openCreateCourtModal}
              >
                Thêm sân
              </button>
            </div>

            <div className="court-grid">
              {courts.map((court) => (
                <article key={court.id} className="court-card">
                  <h3>{court.name}</h3>
                  <p>{court.zone}</p>
                  <ul>
                    <li>
                      Giá: {formatCurrencyDisplay(court.hourlyRate)} THB/giờ
                    </li>
                    <li>
                      Trạng thái:{" "}
                      {court.isActive ? "Đang hoạt động" : "Tạm dừng"}
                    </li>
                  </ul>
                  <div className="court-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => openEditCourtModal(court)}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="warning-button"
                      onClick={() => handleDeleteCourt(court.id)}
                    >
                      Xóa
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : null}

      {activeSectionTab === "quick_slots" ? (
        <section className="court-inventory-section">
          <section className="panel quick-slots-panel">
            <div className="panel-head">
              <div>
                <p className="panel-tag">Khung giờ chơi</p>
                <h2>Quản lý khung giờ chơi theo ngày</h2>
              </div>
            </div>

            <div className="quick-slots-layout">
              <article className="quick-slots-editor">
                <div className="quick-slots-date-card">
                  <label>
                    Ngày áp dụng
                    <input
                      type="date"
                      value={slotManagementDate}
                      onChange={(event) =>
                        setSlotManagementDate(event.target.value)
                      }
                      required
                    />
                  </label>
                  <p className="quick-slots-helper">
                    Chọn ngày, thêm khung giờ và khách ở site công khai sẽ nhìn
                    thấy đúng các lựa chọn này trong ngày tương ứng.
                  </p>
                </div>

                <div className="quick-slots-create-card">
                  <div className="panel-subhead">
                    <div>
                      <p className="panel-tag">Tạo mới</p>
                      <h3>Thêm khung giờ cho {slotManagementDate}</h3>
                    </div>
                  </div>

                  <div className="grid-two">
                    <label>
                      Giờ bắt đầu
                      <input
                        type="time"
                        value={quickSlotDraft.startTime}
                        onChange={(event) =>
                          setQuickSlotDraft({
                            ...quickSlotDraft,
                            startTime: event.target.value,
                          })
                        }
                        required
                      />
                    </label>
                    <label>
                      Giờ kết thúc
                      <input
                        type="time"
                        value={quickSlotDraft.endTime}
                        onChange={(event) =>
                          setQuickSlotDraft({
                            ...quickSlotDraft,
                            endTime: event.target.value,
                          })
                        }
                        required
                      />
                    </label>
                  </div>

                  <div className="quick-slot-admin-actions">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void handleQuickSlotCreate()}
                      disabled={isQuickSlotSubmitting}
                    >
                      {isQuickSlotSubmitting
                        ? "Đang thêm khung giờ..."
                        : "Thêm khung giờ chơi"}
                    </button>
                  </div>
                </div>
              </article>

              <article className="quick-slots-list-card">
                <div className="panel-subhead">
                  <div>
                    <p className="panel-tag">Danh sách theo ngày</p>
                    <h3>{slotManagementDate}</h3>
                  </div>
                </div>

                <div className="quick-slot-admin-list">
                  {slotManagementSlots.length === 0 ? (
                    <p className="empty-state">
                      Chưa có khung giờ nào cho ngày này.
                    </p>
                  ) : (
                    slotManagementSlots.map((slot) => (
                      <div key={slot.id} className="quick-slot-admin-item">
                        <div>
                          <strong>
                            {formatQuickSlotLabel(slot.startTime, slot.endTime)}
                          </strong>
                          <small>{slot.bookingDate}</small>
                        </div>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => void handleQuickSlotDelete(slot.id)}
                        >
                          Xóa
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </div>
          </section>
        </section>
      ) : null}

      {isCourtModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeCourtModal}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="court-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-head">
              <div>
                <p className="panel-tag">Danh sách sân</p>
                <h2 id="court-modal-title">
                  {editingCourtId ? "Sửa sân" : "Thêm sân"}
                </h2>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={closeCourtModal}
              >
                Đóng
              </button>
            </div>

            <form className="booking-form" onSubmit={handleCourtSubmit}>
              <div className="grid-two">
                <label>
                  Tên sân
                  <input
                    value={courtForm.name}
                    onChange={(event) =>
                      setCourtForm({ ...courtForm, name: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Khu vực
                  <input
                    value={courtForm.zone}
                    onChange={(event) =>
                      setCourtForm({ ...courtForm, zone: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Giá theo giờ
                  {renderCurrencyInput(
                    courtForm.hourlyRate,
                    (hourlyRate) =>
                      setCourtForm({
                        ...courtForm,
                        hourlyRate,
                      }),
                    "Giá theo giờ",
                  )}
                </label>
              </div>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={courtForm.isActive}
                  onChange={(event) =>
                    setCourtForm({
                      ...courtForm,
                      isActive: event.target.checked,
                    })
                  }
                />
                <span>Sân đang hoạt động</span>
              </label>

              <button
                className="primary-button"
                type="submit"
                disabled={isCourtSubmitting}
              >
                {isCourtSubmitting
                  ? "Đang lưu..."
                  : editingCourtId
                    ? "Lưu thay đổi"
                    : "Tạo sân"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {detailBooking ? (
        <div
          className="modal-backdrop customer-detail-backdrop"
          role="presentation"
          onClick={() => setDetailBooking(null)}
        >
          <div
            className="modal-card customer-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-head">
              <div>
                <p className="panel-tag">Chi tiết khách</p>
                <h2 id="customer-detail-title">{detailBooking.customerName}</h2>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setDetailBooking(null)}
              >
                Đóng
              </button>
            </div>

            <div className="customer-detail-layout">
              <button
                type="button"
                className="avatar-button"
                onClick={() =>
                  detailBooking.photoUrl
                    ? setFullscreenPhotoUrl(detailBooking.photoUrl)
                    : undefined
                }
                disabled={!detailBooking.photoUrl}
              >
                <div className="avatar-frame avatar-frame-lg">
                  {detailBooking.photoUrl ? (
                    <img
                      src={getDisplayPhotoUrl(detailBooking.photoUrl)}
                      alt={`Ảnh của ${detailBooking.customerName}`}
                      className="avatar-image"
                    />
                  ) : (
                    <div className="avatar-placeholder avatar-placeholder-lg" />
                  )}
                </div>
              </button>

              <div className="customer-detail-grid">
                <div className="customer-detail-item">
                  <span>Trạng thái</span>
                  <strong>{detailBooking.status}</strong>
                </div>
                <div className="customer-detail-item">
                  <span>Giới tính</span>
                  <strong>{getGenderLabel(detailBooking.gender)}</strong>
                </div>
                <div className="customer-detail-item">
                  <span>Trình độ</span>
                  <strong>
                    {getSkillLevelLabel(detailBooking.skillLevel)}
                  </strong>
                </div>
                <div className="customer-detail-item">
                  <span>Số điện thoại</span>
                  <strong>{detailBooking.customerPhone || "Không có"}</strong>
                </div>
                <div className="customer-detail-item">
                  <span>Ngày chơi</span>
                  <strong>{detailBooking.bookingDate}</strong>
                </div>
                <div className="customer-detail-item">
                  <span>Khung giờ</span>
                  <strong>{`${detailBooking.startTime} - ${detailBooking.endTime}`}</strong>
                </div>
                <div className="customer-detail-item">
                  <span>Tiền cọc</span>
                  <strong>
                    {formatCurrencyDisplay(detailBooking.depositAmount)}
                  </strong>
                </div>
                <div className="customer-detail-item">
                  <span>Sân</span>
                  <strong>
                    {detailBooking.court?.name ?? "Chưa phân sân"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="customer-detail-note">
              <span className="selected-court-label">Ghi chú</span>
              <p>{detailBooking.notes || "Không có ghi chú."}</p>
            </div>
          </div>
        </div>
      ) : null}

      {fullscreenPhotoUrl ? (
        <div
          className="modal-backdrop photo-lightbox"
          role="presentation"
          onClick={() => setFullscreenPhotoUrl(null)}
        >
          <div
            className="photo-lightbox-card"
            role="dialog"
            aria-modal="true"
            aria-label="Ảnh khách toàn màn hình"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="ghost-button photo-lightbox-close"
              onClick={() => setFullscreenPhotoUrl(null)}
            >
              Đóng
            </button>
            <img
              src={getDisplayPhotoUrl(fullscreenPhotoUrl)}
              alt="Ảnh khách toàn màn hình"
              className="photo-lightbox-image"
            />
          </div>
        </div>
      ) : null}

      {isQueueModalOpen ? (
        <div
          className="modal-backdrop modal-backdrop-wide"
          role="presentation"
          onClick={() => setIsQueueModalOpen(false)}
        >
          <div
            className="modal-card modal-card-fullscreen"
            role="dialog"
            aria-modal="true"
            aria-labelledby="queue-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-head modal-head-sticky">
              <div>
                <h2 id="queue-modal-title">{`Danh sách chờ - ${historyDate}`}</h2>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsQueueModalOpen(false)}
              >
                Đóng
              </button>
            </div>

            <div className="fullscreen-history-list">
              {unassignedBookings.length === 0 ? (
                <p className="empty-state">
                  Không có khách nào chờ phân sân trong ngày này.
                </p>
              ) : (
                unassignedBookings.map((booking) => (
                  <article
                    key={booking.id}
                    className={`booking-card compact-card stadium-card booking-card-clickable ${booking.gender === "FEMALE" ? "booking-card-female" : ""}`}
                    onClick={() => setDetailBooking(booking)}
                  >
                    <div className="booking-card-top">
                      <div>
                        <h3>{booking.customerName}</h3>
                        <p>
                          {getGenderLabel(booking.gender)} -{" "}
                          {getSkillLevelLabel(booking.skillLevel)}
                        </p>
                      </div>
                      <span
                        className={`status status-${booking.status.toLowerCase()}`}
                      >
                        {booking.status}
                      </span>
                    </div>
                    <div className="booking-meta">
                      <span>{booking.bookingDate}</span>
                      <span>
                        {booking.startTime} đến {booking.endTime}
                      </span>
                      {booking.depositPaid ? (
                        <span>
                          Cọc đã thanh toán (
                          {formatCurrencyDisplay(booking.depositAmount)})
                        </span>
                      ) : (
                        <span>Chưa thanh toán cọc</span>
                      )}
                    </div>
                    {booking.notes ? (
                      <div className="booking-note">
                        <strong>Ghi chú</strong>
                        <p>{booking.notes}</p>
                      </div>
                    ) : null}
                    <div
                      className="booking-actions"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {selectedCourt ? (
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => handleAssignCourt(booking.id)}
                        >
                          Phân vào {selectedCourt.name}
                        </button>
                      ) : (
                        <button type="button" className="ghost-button" disabled>
                          Chọn sân để phân
                        </button>
                      )}
                      <button
                        type="button"
                        className="warning-button"
                        onClick={() => handleDeleteBooking(booking.id)}
                      >
                        Xóa đặt sân
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isHistoryModalOpen ? (
        <div
          className="modal-backdrop modal-backdrop-wide"
          role="presentation"
          onClick={() => setIsHistoryModalOpen(false)}
        >
          <div
            className="modal-card modal-card-fullscreen"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-head modal-head-sticky">
              <div>
                <h2 id="history-modal-title">
                  {`Theo dõi sân - ${selectedCourt?.name ?? "Sân chưa chọn"} - ${historyDate}`}
                </h2>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsHistoryModalOpen(false)}
              >
                Đóng
              </button>
            </div>

            <div className="fullscreen-history-list">
              {historyBookings.length === 0 ? (
                <p className="empty-state">
                  Không có khách nào được phân vào sân này trong ngày này.
                </p>
              ) : (
                historyBookings.map((booking) =>
                  renderAssignedBookingCard(
                    booking,
                    "booking-card stadium-card",
                  ),
                )
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: number;
};

function StatCard({ label, value }: StatCardProps) {
  return (
    <article className="stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
