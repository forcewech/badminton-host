import { FormEvent, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Toaster, toast } from "react-hot-toast";
import { api, setApiAccessToken } from "./api";
import type {
  AuthSession,
  Booking,
  BookingSlot,
  CreateBookingPayload,
  CustomerGender,
  DashboardOverview,
  PlaySession,
  PlayerSkillLevel,
  PublicBookingSettings,
  QuickSlot,
  SkillLevel,
  TeamOption,
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
    description: "Theo dõi khách và trạng thái",
  },
  {
    id: "reception",
    label: "Tiếp nhận khách",
    description: "Nhập khách và tiền cọc",
  },
  {
    id: "quick_slots",
    label: "Khung giờ chơi",
    description: "Thêm và xóa khung giờ theo ngày",
  },
  {
    id: "transactions",
    label: "Giao dịch",
    description: "Tra cứu và xử lý giao dịch cọc QR",
  },
  {
    id: "coordination",
    label: "Điều phối",
    description: "Ghép cặp và điều phối buổi chơi",
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

function formatQuickSlotLabel(startTime: string, endTime: string) {
  return `${startTime} - ${endTime}`;
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

type TransactionFilter =
  | "all"
  | "success"
  | "pending"
  | "expired"
  | "paid_while_cancelled";

function getTransactionStatus(
  booking: Booking,
): "success" | "pending" | "expired" | "paid_while_cancelled" {
  if (booking.depositReceivedWhileCancelled) return "paid_while_cancelled";
  if (booking.depositPaid && booking.status !== "CANCELLED") return "success";
  if (booking.status === "PENDING") return "pending";
  return "expired";
}

function getTransactionStatusLabel(
  status: ReturnType<typeof getTransactionStatus>,
) {
  switch (status) {
    case "success":
      return "Thành công";
    case "pending":
      return "Đang chờ";
    case "expired":
      return "Hết hạn";
    case "paid_while_cancelled":
      return "Cần xử lý";
  }
}

function getTransactionStatusCssClass(
  status: ReturnType<typeof getTransactionStatus>,
) {
  switch (status) {
    case "success":
      return "status-confirmed";
    case "pending":
      return "status-pending";
    case "expired":
      return "status-cancelled";
    case "paid_while_cancelled":
      return "status-no_show";
  }
}

function getSessionSkillLabel(level: PlayerSkillLevel): string {
  switch (level) {
    case "TB":
      return "TB";
    case "TB_PLUS":
      return "TB+";
    case "KHA":
      return "Khá";
    case "GIOI":
      return "Giỏi";
    default:
      return level;
  }
}

function formatElapsed(since: string | Date, _tick?: number): string {
  const elapsed = Math.floor(
    (Date.now() - new Date(since).getTime()) / 1000,
  );
  if (elapsed < 0) return "00:00";
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getPlayerInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (
    (parts[parts.length - 2][0] ?? "") + (parts[parts.length - 1][0] ?? "")
  ).toUpperCase();
}

const AVATAR_COLORS = [
  { bg: "#E1F5EE", fg: "#085041" },
  { bg: "#FAECE7", fg: "#712B13" },
  { bg: "#EEEDFE", fg: "#3C3489" },
  { bg: "#FBEAF0", fg: "#72243E" },
  { bg: "#FAEEDA", fg: "#633806" },
  { bg: "#E6F1FB", fg: "#0C447C" },
  { bg: "#EAF3DE", fg: "#27500A" },
  { bg: "#FCEBEB", fg: "#791F1F" },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (const ch of name) hash = ((hash * 31) + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
  type SectionTabId = (typeof mainSectionTabs)[number]["id"];
  const validTabIds = mainSectionTabs.map((t) => t.id) as SectionTabId[];
  function getTabFromHash(): SectionTabId {
    const hash = window.location.hash.slice(1) as SectionTabId;
    return validTabIds.includes(hash) ? hash : "management";
  }
  const [activeSectionTab, setActiveSectionTabRaw] = useState<SectionTabId>(getTabFromHash);
  function setActiveSectionTab(tab: SectionTabId) {
    window.location.hash = tab;
    setActiveSectionTabRaw(tab);
  }
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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [quickSlots, setQuickSlots] = useState<QuickSlot[]>([]);
  const [slotManagementSlots, setSlotManagementSlots] = useState<QuickSlot[]>(
    [],
  );
  const [form, setForm] = useState<CreateBookingPayload>(() => ({ ...initialForm, bookingDate: getLocalDateInputValue() }));
  const [quickSlotDraft, setQuickSlotDraft] = useState({
    startTime: "19:00",
    endTime: "21:00",
  });
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getLocalDateInputValue(),
  );
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [transferFilter, setTransferFilter] = useState<
    "all" | "paid" | "unpaid"
  >("all");
  const [participationFilter, setParticipationFilter] = useState<
    "all" | "checked_in" | "no_show"
  >("all");
  const [slotFilter, setSlotFilter] = useState<string>("all");
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editDetailForm, setEditDetailForm] = useState<{
    customerName: string; customerPhone: string; gender: CustomerGender;
    skillLevel: SkillLevel; bookingDate: string; startTime: string;
    endTime: string; depositAmount: number; notes: string;
  } | null>(null);
  const [isEditDetailSubmitting, setIsEditDetailSubmitting] = useState(false);
  const [fullscreenPhotoUrl, setFullscreenPhotoUrl] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string>("");
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuickSlotSubmitting, setIsQuickSlotSubmitting] = useState(false);
  const [isPublicBookingSettingsSubmitting, setIsPublicBookingSettingsSubmitting] =
    useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [transactionFilter, setTransactionFilter] =
    useState<TransactionFilter>("all");

  // ── Play-session coordination state ─────────────────────────────────────────
  const [boardModeId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const v = new URLSearchParams(window.location.search).get("board");
    return v ? parseInt(v, 10) : null;
  });
  const [boardSession, setBoardSession] = useState<PlaySession | null>(null);
  const [boardTick, setBoardTick] = useState(0);
  const [sessions, setSessions] = useState<PlaySession[]>([]);
  const [activeSession, setActiveSession] = useState<PlaySession | null>(null);
  const [sessionTick, setSessionTick] = useState(0);
  const [isSessionFormOpen, setIsSessionFormOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    name: "",
    venue: "",
    date: today,
    startTime: "19:00",
    endTime: "22:00",
    numberOfCourts: 2,
  });
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [newPlayerForm, setNewPlayerForm] = useState<{
    name: string;
    skillLevel: PlayerSkillLevel;
  }>({ name: "", skillLevel: "TB" });
  const [suggestionOptionIndex, setSuggestionOptionIndex] = useState<
    Record<number, number>
  >({});
  const [bookingSlots, setBookingSlots] = useState<BookingSlot[]>([]);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [slotCourtCounts, setSlotCourtCounts] = useState<Record<string, number>>({});
  const isBoardMode = boardModeId !== null;
  // ─────────────────────────────────────────────────────────────────────────────

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
        bookingsData,
        nextPublicBookingSettings,
      ] = await Promise.all([
        api.getOverview(),
        api.getBookings(),
        api.getPublicBookingSettings(),
      ]);

      setOverview(overviewData);
      setBookings(bookingsData);
      setPublicBookingSettings(nextPublicBookingSettings);
      setForm((currentForm) => ({
        ...currentForm,
        depositAmount: nextPublicBookingSettings.depositAmount,
      }));

      if (activeSectionTab === "coordination") {
        const [sessionsData, slotsData] = await Promise.all([
          api.getSessions(),
          api.getBookingSlots(selectedDate),
        ]);
        setSessions(sessionsData);
        setBookingSlots(slotsData);
        if (activeSession) {
          const refreshedActiveSession = sessionsData.find(
            (session) => session.id === activeSession.id,
          );
          if (refreshedActiveSession) {
            setActiveSession(refreshedActiveSession);
          }
        }
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
    setForm((f) => ({ ...f, bookingDate: selectedDate }));
  }, [selectedDate]);

  useEffect(() => {
    if (!authSession) {
      return;
    }

    void loadSlotManagementQuickSlots(selectedDate);
  }, [authSession, selectedDate]);

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

  // ── Play-session effects ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!boardModeId) return;
    void (async () => {
      try {
        setBoardSession(await api.getPublicBoard(boardModeId));
      } catch {}
    })();
    const refresh = setInterval(async () => {
      try {
        setBoardSession(await api.getPublicBoard(boardModeId));
      } catch {}
    }, 10_000);
    return () => clearInterval(refresh);
  }, [boardModeId]);

  useEffect(() => {
    if (!boardModeId) return;
    const t = setInterval(() => setBoardTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [boardModeId]);

  useEffect(() => {
    if (!authSession || activeSectionTab !== "coordination") return;
    void (async () => {
      try {
        const [sessions, slots] = await Promise.all([
          api.getSessions(),
          api.getBookingSlots(selectedDate),
        ]);
        setSessions(sessions);
        setBookingSlots(slots);
      } catch {}
    })();
  }, [authSession, activeSectionTab]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== "ACTIVE") return;
    const t = setInterval(async () => {
      try {
        const updated = await api.getSession(activeSession.id);
        setActiveSession(updated);
        setSuggestionOptionIndex({});
      } catch {}
    }, 10_000);
    return () => clearInterval(t);
  }, [activeSession?.id, activeSession?.status]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== "ACTIVE") return;
    const t = setInterval(() => setSessionTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [activeSession?.status]);
  // ─────────────────────────────────────────────────────────────────────────────

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

  function openEditDetail() {
    if (!detailBooking) return;
    setEditDetailForm({
      customerName: detailBooking.customerName,
      customerPhone: detailBooking.customerPhone ?? "",
      gender: detailBooking.gender,
      skillLevel: detailBooking.skillLevel,
      bookingDate: detailBooking.bookingDate,
      startTime: detailBooking.startTime,
      endTime: detailBooking.endTime,
      depositAmount: detailBooking.depositAmount,
      notes: detailBooking.notes ?? "",
    });
    setIsEditingDetail(true);
  }

  async function handleEditDetailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailBooking || !editDetailForm) return;
    setIsEditDetailSubmitting(true);
    try {
      const updated = await api.updateBooking(detailBooking.id, {
        ...editDetailForm,
        customerPhone: editDetailForm.customerPhone || undefined,
        notes: editDetailForm.notes || undefined,
      });
      setBookings((prev) => prev.map((b) => b.id === updated.id ? updated : b));
      setDetailBooking(updated);
      setIsEditingDetail(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật thông tin");
    } finally {
      setIsEditDetailSubmitting(false);
    }
  }

  async function handleBookingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await api.createBooking(form);
      setForm({ ...initialForm, bookingDate: selectedDate });
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
        bookingDate: selectedDate,
        startTime: quickSlotDraft.startTime,
        endTime: quickSlotDraft.endTime,
      });
      await Promise.all([
        loadSlotManagementQuickSlots(selectedDate),
        form.bookingDate === selectedDate
          ? loadQuickSlots(selectedDate)
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
        loadSlotManagementQuickSlots(selectedDate),
        form.bookingDate === selectedDate
          ? loadQuickSlots(selectedDate)
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

  async function handleRestoreBooking(id: number) {
    try {
      await api.restoreBooking(id);
      await loadData();
      showAppToast(
        "success",
        "Đã khôi phục!",
        "Booking đã được khôi phục và đưa lại vào danh sách vợt thủ.",
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Không thể khôi phục booking",
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

  // ── Play-session handlers ────────────────────────────────────────────────────
  function handleOpenSession(session: PlaySession) {
    setActiveSession(session);
    setSuggestionOptionIndex({});
  }

  function handleCloseSession() {
    setActiveSession(null);
  }

  async function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const created = await api.createSession({
        name: sessionForm.name,
        venue: sessionForm.venue || undefined,
        date: sessionForm.date,
        startTime: sessionForm.startTime,
        endTime: sessionForm.endTime,
        numberOfCourts: sessionForm.numberOfCourts,
      });
      setSessions((prev) => [created, ...prev]);
      setIsSessionFormOpen(false);
      setSessionForm({
        name: "",
        venue: "",
        date: today,
        startTime: "19:00",
        endTime: "22:00",
        numberOfCourts: 2,
      });
      showAppToast("success", "Congratulations!", "Đã tạo buổi chơi mới.");
      handleOpenSession(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tạo buổi chơi");
    }
  }

  async function handleLoadBookingSlots(date: string) {
    setIsSlotsLoading(true);
    try {
      const slots = await api.getBookingSlots(date);
      setBookingSlots(slots);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải khung giờ");
    } finally {
      setIsSlotsLoading(false);
    }
  }

  async function handleOpenSlotCoordination(slot: BookingSlot) {
    try {
      let session: PlaySession;
      if (slot.existingSessionId !== null) {
        session = await api.getSession(slot.existingSessionId);
      } else {
        const slotKey = `${slot.startTime}|${slot.endTime}`;
        const courtCount = slotCourtCounts[slotKey] ?? Math.max(slot.courts.length, 1);
        session = await api.createSessionFromSlot(
          selectedDate,
          slot.startTime,
          slot.endTime,
          courtCount,
        );
        setBookingSlots((prev) =>
          prev.map((s) =>
            s.startTime === slot.startTime && s.endTime === slot.endTime
              ? { ...s, existingSessionId: session.id }
              : s,
          ),
        );
        setSessions((prev) => [session, ...prev]);
      }
      handleOpenSession(session);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể mở điều phối");
    }
  }

  async function handleSessionStatus(status: "ACTIVE" | "ENDED") {
    if (!activeSession) return;
    try {
      const updated = await api.updateSessionStatus(activeSession.id, status);
      setActiveSession(updated);
      setSessions((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
      setSuggestionOptionIndex({});
      showAppToast(
        "success",
        "Congratulations!",
        status === "ACTIVE"
          ? "Buổi chơi đã bắt đầu!"
          : "Buổi chơi đã kết thúc.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Cập nhật trạng thái thất bại",
      );
    }
  }

  async function handleAddPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSession) return;
    try {
      const updated = await api.addSessionPlayer(
        activeSession.id,
        newPlayerForm,
      );
      setActiveSession(updated);
      setNewPlayerForm({ name: "", skillLevel: "TB" });
      setIsAddingPlayer(false);
      showAppToast("success", "Congratulations!", "Đã thêm người chơi.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không thể thêm người chơi",
      );
    }
  }

  async function handleRemovePlayer(playerId: number) {
    if (!activeSession) return;
    try {
      const updated = await api.removeSessionPlayer(
        activeSession.id,
        playerId,
      );
      setActiveSession(updated);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không thể xóa người chơi",
      );
    }
  }


  async function handleToggleCheckIn(playerId: number) {
    if (!activeSession) return;
    try {
      const updated = await api.checkInSessionPlayer(activeSession.id, playerId);
      setActiveSession(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in thất bại");
    }
  }

  async function handleConfirmMatch(
    courtNumber: number,
    option: TeamOption,
  ) {
    if (!activeSession) return;
    try {
      const updated = await api.startMatch(activeSession.id, {
        courtNumber,
        teamAPlayer1Id: option.teamA[0].id,
        teamAPlayer2Id: option.teamA[1].id,
        teamBPlayer1Id: option.teamB[0].id,
        teamBPlayer2Id: option.teamB[1].id,
      });
      setActiveSession(updated);
      setSuggestionOptionIndex((prev) => ({ ...prev, [courtNumber]: 0 }));
      showAppToast(
        "success",
        "Congratulations!",
        `Trận đấu sân ${courtNumber} đã bắt đầu!`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể bắt đầu trận");
    }
  }

  async function handleUpdateCourts(delta: number) {
    if (!activeSession) return;
    const newCount = activeSession.numberOfCourts + delta;
    if (newCount < 1) return;
    try {
      const updated = await api.updateSessionCourts(activeSession.id, newCount);
      setActiveSession(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật số sân");
    }
  }

  async function handleEndMatch(matchId: number) {
    if (!activeSession) return;
    try {
      const updated = await api.endMatch(activeSession.id, matchId);
      setActiveSession(updated);
      setSuggestionOptionIndex({});
      showAppToast("info", "Did you know?", "Trận đấu đã kết thúc.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể kết thúc trận");
    }
  }

  async function handleUpdateScore(
    matchId: number,
    scoreA: number,
    scoreB: number,
  ) {
    if (!activeSession) return;
    try {
      const updated = await api.updateMatchScore(
        activeSession.id,
        matchId,
        scoreA,
        scoreB,
      );
      setActiveSession(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cập nhật điểm thất bại");
    }
  }

  function handleCycleSuggestion(court: number, optionsLength: number) {
    setSuggestionOptionIndex((prev) => ({
      ...prev,
      [court]: ((prev[court] ?? 0) + 1) % optionsLength,
    }));
  }

  function handleOpenTVBoard(sessionId: number) {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("board", String(sessionId));
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  async function handleCopyTVBoardLink(sessionId: number) {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("board", String(sessionId));

    try {
      await navigator.clipboard.writeText(url.toString());
      showAppToast("success", "Đã sao chép", "Link Màn hình TV đã được copy.");
    } catch {
      window.prompt("Sao chép link Màn hình TV", url.toString());
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

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

      </article>
    );
  }

  const racketPlayerBookings = sortBookingsStable(
    bookings
      .filter((booking) => booking.bookingDate === selectedDate)
      .filter((booking) => booking.depositPaid)
      .filter((booking) => booking.status !== "CANCELLED")
      .filter((booking) =>
        booking.customerName
          .toLowerCase()
          .includes(searchTerm.trim().toLowerCase()),
      ),
  );
  const availableSlots = Array.from(
    new Map(
      racketPlayerBookings.map((b) => [`${b.startTime}|${b.endTime}`, { startTime: b.startTime, endTime: b.endTime }])
    ).values()
  ).sort((a, b) => a.startTime.localeCompare(b.startTime));

  const filteredRacketPlayerBookings = racketPlayerBookings
    .filter((booking) => {
      if (slotFilter === "all") return true;
      return `${booking.startTime}|${booking.endTime}` === slotFilter;
    })
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
        return booking.status === "CHECKED_IN" || booking.status === "COMPLETED";
      }

      if (participationFilter === "no_show") {
        return booking.status === "NO_SHOW";
      }

      return true;
    });

  const qrBookingsForDate = bookings.filter(
    (b) => b.depositReference && b.bookingDate === selectedDate,
  );
  const transactionStats = {
    total: qrBookingsForDate.length,
    success: qrBookingsForDate.filter(
      (b) => getTransactionStatus(b) === "success",
    ).length,
    expired: qrBookingsForDate.filter(
      (b) => getTransactionStatus(b) === "expired",
    ).length,
    needsAction: qrBookingsForDate.filter(
      (b) => getTransactionStatus(b) === "paid_while_cancelled",
    ).length,
  };
  const transactionBookings = [...qrBookingsForDate]
    .filter((b) => {
      if (transactionFilter === "all") return true;
      return getTransactionStatus(b) === transactionFilter;
    })
    .reverse();

  function exportHistoryToExcel() {
    const exportBookings = sortBookingsStable(
      bookings
        .filter((booking) => booking.bookingDate === selectedDate)
        .filter((booking) =>
          booking.customerName
            .toLowerCase()
            .includes(searchTerm.trim().toLowerCase()),
        )
        .filter((booking) => {
          if (transferFilter === "paid") return booking.fullPaymentTransferred;
          if (transferFilter === "unpaid") return !booking.fullPaymentTransferred;
          return true;
        })
        .filter((booking) => {
          if (participationFilter === "checked_in")
            return booking.status === "CHECKED_IN" || booking.status === "COMPLETED";
          if (participationFilter === "no_show")
            return booking.status === "NO_SHOW";
          return true;
        }),
    );

    const rows = exportBookings.map((booking) => ({
      "Ngày": booking.bookingDate,
      "Giờ bắt đầu": booking.startTime,
      "Giờ kết thúc": booking.endTime,
      "Tên khách hàng": booking.customerName,
      "Giới tính": getGenderLabel(booking.gender),
      "Trình độ": getSkillLevelLabel(booking.skillLevel),
      "Số điện thoại": booking.customerPhone,
      "Số tiền cọc": booking.depositAmount,
      "Nội dung chuyển khoản": booking.depositReference ?? "",
      "Đã thanh toán cọc": booking.depositPaid ? "Có" : "Không",
      "Đã chuyển khoản": booking.fullPaymentTransferred ? "Có" : "Không",
      "Trạng thái": booking.status,
      "Ghi chú": booking.notes,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "QuảnLýSân");
    XLSX.writeFile(
      workbook,
      `${selectedDate}-quản-lý.xlsx`,
    );
  }

  // ── Public TV board mode (no auth required) ──────────────────────────────────
  if (boardModeId !== null) {
    const s = boardSession;
    const playerMap: Record<number, PlaySession["players"][number]> = {};
    if (s) for (const p of s.players) playerMap[p.id] = p;
    const waitingPlayers = s
      ? [...s.players.filter((p) => p.isCheckedIn && !p.isCurrentlyPlaying)]
          .sort((a, b) => {
            const base = new Date(s.createdAt).getTime();
            const wa =
              boardTick > -1
                ? Date.now() -
                  (a.lastMatchEndedAt
                    ? new Date(a.lastMatchEndedAt).getTime()
                    : base)
                : 0;
            const wb =
              Date.now() -
              (b.lastMatchEndedAt
                ? new Date(b.lastMatchEndedAt).getTime()
                : base);
            return wb - wa;
          })
      : [];
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f5f5",
          padding: "16px",
          fontFamily: "inherit",
        }}
      >
        {!s ? (
          <p style={{ textAlign: "center", marginTop: 80, color: "#888" }}>
            Đang tải bảng điều phối…
          </p>
        ) : (
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            {/* Header */}
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                border: "0.5px solid #e5e7eb",
                padding: "14px 16px",
                marginBottom: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 500, fontSize: 15 }}>
                  {s.name}
                  {s.venue ? ` · ${s.venue}` : ""}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  {s.startTime}–{s.endTime} · {s.numberOfCourts} sân ·{" "}
                  {s.players.filter((p) => p.isCheckedIn).length}/
                  {s.players.length} người check-in
                </p>
              </div>
              {s.status === "ACTIVE" ? (
                <span
                  style={{
                    background: "#dcfce7",
                    color: "#166534",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  ● LIVE {formatElapsed(s.startedAt ?? s.createdAt, boardTick)}
                </span>
              ) : (
                <span
                  style={{
                    background: "#f3f4f6",
                    color: "#6b7280",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                  }}
                >
                  {s.status === "UPCOMING" ? "Sắp diễn ra" : "Đã kết thúc"}
                </span>
              )}
            </div>

            {/* Court cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 12,
                marginBottom: 12,
              }}
            >
              {Array.from({ length: s.numberOfCourts }, (_, i) => i + 1).map(
                (courtNum) => {
                  const match = s.matches.find(
                    (m) => m.courtNumber === courtNum && m.status === "PLAYING",
                  );
                  const cardStyle = {
                    background: "#fff",
                    borderRadius: 12,
                    border: "0.5px solid #e5e7eb",
                    padding: "14px 16px",
                  };
                  if (!match) {
                    return (
                      <div key={courtNum} style={cardStyle}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontWeight: 500, fontSize: 14 }}>
                            Sân {courtNum}
                          </span>
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>
                            Sân trống
                          </span>
                        </div>
                      </div>
                    );
                  }
                  const p1 = playerMap[match.teamAPlayer1Id];
                  const p2 = playerMap[match.teamAPlayer2Id];
                  const p3 = playerMap[match.teamBPlayer1Id];
                  const p4 = playerMap[match.teamBPlayer2Id];
                  const c1 = getAvatarColor(p1?.name ?? "A");
                  const c3 = getAvatarColor(p3?.name ?? "B");
                  return (
                    <div key={courtNum} style={cardStyle}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 12,
                        }}
                      >
                        <span style={{ fontWeight: 500, fontSize: 14 }}>
                          Sân {courtNum}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: "#16a34a",
                            fontWeight: 500,
                          }}
                        >
                          ● Đang đánh ·{" "}
                          {formatElapsed(match.startedAt, boardTick)}
                        </span>
                      </div>
                      {[
                        {
                          players: [p1, p2],
                          score: match.scoreA,
                          color: c1,
                        },
                        {
                          players: [p3, p4],
                          score: match.scoreB,
                          color: c3,
                        },
                      ].map(({ players, score, color }, ti) => (
                        <div
                          key={ti}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 0",
                            borderTop:
                              ti === 1
                                ? "0.5px solid #e5e7eb"
                                : undefined,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background: color.bg,
                                color: color.fg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 500,
                              }}
                            >
                              {getPlayerInitials(players[0]?.name ?? "?")}
                            </div>
                            <div style={{ fontSize: 13 }}>
                              <div style={{ fontWeight: 500 }}>
                                {players[0]?.name ?? "?"} &amp;{" "}
                                {players[1]?.name ?? "?"}
                              </div>
                              <div
                                style={{
                                  color: "#9ca3af",
                                  fontSize: 11,
                                }}
                              >
                                {getSessionSkillLabel(
                                  players[0]?.skillLevel ?? "TB",
                                )}{" "}
                                ·{" "}
                                {getSessionSkillLabel(
                                  players[1]?.skillLevel ?? "TB",
                                )}
                              </div>
                            </div>
                          </div>
                          <span
                            style={{ fontSize: 20, fontWeight: 600 }}
                          >
                            {score}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                },
              )}
            </div>

            {/* Waiting list */}
            {waitingPlayers.length > 0 ? (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  border: "0.5px solid #e5e7eb",
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontWeight: 500, fontSize: 14 }}>
                    Đang chờ
                  </span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    {waitingPlayers.length} người · sắp xếp theo thời gian
                    chờ
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(130px, 1fr))",
                    gap: 8,
                  }}
                >
                  {waitingPlayers.map((p) => {
                    const c = getAvatarColor(p.name);
                    const base = new Date(s.createdAt).getTime();
                    const waitMs =
                      Date.now() -
                      (p.lastMatchEndedAt
                        ? new Date(p.lastMatchEndedAt).getTime()
                        : base);
                    const waitMin = Math.floor(waitMs / 60_000);
                    const isLong = waitMin >= 10;
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 8px",
                          borderRadius: 8,
                          background: "#f9fafb",
                        }}
                      >
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            background: c.bg,
                            color: c.fg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 10,
                            fontWeight: 500,
                            flexShrink: 0,
                          }}
                        >
                          {getPlayerInitials(p.name)}
                        </div>
                        <div style={{ fontSize: 12, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {p.name}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: isLong ? "#b45309" : "#6b7280",
                            }}
                          >
                            {waitMin > 0 ? `${waitMin} phút` : "Vừa xong"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────────

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
            Nhập danh sách khách đã đặt và đã cọc trước, sau đó theo dõi và
            điều phối buổi chơi khi bạn sẵn sàng.
          </p>
        </div>
        <div className="hero-note">
          <span>Thông tin nhanh</span>
          <strong>
            {overview?.totals.todaysBookings ?? 0} lượt đặt hôm nay
          </strong>
          <p>
            {filteredRacketPlayerBookings.length} vợt thủ đang được theo dõi và{" "}
            {overview?.totals.pendingTransfers ?? 0} giao dịch còn chờ xác nhận.
          </p>
          {authSession && !isBoardMode ? (
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

      {!authSession && !isBoardMode ? (
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

      <div className="global-date-bar">
        <label className="global-date-label">
          <span>Ngày xem</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSlotFilter("all");
              void handleLoadBookingSlots(e.target.value);
            }}
          />
        </label>
      </div>

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
                <small>Khách sẽ được đưa thẳng vào danh sách vợt thủ để theo dõi.</small>
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
                <h2>Danh sách vợt thủ</h2>
              </div>
            </div>
            <div className="management-toolbar">
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
                <span>Khung giờ</span>
                <select
                  value={slotFilter}
                  onChange={(event) => setSlotFilter(event.target.value)}
                >
                  <option value="all">Tất cả khung giờ</option>
                  {availableSlots.map((slot) => (
                    <option key={`${slot.startTime}|${slot.endTime}`} value={`${slot.startTime}|${slot.endTime}`}>
                      {slot.startTime}–{slot.endTime}
                    </option>
                  ))}
                </select>
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
            <div className="panel-subhead history-subhead">
              <p className="panel-tag">Danh sách vợt thủ</p>
              <div className="history-subhead-row">
                <h3>Danh sách khách theo ngày và trạng thái</h3>
                <button
                  type="button"
                  className="ghost-button view-button"
                  onClick={() => setIsQueueModalOpen(true)}
                >
                  <span>Xem</span>
                </button>
              </div>
            </div>
            <div className="schedule-list">
              {filteredRacketPlayerBookings.length === 0 ? (
                <p className="empty-state">
                  Không có vợt thủ nào phù hợp với bộ lọc trong ngày này.
                </p>
              ) : (
                filteredRacketPlayerBookings.map((booking) =>
                  renderAssignedBookingCard(booking),
                )
              )}
            </div>
          </section>
        ) : null}
      </main>

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
                  <p className="quick-slots-helper">
                    Thêm khung giờ và khách ở site công khai sẽ nhìn
                    thấy đúng các lựa chọn này trong ngày tương ứng.
                  </p>
                </div>

                <div className="quick-slots-create-card">
                  <div className="panel-subhead">
                    <div>
                      <p className="panel-tag">Tạo mới</p>
                      <h3>Thêm khung giờ cho {selectedDate}</h3>
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
                    <h3>{selectedDate}</h3>
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

      {activeSectionTab === "transactions" ? (
        <section className="court-inventory-section">
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-tag">Giao dịch cọc</p>
                <h2>Quản lý giao dịch QR</h2>
              </div>
              <button
                type="button"
                className="ghost-button view-button"
                onClick={() => setIsTransactionModalOpen(true)}
              >
                <span>Xem</span>
              </button>
            </div>

            <section className="stats-grid">
              <StatCard
                label="Tổng giao dịch QR"
                value={transactionStats.total}
              />
              <StatCard label="Thành công" value={transactionStats.success} />
              <StatCard
                label="Hết hạn / Đã huỷ"
                value={transactionStats.expired}
              />
              <StatCard
                label="Cần xử lý"
                value={transactionStats.needsAction}
              />
            </section>

            <div className="management-toolbar">
              <label className="history-filter">
                <span>Trạng thái</span>
                <select
                  value={transactionFilter}
                  onChange={(event) =>
                    setTransactionFilter(
                      event.target.value as TransactionFilter,
                    )
                  }
                >
                  <option value="all">Tất cả giao dịch</option>
                  <option value="success">Thành công</option>
                  <option value="pending">Đang chờ thanh toán</option>
                  <option value="expired">Hết hạn / Đã huỷ</option>
                  <option value="paid_while_cancelled">Cần xử lý</option>
                </select>
              </label>
            </div>

            <div className="schedule-list">
              {transactionBookings.length === 0 ? (
                <p className="empty-state">
                  Không có giao dịch nào phù hợp với bộ lọc.
                </p>
              ) : (
                transactionBookings.map((booking) => {
                  const txStatus = getTransactionStatus(booking);
                  const isPaidWhileCancelled =
                    txStatus === "paid_while_cancelled";
                  return (
                    <article
                      key={booking.id}
                      className="booking-card compact-card"
                      style={
                        isPaidWhileCancelled
                          ? {
                              borderLeft: "4px solid #f59e0b",
                              backgroundColor: "#fffbeb",
                            }
                          : undefined
                      }
                    >
                      <div className="booking-card-top">
                        <div>
                          <h3>{booking.customerName}</h3>
                          <p>
                            {booking.bookingDate} · {booking.startTime} –{" "}
                            {booking.endTime}
                          </p>
                        </div>
                        <span
                          className={`status ${getTransactionStatusCssClass(txStatus)}`}
                        >
                          {getTransactionStatusLabel(txStatus)}
                        </span>
                      </div>

                      <div className="booking-meta">
                        {booking.customerPhone ? (
                          <span>{booking.customerPhone}</span>
                        ) : null}
                        <span>Mã: {booking.depositReference}</span>
                        <span>
                          {formatCurrencyDisplay(booking.depositAmount)} VNĐ
                        </span>
                        {booking.depositPaidAt ? (
                          <span>
                            Nhận lúc:{" "}
                            {new Date(booking.depositPaidAt).toLocaleString(
                              "vi-VN",
                            )}
                          </span>
                        ) : booking.depositExpiresAt &&
                          txStatus === "pending" ? (
                          <span>
                            Hết hạn lúc:{" "}
                            {new Date(booking.depositExpiresAt).toLocaleString(
                              "vi-VN",
                            )}
                          </span>
                        ) : null}
                        {booking.depositTransactionId ? (
                          <span>Mã GD: {booking.depositTransactionId}</span>
                        ) : null}
                      </div>

                      {booking.depositTransferNote ? (
                        <div className="booking-note">
                          <strong>Nội dung CK:</strong>{" "}
                          {booking.depositTransferNote}
                        </div>
                      ) : null}

                      {isPaidWhileCancelled ? (
                        <div className="booking-note">
                          Khách đã chuyển tiền nhưng booking bị huỷ trước khi
                          xác nhận. Kiểm tra sao kê ngân hàng và chọn hành
                          động phù hợp.
                        </div>
                      ) : null}

                      {isPaidWhileCancelled ? (
                        <div className="booking-actions">
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() =>
                              void handleRestoreBooking(booking.id)
                            }
                          >
                            Khôi phục đặt sân
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => void handleDeleteBooking(booking.id)}
                          >
                            Xóa booking
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </section>
      ) : null}

      {detailBooking ? (
        <div
          className="modal-backdrop customer-detail-backdrop"
          role="presentation"
          onClick={() => { setDetailBooking(null); setIsEditingDetail(false); }}
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
              <div style={{ display: "flex", gap: 8 }}>
                {!isEditingDetail && (
                  <button type="button" className="primary-button" onClick={openEditDetail}>
                    Chỉnh sửa
                  </button>
                )}
                <button type="button" className="ghost-button" onClick={() => { setDetailBooking(null); setIsEditingDetail(false); }}>
                  Đóng
                </button>
              </div>
            </div>

              {isEditingDetail && editDetailForm ? (
                <form
                  onSubmit={(e) => void handleEditDetailSubmit(e)}
                  className="customer-edit-form"
                >
                  <div className="customer-edit-hero">
                    <p className="panel-tag">Chỉnh sửa khách</p>
                    <h3>Cập nhật thông tin vợt thủ</h3>
                    <p>
                      Chỉnh lại thông tin hiển thị, khung giờ chơi và số tiền cọc
                      trong cùng một biểu mẫu gọn gàng.
                    </p>
                  </div>

                  <div className="customer-edit-grid customer-edit-grid-two">
                    <label className="customer-edit-field">
                      <span>Tên khách</span>
                      <input
                        type="text"
                        value={editDetailForm.customerName}
                        required
                        onChange={(e) =>
                          setEditDetailForm((f) =>
                            f ? { ...f, customerName: e.target.value } : f,
                          )
                        }
                      />
                    </label>
                    <label className="customer-edit-field">
                      <span>Số điện thoại</span>
                      <input
                        type="text"
                        value={editDetailForm.customerPhone}
                        placeholder="Có thể để trống"
                        onChange={(e) =>
                          setEditDetailForm((f) =>
                            f ? { ...f, customerPhone: e.target.value } : f,
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="customer-edit-grid customer-edit-grid-two">
                    <label className="customer-edit-field">
                      <span>Giới tính</span>
                      <select
                        value={editDetailForm.gender}
                        onChange={(e) =>
                          setEditDetailForm((f) =>
                            f
                              ? {
                                  ...f,
                                  gender: e.target.value as CustomerGender,
                                }
                              : f,
                          )
                        }
                      >
                        {genderOptions.map((g) => (
                          <option key={g} value={g}>
                            {getGenderLabel(g)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="customer-edit-field">
                      <span>Trình độ</span>
                      <select
                        value={editDetailForm.skillLevel}
                        onChange={(e) =>
                          setEditDetailForm((f) =>
                            f
                              ? {
                                  ...f,
                                  skillLevel: e.target.value as SkillLevel,
                                }
                              : f,
                          )
                        }
                      >
                        {skillLevelOptions.map((s) => (
                          <option key={s} value={s}>
                            {getSkillLevelLabel(s)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="customer-edit-grid customer-edit-grid-three">
                    <label className="customer-edit-field">
                      <span>Ngày chơi</span>
                      <input
                        type="date"
                        value={editDetailForm.bookingDate}
                        required
                        onChange={(e) =>
                          setEditDetailForm((f) =>
                            f ? { ...f, bookingDate: e.target.value } : f,
                          )
                        }
                      />
                    </label>
                    <label className="customer-edit-field">
                      <span>Giờ bắt đầu</span>
                      <input
                        type="time"
                        value={editDetailForm.startTime}
                        required
                        onChange={(e) =>
                          setEditDetailForm((f) =>
                            f ? { ...f, startTime: e.target.value } : f,
                          )
                        }
                      />
                    </label>
                    <label className="customer-edit-field">
                      <span>Giờ kết thúc</span>
                      <input
                        type="time"
                        value={editDetailForm.endTime}
                        required
                        onChange={(e) =>
                          setEditDetailForm((f) =>
                            f ? { ...f, endTime: e.target.value } : f,
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="customer-edit-grid customer-edit-grid-two">
                    <label className="customer-edit-field">
                      <span>Tiền cọc</span>
                      {renderCurrencyInput(
                        editDetailForm.depositAmount,
                        (depositAmount) =>
                          setEditDetailForm((f) =>
                            f ? { ...f, depositAmount } : f,
                          ),
                        "Tiền cọc chỉnh sửa khách",
                      )}
                    </label>
                  </div>

                  <label className="customer-edit-field customer-edit-field-full">
                    <span>Ghi chú</span>
                    <textarea
                      value={editDetailForm.notes}
                      rows={4}
                      placeholder="Ví dụ: đến muộn, cần ghép nhóm, có mang vợt riêng..."
                      onChange={(e) =>
                        setEditDetailForm((f) =>
                          f ? { ...f, notes: e.target.value } : f,
                        )
                      }
                    />
                  </label>

                  <div className="customer-edit-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => setIsEditingDetail(false)}
                      disabled={isEditDetailSubmitting}
                    >
                      Huỷ
                    </button>
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={isEditDetailSubmitting}
                    >
                      {isEditDetailSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
                    </button>
                  </div>
                </form>
              ) : (
              <>
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
                      <strong>{getSkillLevelLabel(detailBooking.skillLevel)}</strong>
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
                      <strong>{formatCurrencyDisplay(detailBooking.depositAmount)}</strong>
                    </div>
                  </div>
                </div>

                <div className="customer-detail-note">
                  <span className="selected-court-label">Ghi chú</span>
                  <p>{detailBooking.notes || "Không có ghi chú."}</p>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {activeSectionTab === "coordination" ? (
        <section className="court-inventory-section">
          {!activeSession ? (
            /* ── Slot picker ───────────────────────────────────────────────── */
            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="panel-tag">Điều phối buổi chơi</p>
                  <h2>Chọn khung giờ</h2>
                </div>
              </div>

              {isSlotsLoading ? (
                <p className="empty-state">Đang tải...</p>
              ) : bookingSlots.filter((slot) => slot.existingSessionId === null || sessions.find((s) => s.id === slot.existingSessionId)?.status !== "ENDED").length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 24 }}>
                  {bookingSlots.filter((slot) => {
                    if (slot.existingSessionId === null) return true;
                    const s = sessions.find((s) => s.id === slot.existingSessionId);
                    return s?.status !== "ENDED";
                  }).map((slot) => {
                    const slotKey = `${slot.startTime}|${slot.endTime}`;
                    const courtCount = slotCourtCounts[slotKey] ?? Math.max(slot.courts.length, 1);
                    return (
                    <div
                      key={`${slot.startTime}-${slot.endTime}`}
                      style={{ background: "var(--color-background-primary, #fff)", borderRadius: 12, border: "0.5px solid var(--color-border-tertiary, #e5e7eb)", padding: "14px 16px" }}
                    >
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 17, fontWeight: 600 }}>
                          {slot.startTime} – {slot.endTime}
                        </div>
                        <div style={{ display: "flex", gap: 12, fontSize: 13, marginTop: 6, flexWrap: "wrap" }}>
                          <span>{slot.totalBookings} người đặt</span>
                          {slot.checkedInCount > 0 ? (
                            <span style={{ color: "#0f6e56" }}>{slot.checkedInCount} check-in</span>
                          ) : null}
                        </div>
                      </div>
                      {slot.existingSessionId === null ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 13 }}>
                          <span style={{ color: "#6b7280" }}>Số sân:</span>
                          <button
                            type="button"
                            onClick={() => setSlotCourtCounts((prev) => ({ ...prev, [slotKey]: Math.max(1, courtCount - 1) }))}
                            disabled={courtCount <= 1}
                            style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                          >−</button>
                          <span style={{ fontWeight: 600, minWidth: 20, textAlign: "center" }}>{courtCount}</span>
                          <button
                            type="button"
                            onClick={() => setSlotCourtCounts((prev) => ({ ...prev, [slotKey]: courtCount + 1 }))}
                            style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                          >+</button>
                        </div>
                      ) : null}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="primary-button"
                          style={{ flex: 1 }}
                          onClick={() => void handleOpenSlotCoordination(slot)}
                        >
                          {slot.existingSessionId !== null ? "Tiếp tục →" : "Mở điều phối"}
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-state">
                  Không có booking nào cho ngày {selectedDate}.
                </p>
              )}

              {sessions.filter((s) => {
                        if (s.date === selectedDate || s.status === "ENDED") return false;
                        const end = new Date(`${s.date}T${s.endTime}`);
                        return end > new Date();
                      }).length > 0 ? (
                <>
                  <p className="panel-tag" style={{ marginBottom: 8 }}>Buổi chơi ngày khác</p>
                  <div className="schedule-list">
                    {sessions
                      .filter((s) => s.date !== selectedDate && s.status !== "ENDED")
                      .map((session) => (
                        <article key={session.id} className="booking-card">
                          <div className="booking-card-top">
                            <div>
                              <h3>{session.name}</h3>
                              <p>{session.date} · {session.startTime}–{session.endTime} · {session.numberOfCourts} sân</p>
                            </div>
                            <span className={`status ${session.status === "ACTIVE" ? "status-checked_in" : session.status === "ENDED" ? "status-completed" : "status-pending"}`}>
                              {session.status === "ACTIVE" ? "Đang chơi" : session.status === "ENDED" ? "Đã kết thúc" : "Sắp diễn ra"}
                            </span>
                          </div>
                          <div className="booking-actions">
                            <button type="button" className="primary-button" onClick={() => handleOpenSession(session)}>
                              Vào quản lý
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                </>
              ) : null}
            </section>
          ) : (
            /* ── Coordination board ────────────────────────────────────────── */
            <section className="panel" style={{ padding: 0, border: "none", background: "transparent", boxShadow: "none" }}>

              {/* Admin action bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 2px" }}>
                <button type="button" className="ghost-button" onClick={handleCloseSession}>
                  ← Danh sách
                </button>
                      <div style={{ display: "flex", gap: 8 }}>
                        {activeSession.status === "UPCOMING" ? (
                          <button
                            type="button"
                            className="primary-button"
                      disabled={activeSession.players.filter((p) => p.isCheckedIn).length < 4}
                      onClick={() => void handleSessionStatus("ACTIVE")}
                    >
                      Bắt đầu buổi chơi
                    </button>
                  ) : null}
                      {activeSession.status === "ACTIVE" ? (
                        <>
                          <button type="button" className="ghost-button" onClick={() => handleOpenTVBoard(activeSession.id)}>
                            📺 Màn hình TV
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => void handleCopyTVBoardLink(activeSession.id)}
                          >
                            Sao chép link
                          </button>
                          <button type="button" className="warning-button" onClick={() => void handleSessionStatus("ENDED")}>
                            Kết thúc buổi
                          </button>
                        </>
                      ) : null}
                </div>
              </div>

              {/* Gray board wrapper — matches mockup */}
              <div style={{ background: "var(--color-background-secondary, #f9fafb)", borderRadius: 12, padding: 16 }}>

                {/* Session header card */}
                {(() => {
                  const checkedIn = activeSession.players.filter((p) => p.isCheckedIn).length;
                  const total = activeSession.players.length;
                  return (
                    <div style={{ background: "var(--color-background-primary, #fff)", borderRadius: 12, border: "0.5px solid var(--color-border-tertiary, #e5e7eb)", padding: "14px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>
                          {activeSession.name}{activeSession.venue ? ` · ${activeSession.venue}` : ""}
                        </p>
                        <div style={{ margin: "2px 0 0", fontSize: 15, color: "#6b7280", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                          <span>{activeSession.startTime} – {activeSession.endTime}</span>
                          <span>·</span>
                          {activeSession.status !== "ENDED" ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <button
                                type="button"
                                onClick={() => void handleUpdateCourts(-1)}
                                disabled={activeSession.numberOfCourts <= 1}
                                style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}
                              >−</button>
                              <span>{activeSession.numberOfCourts} sân</span>
                              <button
                                type="button"
                                onClick={() => void handleUpdateCourts(1)}
                                style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}
                              >+</button>
                            </span>
                          ) : (
                            <span>{activeSession.numberOfCourts} sân</span>
                          )}
                          <span>·</span>
                          <span>{checkedIn}/{total} người đã check-in</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, fontSize: 12, flexShrink: 0 }}>
                        {activeSession.status === "ACTIVE" ? (
                          <span style={{ background: "var(--color-background-success, #dcfce7)", color: "#0f6e56", padding: "4px 10px", borderRadius: 999, fontWeight: 500 }}>
                            ● LIVE {formatElapsed(activeSession.startedAt ?? activeSession.createdAt, sessionTick)}
                          </span>
                        ) : activeSession.status === "UPCOMING" ? (
                          <span className="status status-pending">Chưa bắt đầu</span>
                        ) : (
                          <span className="status status-completed">Đã kết thúc</span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ACTIVE: courts + suggestions + waiting */}
                {activeSession.status === "ACTIVE" ? (() => {
                  const playerMap: Record<number, typeof activeSession.players[number]> = {};
                  for (const p of activeSession.players) playerMap[p.id] = p;
                  const waitingPlayers = [...activeSession.players
                    .filter((p) => p.isCheckedIn && !p.isCurrentlyPlaying)]
                    .sort((a, b) => {
                      const base = new Date(activeSession.createdAt).getTime();
                      const wa = Date.now() - (a.lastMatchEndedAt ? new Date(a.lastMatchEndedAt).getTime() : base);
                      const wb = Date.now() - (b.lastMatchEndedAt ? new Date(b.lastMatchEndedAt).getTime() : base);
                      return wb - wa;
                    });
                  return (
                    <>
                      {/* Court grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 12 }}>
                        {Array.from({ length: activeSession.numberOfCourts }, (_, i) => i + 1).map((courtNum) => {
                          const match = activeSession.matches.find((m) => m.courtNumber === courtNum && m.status === "PLAYING");
                          const cardStyle = { background: "var(--color-background-primary, #fff)", borderRadius: 12, border: "0.5px solid var(--color-border-tertiary, #e5e7eb)", padding: "14px 16px" };
                          if (!match) {
                            return (
                              <div key={courtNum} style={cardStyle}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ fontWeight: 500, fontSize: 16 }}>Sân {courtNum}</span>
                                  <span style={{ fontSize: 13, color: "#9ca3af" }}>Sân trống</span>
                                </div>
                              </div>
                            );
                          }
                          const p1 = playerMap[match.teamAPlayer1Id];
                          const p2 = playerMap[match.teamAPlayer2Id];
                          const p3 = playerMap[match.teamBPlayer1Id];
                          const p4 = playerMap[match.teamBPlayer2Id];
                          return (
                            <div key={courtNum} style={cardStyle}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <span style={{ fontWeight: 500, fontSize: 16 }}>Sân {courtNum}</span>
                                <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 500 }}>
                                  ● Đang đánh · {formatElapsed(match.startedAt, sessionTick)}
                                </span>
                              </div>
                              {([
                                { players: [p1, p2] as const, score: match.scoreA, isA: true },
                                { players: [p3, p4] as const, score: match.scoreB, isA: false },
                              ] as const).map(({ players, score, isA }, ti) => {
                                const color = getAvatarColor(players[0]?.name ?? "");
                                return (
                                  <div key={ti} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: ti === 1 ? "0.5px solid var(--color-border-tertiary, #e5e7eb)" : undefined }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: color.bg, color: color.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                                        {getPlayerInitials(players[0]?.name ?? "?")}
                                      </div>
                                      <div style={{ fontSize: 15 }}>
                                        <div style={{ fontWeight: 500 }}>{players[0]?.name ?? "?"} &amp; {players[1]?.name ?? "?"}</div>
                                        <div style={{ color: "#9ca3af", fontSize: 13 }}>
                                          {getSessionSkillLabel(players[0]?.skillLevel ?? "TB")} · {getSessionSkillLabel(players[1]?.skillLevel ?? "TB")}
                                        </div>
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ fontSize: 24, fontWeight: 600, minWidth: 32, textAlign: "center" }}>{score}</span>
                                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                        <button type="button" style={{ fontSize: 12, padding: "2px 7px", lineHeight: 1.4 }}
                                          onClick={() => void handleUpdateScore(match.id, isA ? score + 1 : match.scoreA, isA ? match.scoreB : score + 1)}>+1</button>
                                        {score > 0 ? (
                                          <button type="button" style={{ fontSize: 12, padding: "2px 7px", lineHeight: 1.4 }}
                                            onClick={() => void handleUpdateScore(match.id, isA ? score - 1 : match.scoreA, isA ? match.scoreB : score - 1)}>−1</button>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                <button type="button" style={{ flex: 1, fontSize: 14, padding: "7px 10px" }}
                                  onClick={() => void handleEndMatch(match.id)}>
                                  Kết thúc trận
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Suggestions */}
                      {activeSession.suggestions.length > 0 ? (
                        <div style={{ background: "var(--color-background-primary, #fff)", borderRadius: 12, border: "0.5px solid var(--color-border-tertiary, #e5e7eb)", padding: "14px 16px", marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <span style={{ fontWeight: 500, fontSize: 16 }}>Lượt tiếp theo</span>
                            <span style={{ fontSize: 13, background: "#eeedfe", color: "#3c3489", padding: "3px 8px", borderRadius: 999, fontWeight: 500 }}>Gợi ý từ AI ghép cặp</span>
                          </div>
                          {activeSession.suggestions.map((sugg) => {
                            const optIdx = suggestionOptionIndex[sugg.court] ?? 0;
                            const opt = sugg.options[optIdx] ?? sugg.options[0];
                            if (!opt) return null;
                            return (
                              <div key={sugg.court} style={{ border: "0.5px solid var(--color-border-tertiary, #e5e7eb)", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                  <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 500 }}>SÂN {sugg.court} →</span>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    {sugg.options.length > 1 ? (
                                      <button type="button" style={{ fontSize: 13, padding: "5px 12px" }}
                                        onClick={() => handleCycleSuggestion(sugg.court, sugg.options.length)}>Đổi cặp</button>
                                    ) : null}
                                    <button type="button" className="primary-button" style={{ fontSize: 13, padding: "5px 12px" }}
                                      onClick={() => void handleConfirmMatch(sugg.court, opt)}>Xác nhận</button>
                                  </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, flexWrap: "wrap" }}>
                                  <span>
                                    <strong style={{ fontWeight: 500 }}>{opt.teamA[0]?.name}</strong>{" "}
                                    <span style={{ color: "#9ca3af", fontSize: 13 }}>{getSessionSkillLabel(opt.teamA[0]?.skillLevel ?? "TB")}</span>
                                    {" "}&amp;{" "}
                                    <strong style={{ fontWeight: 500 }}>{opt.teamA[1]?.name}</strong>{" "}
                                    <span style={{ color: "#9ca3af", fontSize: 13 }}>{getSessionSkillLabel(opt.teamA[1]?.skillLevel ?? "TB")}</span>
                                  </span>
                                  <span style={{ color: "#9ca3af", fontSize: 13 }}>vs</span>
                                  <span>
                                    <strong style={{ fontWeight: 500 }}>{opt.teamB[0]?.name}</strong>{" "}
                                    <span style={{ color: "#9ca3af", fontSize: 13 }}>{getSessionSkillLabel(opt.teamB[0]?.skillLevel ?? "TB")}</span>
                                    {" "}&amp;{" "}
                                    <strong style={{ fontWeight: 500 }}>{opt.teamB[1]?.name}</strong>{" "}
                                    <span style={{ color: "#9ca3af", fontSize: 13 }}>{getSessionSkillLabel(opt.teamB[1]?.skillLevel ?? "TB")}</span>
                                  </span>
                                </div>
                                {opt.reasons.length > 0 ? (
                                  <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12, flexWrap: "wrap" }}>
                                    {opt.reasons.map((r, ri) => (
                                      <span key={ri} style={{ color: r.type === "success" ? "#0f6e56" : r.type === "warning" ? "#b45309" : "#6b7280" }}>
                                        {r.type === "success" ? "✓ " : r.type === "warning" ? "⚠ " : "· "}{r.text}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      {/* Waiting list */}
                      {waitingPlayers.length > 0 ? (
                        <div style={{ background: "var(--color-background-primary, #fff)", borderRadius: 12, border: "0.5px solid var(--color-border-tertiary, #e5e7eb)", padding: "14px 16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                            <span style={{ fontWeight: 500, fontSize: 16 }}>Đang chờ</span>
                            <span style={{ fontSize: 14, color: "#6b7280" }}>{waitingPlayers.length} người · sắp xếp theo thời gian chờ</span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                            {waitingPlayers.map((p) => {
                              const c = getAvatarColor(p.name);
                              const base = new Date(activeSession.createdAt).getTime();
                              const waitMs = Date.now() - (p.lastMatchEndedAt ? new Date(p.lastMatchEndedAt).getTime() : base);
                              const waitMin = Math.floor(waitMs / 60_000);
                              return (
                                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "var(--color-background-secondary, #f9fafb)" }}>
                                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
                                    {getPlayerInitials(p.name)}
                                  </div>
                                  <div style={{ fontSize: 14, minWidth: 0 }}>
                                    <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                                    <div style={{ fontSize: 12, color: waitMin >= 10 ? "#b45309" : "#6b7280" }}>
                                      {waitMin > 0 ? `${waitMin} phút` : "Vừa xong"}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </>
                  );
                })() : null}

                {/* UPCOMING: player check-in grid */}
                {activeSession.status === "UPCOMING" ? (
                  <div style={{ background: "var(--color-background-primary, #fff)", borderRadius: 12, border: "0.5px solid var(--color-border-tertiary, #e5e7eb)", padding: "14px 16px" }}>
                    {activeSession.players.filter((p) => p.isCheckedIn).length < 4 ? (
                      <p style={{ margin: "0 0 12px", fontSize: 15, color: "#b45309" }}>
                        Cần ít nhất 4 người check-in để bắt đầu.
                      </p>
                    ) : null}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8 }}>
                      {activeSession.players.map((p) => {
                        const c = getAvatarColor(p.name);
                        return (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: p.isCheckedIn ? "var(--color-background-success, #f0fdf4)" : "var(--color-background-secondary, #f9fafb)" }}>
                            <div style={{ width: 34, height: 34, borderRadius: "50%", background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                              {getPlayerInitials(p.name)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                              <div style={{ fontSize: 13, color: "#6b7280" }}>{getSessionSkillLabel(p.skillLevel)}</div>
                            </div>
                            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                              <button type="button"
                                style={{ fontSize: 12, padding: "4px 9px", background: p.isCheckedIn ? "#dcfce7" : undefined, color: p.isCheckedIn ? "#166534" : undefined, border: "0.5px solid currentColor" }}
                                onClick={() => void handleToggleCheckIn(p.id)}>
                                {p.isCheckedIn ? "✓ Check" : "Check-in"}
                              </button>
                              <button type="button"
                                style={{ fontSize: 12, padding: "4px 9px", color: "#dc2626", border: "0.5px solid #dc2626" }}
                                onClick={() => void handleRemovePlayer(p.id)}>✕</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

              </div>{/* end gray board wrapper */}

              {/* Admin panel: add player + full player list (UPCOMING + ACTIVE) */}
              {activeSession.status !== "ENDED" ? (
                <div style={{ marginTop: 12, background: "var(--color-background-primary, #fff)", borderRadius: 12, border: "0.5px solid var(--color-border-tertiary, #e5e7eb)", padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 16, fontWeight: 500 }}>Người chơi ({activeSession.players.length})</span>
                    <button type="button" className="ghost-button" style={{ fontSize: 13 }}
                      onClick={() => setIsAddingPlayer((v) => !v)}>
                      {isAddingPlayer ? "Huỷ" : "+ Thêm người"}
                    </button>
                  </div>
                  {isAddingPlayer ? (
                    <form onSubmit={(e) => void handleAddPlayer(e)} style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                      <input placeholder="Tên người chơi" value={newPlayerForm.name}
                        onChange={(e) => setNewPlayerForm((f) => ({ ...f, name: e.target.value }))}
                        style={{ flex: 1, minWidth: 140 }} required />
                      <select value={newPlayerForm.skillLevel}
                        onChange={(e) => setNewPlayerForm((f) => ({ ...f, skillLevel: e.target.value as PlayerSkillLevel }))}
                        style={{ minWidth: 90 }}>
                        <option value="TB">TB</option>
                        <option value="TB_PLUS">TB+</option>
                        <option value="KHA">Khá</option>
                        <option value="GIOI">Giỏi</option>
                      </select>
                      <button type="submit" className="primary-button" style={{ fontSize: 13 }}>Thêm</button>
                    </form>
                  ) : null}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                    {activeSession.players.map((p) => {
                      const c = getAvatarColor(p.name);
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: p.isCheckedIn ? "var(--color-background-success, #f0fdf4)" : "var(--color-background-secondary, #f9fafb)", border: p.isCurrentlyPlaying ? "1.5px solid #16a34a" : "0.5px solid transparent" }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                            {getPlayerInitials(p.name)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                            <div style={{ fontSize: 13, color: "#6b7280" }}>
                              {getSessionSkillLabel(p.skillLevel)} · {p.matchesPlayed} trận{p.isCurrentlyPlaying ? " · Đang đánh" : ""}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            {!p.isCurrentlyPlaying ? (
                              <button type="button"
                                style={{ fontSize: 12, padding: "4px 9px", background: p.isCheckedIn ? "#dcfce7" : undefined, color: p.isCheckedIn ? "#166534" : undefined, border: "0.5px solid currentColor" }}
                                onClick={() => void handleToggleCheckIn(p.id)}>
                                {p.isCheckedIn ? "✓ Check" : "Check-in"}
                              </button>
                            ) : null}
                            {activeSession.status === "UPCOMING" ? (
                              <button type="button"
                                style={{ fontSize: 12, padding: "4px 9px", color: "#dc2626", border: "0.5px solid #dc2626" }}
                                onClick={() => void handleRemovePlayer(p.id)}>✕</button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

            </section>
          )}
        </section>
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

      {isTransactionModalOpen ? (
        <div
          className="modal-backdrop modal-backdrop-wide"
          role="presentation"
          onClick={() => setIsTransactionModalOpen(false)}
        >
          <div
            className="modal-card modal-card-fullscreen"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-head modal-head-sticky">
              <div>
                <h2 id="transaction-modal-title">{`Giao dịch cọc - ${selectedDate}`}</h2>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsTransactionModalOpen(false)}
              >
                Đóng
              </button>
            </div>

            <div className="fullscreen-history-list">
              {transactionBookings.length === 0 ? (
                <p className="empty-state">
                  Không có giao dịch nào phù hợp với bộ lọc.
                </p>
              ) : (
                transactionBookings.map((booking) => {
                  const txStatus = getTransactionStatus(booking);
                  const isPaidWhileCancelled =
                    txStatus === "paid_while_cancelled";
                  return (
                    <article
                      key={booking.id}
                      className="booking-card compact-card stadium-card"
                      style={
                        isPaidWhileCancelled
                          ? {
                              borderLeft: "4px solid #f59e0b",
                              backgroundColor: "#fffbeb",
                            }
                          : undefined
                      }
                    >
                      <div className="booking-card-top">
                        <div>
                          <h3>{booking.customerName}</h3>
                          <p>
                            {booking.bookingDate} · {booking.startTime} –{" "}
                            {booking.endTime}
                          </p>
                        </div>
                        <span
                          className={`status ${getTransactionStatusCssClass(txStatus)}`}
                        >
                          {getTransactionStatusLabel(txStatus)}
                        </span>
                      </div>

                      <div className="booking-meta">
                        {booking.customerPhone ? (
                          <span>{booking.customerPhone}</span>
                        ) : null}
                        <span>Mã: {booking.depositReference}</span>
                        <span>
                          {formatCurrencyDisplay(booking.depositAmount)} VNĐ
                        </span>
                        {booking.depositPaidAt ? (
                          <span>
                            Nhận lúc:{" "}
                            {new Date(booking.depositPaidAt).toLocaleString(
                              "vi-VN",
                            )}
                          </span>
                        ) : booking.depositExpiresAt &&
                          txStatus === "pending" ? (
                          <span>
                            Hết hạn lúc:{" "}
                            {new Date(booking.depositExpiresAt).toLocaleString(
                              "vi-VN",
                            )}
                          </span>
                        ) : null}
                        {booking.depositTransactionId ? (
                          <span>Mã GD: {booking.depositTransactionId}</span>
                        ) : null}
                      </div>

                      {booking.depositTransferNote ? (
                        <div className="booking-note">
                          <strong>Nội dung CK:</strong>{" "}
                          {booking.depositTransferNote}
                        </div>
                      ) : null}

                      {isPaidWhileCancelled ? (
                        <div className="booking-note">
                          Khách đã chuyển tiền nhưng booking bị huỷ trước khi
                          xác nhận. Kiểm tra sao kê ngân hàng và chọn hành
                          động phù hợp.
                        </div>
                      ) : null}

                      {isPaidWhileCancelled ? (
                        <div className="booking-actions">
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() =>
                              void handleRestoreBooking(booking.id)
                            }
                          >
                            Khôi phục đặt sân
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => void handleDeleteBooking(booking.id)}
                          >
                            Xóa booking
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
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
                <h2 id="queue-modal-title">{`Danh sách vợt thủ - ${selectedDate}`}</h2>
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
              {filteredRacketPlayerBookings.length === 0 ? (
                <p className="empty-state">
                  Không có vợt thủ nào phù hợp với bộ lọc trong ngày này.
                </p>
              ) : (
                filteredRacketPlayerBookings.map((booking) =>
                  renderAssignedBookingCard(
                    booking,
                    "booking-card compact-card stadium-card",
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



