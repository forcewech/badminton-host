import { FormEvent, useEffect, useState } from "react";
import ExcelJS from "exceljs";
import { Toaster, toast } from "react-hot-toast";
import { api, setApiAccessToken } from "./api";
import type {
  AuthSession,
  Booking,
  BookingSlot,
  Court,
  CourtPayload,
  CreateBookingPayload,
  CustomerGender,
  DashboardOverview,
  PlaySession,
  PlayerSkillLevel,
  PublicBookingSettings,
  QuickSlot,
  ShopItem,
  SkillLevel,
  TeamOption,
} from "./types";

const AUTH_STORAGE_KEY = "badminton-host-auth";


function getLocalDateInputValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

const today = getLocalDateInputValue();

const genderOptions: CustomerGender[] = ["MALE", "FEMALE", "OTHER"];
const skillLevelOptions: SkillLevel[] = [
  "Y",
  "TB_MINUS",
  "TB",
  "TB_PLUS",
  "KHA",
  "TUYEN",
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
  {
    id: "courts",
    label: "Quản lý sân",
    description: "Quản lý sân cầu lông",
  },
  {
    id: "court_assign",
    label: "Phân sân",
    description: "Phân khách hàng vào sân theo ngày",
  },
  {
    id: "shop",
    label: "Cửa hàng",
    description: "Quản lý sản phẩm hiển thị ở màn chuyển khoản",
  },
] as const;

const initialForm: CreateBookingPayload = {
  customerName: "",
  customerPhone: "",
  gender: "OTHER",
  skillLevel: "TB",
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
    case "Y":
      return "Y";
    case "TB_MINUS":
      return "TB-";
    case "TB":
      return "TB";
    case "TB_PLUS":
      return "TB+";
    case "KHA":
      return "Khá";
    case "TUYEN":
      return "Tuyển";
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
    case "Y":
      return "Y";
    case "TB_MINUS":
      return "TB-";
    case "TB":
      return "TB";
    case "TB_PLUS":
      return "TB+";
    case "KHA":
      return "Khá";
    case "TUYEN":
      return "Tuyển";
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
  const [isSectionTabsOpen, setIsSectionTabsOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("section-tabs-open") !== "false";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("section-tabs-open", String(isSectionTabsOpen));
  }, [isSectionTabsOpen]);
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
    maxPlayers: 12,
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
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
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
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(true);
  const [isWaitingOpen, setIsWaitingOpen] = useState(true);
  const [bookingSlots, setBookingSlots] = useState<BookingSlot[]>([]);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [slotCourtCounts, setSlotCourtCounts] = useState<Record<string, number>>({});
  const isBoardMode = boardModeId !== null;

  // ── Courts management state ─────────────────────────────────────────────────
  const [courts, setCourts] = useState<Court[]>([]);
  const [isCourtFormOpen, setIsCourtFormOpen] = useState(false);
  const [editingCourt, setEditingCourt] = useState<Court | null>(null);
  const [courtFormDraft, setCourtFormDraft] = useState<CourtPayload>({
    name: "",
    zone: "",
    hourlyRate: 0,
    isActive: true,
  });
  const [isCourtSubmitting, setIsCourtSubmitting] = useState(false);

  // ── Court assign filter state ───────────────────────────────────────────────
  const [assignCourtFilter, setAssignCourtFilter] = useState<"all" | "unassigned" | "assigned">("all");
  const [assignSlotFilter, setAssignSlotFilter] = useState<string>("all");
  const [assignSearchTerm, setAssignSearchTerm] = useState<string>("");
  const [assignSkillFilter, setAssignSkillFilter] = useState<SkillLevel | "all">("all");

  useEffect(() => {
    setAssignSlotFilter("all");
  }, [selectedDate]);

  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [editingShopItem, setEditingShopItem] = useState<ShopItem | null>(null);
  const [shopFormDraft, setShopFormDraft] = useState<{
    name: string;
    imageUrl: string;
    imagePublicId: string;
    priceLabel: string;
    link: string;
    displayOrder: number;
    isActive: boolean;
  }>({
    name: "",
    imageUrl: "",
    imagePublicId: "",
    priceLabel: "",
    link: "",
    displayOrder: 0,
    isActive: true,
  });
  const [isShopFormOpen, setIsShopFormOpen] = useState(false);
  const [isShopSubmitting, setIsShopSubmitting] = useState(false);
  const [isShopImageUploading, setIsShopImageUploading] = useState(false);
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

    toast.error(error);
  }, [error]);

  useEffect(() => {
    if (!loginError) {
      return;
    }

    toast.error(loginError);
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
      toast.success("Ảnh khách đã được lưu sẵn.");
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
    if (!authSession || activeSectionTab !== "shop") return;
    void loadShopItems();
  }, [authSession, activeSectionTab]);

  useEffect(() => {
    if (!authSession) return;
    if (activeSectionTab !== "courts" && activeSectionTab !== "court_assign") return;
    void loadCourts();
  }, [authSession, activeSectionTab]);

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
      setIsSlotsLoading(true);
      try {
        const [sessions, slots] = await Promise.all([
          api.getSessions(),
          api.getBookingSlots(selectedDate),
        ]);
        setSessions(sessions);
        setBookingSlots(slots);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thể tải dữ liệu điều phối");
      } finally {
        setIsSlotsLoading(false);
      }
    })();
  }, [authSession, activeSectionTab, selectedDate]);

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
      toast.success("Đăng nhập thành công.");
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
    toast("Bạn đã đăng xuất khỏi hệ thống.");
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
      const submittedDate = form.bookingDate;
      await api.createBooking(form);
      setForm({ ...initialForm, bookingDate: submittedDate });
      setSelectedDate(submittedDate);
      await Promise.all([loadData(), handleLoadBookingSlots(submittedDate)]);
      toast.success("Đã thêm khách vào danh sách.");
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
        maxPlayers: quickSlotDraft.maxPlayers,
      });
      await Promise.all([
        loadSlotManagementQuickSlots(selectedDate),
        form.bookingDate === selectedDate
          ? loadQuickSlots(selectedDate)
          : Promise.resolve(),
      ]);
      toast.success("Thêm khung giờ chơi mới vào ngày đã chọn thành công.");
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

  async function handleQuickSlotMaxPlayersUpdate(id: number, maxPlayers: number) {
    if (maxPlayers < 1 || maxPlayers > 100) return;
    try {
      await api.updateQuickSlotMaxPlayers(id, maxPlayers);
      await Promise.all([
        loadSlotManagementQuickSlots(selectedDate),
        form.bookingDate === selectedDate
          ? loadQuickSlots(selectedDate)
          : Promise.resolve(),
      ]);
      toast.success("Đã cập nhật số người tối đa.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật số người tối đa");
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
      toast("Đã xóa khung giờ chơi khỏi ngày đã chọn.");
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
      toast.success("Đã cập nhật tiền cọc áp dụng cho booking QR ở site khách hàng.");
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
      const updated = await api.checkIn(id);
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      toast.success("Đã check-in khách.");
      if (activeSession) {
        void api.getSession(activeSession.id).then((s) => {
          setActiveSession(s);
          setSessions((prev) => prev.map((x) => (x.id === s.id ? s : x)));
        }).catch(() => {});
      }
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Check-in thất bại",
      );
    }
  }

  async function loadShopItems() {
    try {
      const items = await api.getShopItemsAdmin();
      setShopItems(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách shop");
    }
  }

  // ── Courts handlers ─────────────────────────────────────────────────────────
  async function loadCourts() {
    try {
      const data = await api.getCourts();
      setCourts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách sân");
    }
  }

  function openCourtFormForCreate() {
    setEditingCourt(null);
    setCourtFormDraft({ name: "", zone: "", hourlyRate: 0, isActive: true });
    setIsCourtFormOpen(true);
  }

  function openCourtFormForRename(court: Court) {
    setEditingCourt(court);
    setCourtFormDraft({
      name: court.name,
      zone: court.zone,
      hourlyRate: court.hourlyRate,
      isActive: court.isActive,
    });
    setIsCourtFormOpen(true);
  }

  function closeCourtForm() {
    setIsCourtFormOpen(false);
    setEditingCourt(null);
  }

  async function handleCourtSubmit() {
    if (!courtFormDraft.name.trim()) {
      toast.error("Vui lòng nhập tên sân.");
      return;
    }
    setIsCourtSubmitting(true);
    try {
      if (editingCourt) {
        await api.updateCourt(editingCourt.id, {
          name: courtFormDraft.name.trim(),
        });
        toast.success("Đã cập nhật tên sân.");
      } else {
        await api.createCourt({
          name: courtFormDraft.name.trim(),
          zone: "",
          hourlyRate: 0,
          isActive: true,
        });
        toast.success("Đã thêm sân.");
      }
      await loadCourts();
      closeCourtForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lưu sân thất bại");
    } finally {
      setIsCourtSubmitting(false);
    }
  }

  async function handleAssignCourtToBooking(bookingId: number, courtId: number | null) {
    try {
      const updated = await api.assignCourt(bookingId, courtId);
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      toast.success(courtId ? "Đã phân sân." : "Đã bỏ phân sân.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Phân sân thất bại");
    }
  }

  async function exportCourtAssignmentToExcel() {
    if (courts.length === 0) {
      toast.error("Chưa có sân nào trong hệ thống.");
      return;
    }

    const bookingsForDate = bookings
      .filter((b) => b.bookingDate === selectedDate)
      .filter((b) => b.depositPaid)
      .filter((b) => b.status !== "CANCELLED");

    const assigned = bookingsForDate.filter((b) => b.court);
    if (assigned.length === 0) {
      toast.error("Chưa có khách nào được phân sân.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("PhanSan");

    // Collect all unique slots from bookings
    const slots = Array.from(
      new Map(
        bookingsForDate.map((b) => [
          `${b.startTime}|${b.endTime}`,
          { startTime: b.startTime, endTime: b.endTime },
        ]),
      ).values(),
    ).sort((a, b) => a.startTime.localeCompare(b.startTime));

    const sortedCourts = [...courts].sort((a, b) => a.name.localeCompare(b.name));
    const totalCols = 1 + sortedCourts.length; // STT + courts

    // Set widths: STT narrow, courts wide
    worksheet.getColumn(1).width = 6;
    for (let i = 0; i < sortedCourts.length; i++) {
      worksheet.getColumn(i + 2).width = 22;
    }

    // Helper to convert col index (1-based) to Excel letter
    const colLetter = (n: number) => {
      let s = "";
      while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
      }
      return s;
    };

    for (let slotIdx = 0; slotIdx < slots.length; slotIdx++) {
      const slot = slots[slotIdx];
      const slotLabel = `${slot.startTime} – ${slot.endTime}`;
      const slotBookings = bookingsForDate.filter(
        (b) => b.startTime === slot.startTime && b.endTime === slot.endTime,
      );

      // Slot title row (merged across all columns)
      const titleRow = worksheet.addRow([`🕐 ${slotLabel}  (${slotBookings.length} khách)`]);
      const titleRowNum = titleRow.number;
      worksheet.mergeCells(`${colLetter(1)}${titleRowNum}:${colLetter(totalCols)}${titleRowNum}`);
      const titleCell = worksheet.getCell(`${colLetter(1)}${titleRowNum}`);
      titleCell.font = { bold: true, size: 13, color: { argb: "FF1E3A8A" } };
      titleCell.alignment = { vertical: "middle", horizontal: "left" };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC7D2FE" } };
      titleRow.height = 22;

      // Header row 1: court names (STT empty)
      const headerRowA = worksheet.addRow(["", ...sortedCourts.map((c) => c.name)]);
      headerRowA.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin", color: { argb: "FF93C5FD" } },
          left: { style: "thin", color: { argb: "FF93C5FD" } },
          right: { style: "thin", color: { argb: "FF93C5FD" } },
          bottom: { style: "thin", color: { argb: "FF93C5FD" } },
        };
        if (colNum > totalCols) return;
      });
      headerRowA.height = 20;

      // Header row 2: STT + "Tên" labels
      const headerRowB = worksheet.addRow(["STT", ...sortedCourts.map(() => "Tên")]);
      headerRowB.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
        cell.font = { bold: true, size: 11, color: { argb: "FF374151" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin", color: { argb: "FF93C5FD" } },
          left: { style: "thin", color: { argb: "FF93C5FD" } },
          right: { style: "thin", color: { argb: "FF93C5FD" } },
          bottom: { style: "thin", color: { argb: "FF93C5FD" } },
        };
      });

      // Build per-court booking lists
      const courtToBookings: Booking[][] = sortedCourts.map((court) =>
        sortBookingsStable(slotBookings.filter((b) => b.court?.id === court.id)),
      );
      const maxRows = Math.max(0, ...courtToBookings.map((list) => list.length));

      for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
        const rowValues: (string | number)[] = [rowIdx + 1];
        for (const list of courtToBookings) {
          const booking = list[rowIdx];
          rowValues.push(booking ? booking.customerName : "");
        }
        const row = worksheet.addRow(rowValues);
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.alignment = { vertical: "middle", horizontal: colNum === 1 ? "center" : "left" };
          cell.border = {
            top: { style: "thin", color: { argb: "FFDBEAFE" } },
            left: { style: "thin", color: { argb: "FFDBEAFE" } },
            right: { style: "thin", color: { argb: "FFDBEAFE" } },
            bottom: { style: "thin", color: { argb: "FFDBEAFE" } },
          };
          if (colNum === 1) {
            cell.font = { color: { argb: "FF6B7280" }, size: 11 };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
          } else {
            const courtIdx = colNum - 2;
            const list = courtToBookings[courtIdx];
            const booking = list?.[rowIdx];
            if (booking && booking.gender === "FEMALE") {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBCFE8" } };
            }
          }
        });
        row.height = 18;
      }

      // Unassigned section (rendered as a single column list under the table)
      const unassigned = sortBookingsStable(slotBookings.filter((b) => !b.court));
      if (unassigned.length > 0) {
        const unaTitleRow = worksheet.addRow([`▶ Chưa phân sân (${unassigned.length} khách)`]);
        const unaTitleNum = unaTitleRow.number;
        worksheet.mergeCells(`${colLetter(1)}${unaTitleNum}:${colLetter(totalCols)}${unaTitleNum}`);
        const unaCell = worksheet.getCell(`${colLetter(1)}${unaTitleNum}`);
        unaCell.font = { bold: true, color: { argb: "FF92400E" }, size: 12 };
        unaCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
        unaCell.alignment = { vertical: "middle", horizontal: "left" };
        unaTitleRow.height = 20;

        for (let i = 0; i < unassigned.length; i++) {
          const booking = unassigned[i];
          const row = worksheet.addRow([i + 1, booking.customerName]);
          row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
          row.getCell(1).font = { color: { argb: "FF6B7280" }, size: 11 };
          row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
          if (booking.gender === "FEMALE") {
            row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBCFE8" } };
          }
          for (let c = 1; c <= totalCols; c++) {
            row.getCell(c).border = {
              top: { style: "thin", color: { argb: "FFDBEAFE" } },
              left: { style: "thin", color: { argb: "FFDBEAFE" } },
              right: { style: "thin", color: { argb: "FFDBEAFE" } },
              bottom: { style: "thin", color: { argb: "FFDBEAFE" } },
            };
          }
        }
      }

      // Spacer row between slots
      if (slotIdx < slots.length - 1) {
        worksheet.addRow([]);
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedDate}-phan-san.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetShopFormDraft() {
    setShopFormDraft({
      name: "",
      imageUrl: "",
      imagePublicId: "",
      priceLabel: "",
      link: "",
      displayOrder: shopItems.length,
      isActive: true,
    });
    setEditingShopItem(null);
  }

  function openShopFormForCreate() {
    resetShopFormDraft();
    setIsShopFormOpen(true);
  }

  function openShopFormForEdit(item: ShopItem) {
    setEditingShopItem(item);
    setShopFormDraft({
      name: item.name,
      imageUrl: item.imageUrl ?? "",
      imagePublicId: item.imagePublicId ?? "",
      priceLabel: item.priceLabel ?? "",
      link: item.link ?? "",
      displayOrder: item.displayOrder,
      isActive: item.isActive,
    });
    setIsShopFormOpen(true);
  }

  function closeShopForm() {
    setIsShopFormOpen(false);
    resetShopFormDraft();
  }

  async function handleShopImageUpload(file: File | null) {
    if (!file) return;
    setIsShopImageUploading(true);
    try {
      const result = await api.uploadShopImage(file);
      setShopFormDraft((d) => ({
        ...d,
        imageUrl: result.url,
        imagePublicId: result.publicId,
      }));
      toast.success("Đã tải ảnh sản phẩm.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải ảnh");
    } finally {
      setIsShopImageUploading(false);
    }
  }

  async function handleShopSubmit() {
    if (!shopFormDraft.name.trim()) {
      toast.error("Vui lòng nhập tên sản phẩm.");
      return;
    }
    setIsShopSubmitting(true);
    try {
      const payload = {
        name: shopFormDraft.name.trim(),
        imageUrl: shopFormDraft.imageUrl || null,
        imagePublicId: shopFormDraft.imagePublicId || null,
        priceLabel: shopFormDraft.priceLabel.trim() || null,
        link: shopFormDraft.link.trim() || null,
        displayOrder: shopFormDraft.displayOrder,
        isActive: shopFormDraft.isActive,
      };
      if (editingShopItem) {
        await api.updateShopItem(editingShopItem.id, payload);
        toast.success("Đã cập nhật sản phẩm.");
      } else {
        await api.createShopItem(payload);
        toast.success("Đã thêm sản phẩm.");
      }
      await loadShopItems();
      closeShopForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lưu sản phẩm thất bại");
    } finally {
      setIsShopSubmitting(false);
    }
  }

  async function handleShopDelete(id: number) {
    if (!window.confirm("Xóa sản phẩm này?")) return;
    try {
      await api.deleteShopItem(id);
      await loadShopItems();
      toast("Đã xóa sản phẩm.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xóa sản phẩm thất bại");
    }
  }

  async function handleShopToggleActive(item: ShopItem) {
    try {
      await api.updateShopItem(item.id, { isActive: !item.isActive });
      await loadShopItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cập nhật trạng thái thất bại");
    }
  }

  async function handleResetPastData() {
    setIsResetting(true);
    try {
      const result = await api.resetPastData();
      await loadData();
      setIsResetModalOpen(false);
      toast.success(`Đã xóa ${result.deleted.bookings} booking, ${result.deleted.sessions} buổi chơi, ${result.deleted.quickSlots} khung giờ quá khứ.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xóa dữ liệu thất bại");
    } finally {
      setIsResetting(false);
    }
  }

  async function handleFullPayment(id: number) {
    try {
      const updated = await api.confirmFullPayment(id);
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      toast.success("Đã xác nhận thanh toán đủ.");
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
      const updated = await api.markNoShow(id);
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      toast.error("Khách đã được đánh dấu không đến.");
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
      const updated = await api.restoreBooking(id);
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      toast.success("Booking đã được khôi phục và đưa lại vào danh sách vợt thủ.");
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
      setBookings((prev) => prev.filter((b) => b.id !== id));
      toast("Đã xóa booking của khách.");
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
      toast.success("Đã tạo buổi chơi mới.");
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
      const slotKey = `${slot.startTime}|${slot.endTime}`;
      const courtCount = slotCourtCounts[slotKey] ?? Math.max(slot.courts.length, 1);
      const session = await api.createSessionFromSlot(
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
      setSessions((prev) => {
        const exists = prev.some((s) => s.id === session.id);
        return exists ? prev.map((s) => (s.id === session.id ? session : s)) : [session, ...prev];
      });
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
      toast.success(status === "ACTIVE" ? "Buổi chơi đã bắt đầu!" : "Buổi chơi đã kết thúc.");
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
      toast.success("Đã thêm người chơi.");
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
      void loadData();
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
      toast.success(`Trận đấu sân ${courtNumber} đã bắt đầu!`);
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
      toast("Trận đấu đã kết thúc.");
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
      toast.success("Link Màn hình TV đã được copy.");
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
      const updated = await api.updateMatchTracking(id, slot, checked);
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      toast(checked ? "Đã đánh dấu hoàn thành lượt chơi." : "Đã bỏ đánh dấu lượt chơi.");
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
    index?: number,
  ) {
    const avatar = getAvatarColor(booking.customerName);
    const isCheckedIn =
      booking.status === "CHECKED_IN" || booking.status === "COMPLETED";
    const isNoShow = booking.status === "NO_SHOW";
    const isFemale = booking.gender === "FEMALE";

    return (
      <div
        key={booking.id}
        className="racket-row"
        onClick={() => setDetailBooking(booking)}
        style={{
          background: isFemale ? "#fdf2f8" : "#fff",
        }}
      >
        {typeof index === "number" ? (
          <div className="racket-row-stt">{index + 1}</div>
        ) : null}
        <div
          className="racket-row-avatar"
          style={{ background: avatar.bg, color: avatar.fg }}
        >
          {getPlayerInitials(booking.customerName)}
        </div>

        <div className="racket-row-info">
          <div className="racket-row-name">{booking.customerName}</div>
          <div className="racket-row-meta">
            <span className="racket-row-skill">
              {getSkillLevelLabel(booking.skillLevel)}
            </span>
            <span>·</span>
            <span>
              {booking.startTime}–{booking.endTime}
            </span>
            {booking.fullPaymentTransferred ? (
              <>
                <span>·</span>
                <span style={{ color: "#15803d", fontWeight: 500 }}>
                  ✓ Đã TT đủ
                </span>
              </>
            ) : null}
          </div>
        </div>

        <span
          className={`status status-${booking.status.toLowerCase()}`}
          style={{ fontSize: 11, padding: "3px 8px", flexShrink: 0 }}
        >
          {booking.status}
        </span>

        <div
          className="racket-row-actions"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            title="Check-in"
            className="racket-row-icon-btn racket-row-icon-checkin"
            disabled={isCheckedIn || isNoShow}
            onClick={() => handleCheckIn(booking.id)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>

          <button
            type="button"
            title="Xác nhận thanh toán đủ"
            className="racket-row-icon-btn racket-row-icon-paid"
            disabled={booking.status !== "CHECKED_IN" || booking.fullPaymentTransferred}
            onClick={() => handleFullPayment(booking.id)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <circle cx="12" cy="12" r="2.5" />
              <path d="M6 10v.01M18 14v.01" />
            </svg>
          </button>

          <button
            type="button"
            title="Không đến"
            className="racket-row-icon-btn racket-row-icon-noshow"
            disabled={!booking.depositPaid || isCheckedIn || isNoShow}
            onClick={() => handleNoShow(booking.id)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <button
            type="button"
            title="Xóa đặt sân"
            className="racket-row-icon-btn racket-row-icon-delete"
            onClick={() => handleDeleteBooking(booking.id)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>
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
    });

  async function exportHistoryToExcel() {
    const exportBookings = filteredRacketPlayerBookings;

    if (exportBookings.length === 0) {
      toast.error("Không có dữ liệu phù hợp với bộ lọc để xuất.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("QuảnLýSân");

    worksheet.columns = [
      { header: "Ngày", key: "date", width: 13 },
      { header: "Giờ bắt đầu", key: "startTime", width: 12 },
      { header: "Giờ kết thúc", key: "endTime", width: 12 },
      { header: "Tên khách hàng", key: "name", width: 22 },
      { header: "Giới tính", key: "gender", width: 10 },
      { header: "Trình độ", key: "skill", width: 10 },
      { header: "Số điện thoại", key: "phone", width: 15 },
      { header: "Số tiền cọc", key: "deposit", width: 13 },
      { header: "Nội dung CK", key: "ref", width: 22 },
      { header: "Đã TT cọc", key: "depositPaid", width: 12 },
      { header: "Đã TT đủ", key: "fullPaid", width: 14 },
      { header: "Trạng thái", key: "status", width: 14 },
      { header: "Check-in", key: "checkin", width: 14 },
      { header: "Ghi chú", key: "notes", width: 28 },
    ];

    worksheet.autoFilter = "A1:N1";

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FF999999" } },
      };
    });

    for (const booking of exportBookings) {
      const isCheckedIn = booking.status === "CHECKED_IN" || booking.status === "COMPLETED";
      const isFullPaid = booking.fullPaymentTransferred;
      const row = worksheet.addRow({
        date: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        name: booking.customerName,
        gender: getGenderLabel(booking.gender),
        skill: getSkillLevelLabel(booking.skillLevel),
        phone: booking.customerPhone,
        deposit: booking.depositAmount,
        ref: booking.depositReference ?? "",
        depositPaid: booking.depositPaid ? "Có" : "Không",
        fullPaid: isFullPaid ? "✓ Đã TT đủ" : "",
        status: booking.status,
        checkin: isCheckedIn ? "✓ Đã check-in" : "",
        notes: booking.notes,
      });

      const fillColor = isFullPaid ? "FFFF9999" : isCheckedIn ? "FFFFFF00" : null;
      if (fillColor) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedDate}-quản-lý.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
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
      <Toaster position="top-center" />
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
            {bookings.filter((b) => b.bookingDate === selectedDate && b.status !== "CANCELLED").length} lượt đặt
            <span style={{ display: "block", fontSize: "0.55em", fontWeight: 400, opacity: 0.85, marginTop: 2, letterSpacing: "0.02em" }}>
              {selectedDate === today ? "Hôm nay" : selectedDate}
            </span>
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

      <div className="global-date-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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
        <button
          type="button"
          className="ghost-button"
          style={{ color: "#b91c1c", background: "#fff1f2", fontSize: 13, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}
          onClick={() => setIsResetModalOpen(true)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          Xóa dữ liệu cũ
        </button>
      </div>

      {(() => {
        const activeTab = mainSectionTabs.find((t) => t.id === activeSectionTab);
        return (
          <div className="section-tabs-wrapper">
            <button
              type="button"
              className="section-tabs-toggle"
              onClick={() => setIsSectionTabsOpen((v) => !v)}
              aria-expanded={isSectionTabsOpen}
              aria-controls="section-tabs-list"
            >
              <div className="section-tabs-toggle-info">
                <span className="section-tabs-toggle-label">Khu vực hiện tại:</span>
                <strong>{activeTab?.label ?? "—"}</strong>
              </div>
              <span className="section-tabs-toggle-action">
                {isSectionTabsOpen ? (
                  <>
                    Ẩn tabs
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 15l-6-6-6 6" />
                    </svg>
                  </>
                ) : (
                  <>
                    Hiện tabs
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </>
                )}
              </span>
            </button>

            {isSectionTabsOpen ? (
              <nav
                id="section-tabs-list"
                className="section-tabs"
                aria-label="Điều hướng khu vực chính"
              >
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
            ) : null}
          </div>
        );
      })()}

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
                    onChange={(event) => {
                      const d = event.target.value;
                      setForm({ ...form, bookingDate: d });
                      setSelectedDate(d);
                      void handleLoadBookingSlots(d);
                    }}
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
              <button
                type="button"
                className="ghost-button view-button"
                title="Xem danh sách đầy đủ"
                aria-label="Xem danh sách đầy đủ"
                onClick={() => setIsQueueModalOpen(true)}
                style={{ padding: "8px 10px" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
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
                onClick={() => void exportHistoryToExcel()}
              >
                Xuất Excel
              </button>
            </div>
            <div className="schedule-list">
              {filteredRacketPlayerBookings.length === 0 ? (
                <p className="empty-state">
                  Không có vợt thủ nào phù hợp với bộ lọc trong ngày này.
                </p>
              ) : (
                filteredRacketPlayerBookings.map((booking, index) =>
                  renderAssignedBookingCard(booking, index),
                )
              )}
            </div>
          </section>
        ) : null}
      </main>

      {isResetModalOpen ? (
        <div className="modal-backdrop" style={{ zIndex: 60 }} onClick={() => !isResetting && setIsResetModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: 400, padding: 0, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ background: "linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)", padding: "28px 28px 20px", textAlign: "center", borderBottom: "1px solid #fecaca" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#991b1b" }}>Xóa dữ liệu quá khứ</h3>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#b91c1c", opacity: 0.8 }}>Hành động này không thể hoàn tác</p>
            </div>
            <div style={{ padding: "20px 28px 24px" }}>
              <p style={{ margin: "0 0 16px", fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                Toàn bộ dữ liệu các ngày <strong>trước hôm nay</strong> sẽ bị xóa vĩnh viễn:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {[
                  { icon: "📋", label: "Tất cả booking" },
                  { icon: "🕐", label: "Tất cả khung giờ" },
                  { icon: "🏸", label: "Buổi chơi, trận đấu và người chơi" },
                ].map(({ icon, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "#f9fafb", borderRadius: 10, fontSize: 13, color: "#374151" }}>
                    <span style={{ fontSize: 15 }}>{icon}</span>
                    {label}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="ghost-button"
                  style={{ flex: 1 }}
                  onClick={() => setIsResetModalOpen(false)}
                  disabled={isResetting}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  style={{ flex: 1, border: "none", borderRadius: 999, padding: "10px 20px", fontWeight: 600, fontSize: 14, cursor: isResetting ? "not-allowed" : "pointer", background: isResetting ? "#fca5a5" : "#dc2626", color: "white", transition: "background 0.15s, transform 0.15s", transform: "none" }}
                  onClick={() => void handleResetPastData()}
                  disabled={isResetting}
                >
                  {isResetting ? "Đang xóa..." : "Xóa vĩnh viễn"}
                </button>
              </div>
            </div>
          </div>
        </div>
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

                  <label>
                    Số người tối đa
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={quickSlotDraft.maxPlayers}
                      onChange={(event) =>
                        setQuickSlotDraft({
                          ...quickSlotDraft,
                          maxPlayers: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                      required
                    />
                  </label>

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
                    slotManagementSlots.map((slot) => {
                      const isFull = slot.currentBookings >= slot.maxPlayers;
                      return (
                        <div key={slot.id} className="quick-slot-admin-item">
                          <div>
                            <strong>
                              {formatQuickSlotLabel(slot.startTime, slot.endTime)}
                            </strong>
                            <small>
                              {slot.bookingDate} ·{" "}
                              <span style={{ color: isFull ? "#b91c1c" : "#6b7280", fontWeight: 500 }}>
                                {slot.currentBookings}/{slot.maxPlayers} người
                                {isFull ? " (đã đủ)" : ""}
                              </span>
                            </small>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7280" }}>
                              Tối đa
                              <input
                                type="number"
                                min={1}
                                max={100}
                                defaultValue={slot.maxPlayers}
                                onBlur={(e) => {
                                  const v = Math.max(1, Number(e.target.value) || 1);
                                  if (v !== slot.maxPlayers) {
                                    void handleQuickSlotMaxPlayersUpdate(slot.id, v);
                                  }
                                }}
                                style={{ width: 70 }}
                              />
                            </label>
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => void handleQuickSlotDelete(slot.id)}
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                      );
                    })
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
                title="Xem danh sách đầy đủ"
                aria-label="Xem danh sách đầy đủ"
                onClick={() => setIsTransactionModalOpen(true)}
                style={{ padding: "8px 10px" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
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
                transactionBookings.map((booking, index) => {
                  const txStatus = getTransactionStatus(booking);
                  const isPaidWhileCancelled =
                    txStatus === "paid_while_cancelled";
                  return (
                    <article
                      key={booking.id}
                      className="booking-card compact-card"
                      data-stt={index + 1}
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
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="racket-row-stt" style={{ flexShrink: 0 }}>{index + 1}</div>
                          <div>
                            <h3 style={{ margin: 0 }}>{booking.customerName}</h3>
                            <p style={{ margin: "2px 0 0" }}>
                              {booking.bookingDate} · {booking.startTime} –{" "}
                              {booking.endTime}
                            </p>
                          </div>
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
                <button
                  type="button"
                  className="ghost-button"
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => void handleLoadBookingSlots(selectedDate)}
                  disabled={isSlotsLoading}
                >
                  {isSlotsLoading ? "Đang tải..." : "Làm mới"}
                </button>
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
                          {/* <button type="button" className="ghost-button" onClick={() => handleOpenTVBoard(activeSession.id)}>
                            📺 Màn hình TV
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => void handleCopyTVBoardLink(activeSession.id)}
                          >
                            Sao chép link
                          </button> */}
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
                      <div style={{ background: "var(--color-background-primary, #fff)", borderRadius: 12, border: "0.5px solid var(--color-border-tertiary, #e5e7eb)", padding: "14px 16px", marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isSuggestionsOpen ? 10 : 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 500, fontSize: 16 }}>Lượt tiếp theo</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsSuggestionsOpen((v) => !v)}
                            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#6b7280", background: "var(--color-background-secondary, #f9fafb)", border: "0.5px solid var(--color-border-tertiary, #e5e7eb)", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}
                          >
                            {isSuggestionsOpen ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6"/></svg>
                                Ẩn
                              </>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
                                {activeSession.suggestions.length > 0 ? `Hiện (${activeSession.suggestions.length})` : "Hiện"}
                              </>
                            )}
                          </button>
                        </div>
                        {isSuggestionsOpen && (
                          activeSession.suggestions.length === 0 ? (
                            <p style={{ margin: 0, fontSize: 14, color: "#9ca3af" }}>Chưa có gợi ý — đang chờ sân trống hoặc đủ người.</p>
                          ) : (
                            activeSession.suggestions.map((sugg) => {
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
                            })
                          )
                        )}
                      </div>

                      <div style={{ background: "var(--color-background-primary, #fff)", borderRadius: 12, border: "0.5px solid var(--color-border-tertiary, #e5e7eb)", padding: "14px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isWaitingOpen ? 10 : 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 500, fontSize: 16 }}>Đang chờ</span>
                            <span style={{ fontSize: 13, color: "#6b7280" }}>{waitingPlayers.length} người</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsWaitingOpen((v) => !v)}
                            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#6b7280", background: "var(--color-background-secondary, #f9fafb)", border: "0.5px solid var(--color-border-tertiary, #e5e7eb)", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}
                          >
                            {isWaitingOpen ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6"/></svg>
                                Ẩn
                              </>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
                                Hiện
                              </>
                            )}
                          </button>
                        </div>
                        {isWaitingOpen && (
                          waitingPlayers.length === 0 ? (
                            <p style={{ margin: 0, fontSize: 14, color: "#9ca3af" }}>Không có ai đang chờ.</p>
                          ) : (
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
                          )
                        )}
                      </div>
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
                      {[...activeSession.players].sort((a, b) => a.id - b.id).map((p) => {
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
                        <option value="Y">Y</option>
                        <option value="TB_MINUS">TB-</option>
                        <option value="TB">TB</option>
                        <option value="TB_PLUS">TB+</option>
                        <option value="KHA">Khá</option>
                        <option value="TUYEN">Tuyển</option>
                      </select>
                      <button type="submit" className="primary-button" style={{ fontSize: 13 }}>Thêm</button>
                    </form>
                  ) : null}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                    {[...activeSession.players].sort((a, b) => a.id - b.id).map((p) => {
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

      {activeSectionTab === "shop" ? (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="panel-tag">Cửa hàng</p>
              <h2>Sản phẩm hiển thị ở màn chuyển khoản</h2>
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={openShopFormForCreate}
            >
              + Thêm sản phẩm
            </button>
          </div>

          {shopItems.length === 0 ? (
            <p className="empty-state">Chưa có sản phẩm nào.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {shopItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: item.isActive ? 1 : 0.55,
                  }}
                >
                  <div style={{ aspectRatio: "1 / 1", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {item.imageUrl ? (
                      <img
                        src={getDisplayPhotoUrl(item.imageUrl)}
                        alt={item.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ color: "#9ca3af", fontSize: 13 }}>Chưa có ảnh</span>
                    )}
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{item.name}</p>
                    {item.priceLabel ? (
                      <p style={{ margin: "2px 0 0", fontSize: 13, color: "#7c3aed" }}>{item.priceLabel}</p>
                    ) : null}
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>
                      Thứ tự: {item.displayOrder}
                      {!item.isActive ? " · Đang tắt" : ""}
                    </p>
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="ghost-button"
                        style={{ fontSize: 12, padding: "4px 8px" }}
                        onClick={() => openShopFormForEdit(item)}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        style={{ fontSize: 12, padding: "4px 8px" }}
                        onClick={() => void handleShopToggleActive(item)}
                      >
                        {item.isActive ? "Tắt" : "Bật"}
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        style={{ fontSize: 12, padding: "4px 8px", color: "#dc2626" }}
                        onClick={() => void handleShopDelete(item.id)}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeSectionTab === "courts" ? (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="panel-tag">Quản lý sân</p>
              <h2>Danh sách sân ({courts.length})</h2>
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={openCourtFormForCreate}
            >
              + Thêm sân
            </button>
          </div>

          {courts.length === 0 ? (
            <p className="empty-state">Chưa có sân nào. Nhấn "Thêm sân" để bắt đầu.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
              {[...courts].sort((a, b) => a.name.localeCompare(b.name)).map((court) => (
                <div
                  key={court.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <strong style={{ fontSize: 15 }}>{court.name}</strong>
                  <button
                    type="button"
                    className="ghost-button"
                    style={{ fontSize: 12, padding: "5px 10px" }}
                    onClick={() => openCourtFormForRename(court)}
                  >
                    Sửa tên
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeSectionTab === "court_assign" ? (() => {
        const dayBookings = sortBookingsStable(
          bookings
            .filter((b) => b.bookingDate === selectedDate)
            .filter((b) => b.depositPaid)
            .filter((b) => b.status !== "CANCELLED"),
        );

        const slotsForAssign = Array.from(
          new Map(
            dayBookings.map((b) => [`${b.startTime}|${b.endTime}`, { startTime: b.startTime, endTime: b.endTime }]),
          ).values(),
        ).sort((a, b) => a.startTime.localeCompare(b.startTime));

        const filteredAssignBookings = dayBookings
          .filter((b) =>
            b.customerName.toLowerCase().includes(assignSearchTerm.trim().toLowerCase()),
          )
          .filter((b) => {
            if (assignSlotFilter === "all") return true;
            return `${b.startTime}|${b.endTime}` === assignSlotFilter;
          })
          .filter((b) => {
            if (assignCourtFilter === "unassigned") return !b.court;
            if (assignCourtFilter === "assigned") return Boolean(b.court);
            return true;
          })
          .filter((b) => {
            if (assignSkillFilter === "all") return true;
            return b.skillLevel === assignSkillFilter;
          });

        const activeCourts = courts;
        const slotScopedBookings = assignSlotFilter === "all"
          ? dayBookings
          : dayBookings.filter((b) => `${b.startTime}|${b.endTime}` === assignSlotFilter);
        const assignedCount = slotScopedBookings.filter((b) => b.court).length;
        const unassignedCount = slotScopedBookings.length - assignedCount;
        const scopeLabel = assignSlotFilter === "all"
          ? "cả ngày"
          : `khung ${assignSlotFilter.replace("|", "–")}`;

        return (
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-tag">Phân sân</p>
                <h2>Phân khách hàng vào sân — {selectedDate}</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
                  ({scopeLabel}) Đã phân: {assignedCount} · Chưa phân: {unassignedCount} · Tổng: {slotScopedBookings.length}
                </p>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={() => void exportCourtAssignmentToExcel()}
              >
                Xuất Excel
              </button>
            </div>

            {courts.length === 0 ? (
              <p className="empty-state">
                Chưa có sân nào. Vào tab "Quản lý sân" để thêm sân trước.
              </p>
            ) : dayBookings.length === 0 ? (
              <p className="empty-state">Không có khách nào trong ngày {selectedDate}.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                {/* Left: filter + booking list */}
                <div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                    <input
                      type="text"
                      placeholder="Tìm theo tên..."
                      value={assignSearchTerm}
                      onChange={(e) => setAssignSearchTerm(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <select
                        value={assignSlotFilter}
                        onChange={(e) => setAssignSlotFilter(e.target.value)}
                        style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
                      >
                        <option value="all">Tất cả khung giờ</option>
                        {slotsForAssign.map((slot) => (
                          <option key={`${slot.startTime}|${slot.endTime}`} value={`${slot.startTime}|${slot.endTime}`}>
                            {slot.startTime}–{slot.endTime}
                          </option>
                        ))}
                      </select>
                      <select
                        value={assignCourtFilter}
                        onChange={(e) => setAssignCourtFilter(e.target.value as typeof assignCourtFilter)}
                        style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
                      >
                        <option value="all">Tất cả</option>
                        <option value="unassigned">Chưa phân sân</option>
                        <option value="assigned">Đã phân sân</option>
                      </select>
                      <select
                        value={assignSkillFilter}
                        onChange={(e) => setAssignSkillFilter(e.target.value as SkillLevel | "all")}
                        style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
                      >
                        <option value="all">Tất cả trình độ</option>
                        {skillLevelOptions.map((level) => (
                          <option key={level} value={level}>
                            {getSkillLevelLabel(level)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 600, overflowY: "auto", paddingRight: 4 }}>
                    {filteredAssignBookings.length === 0 ? (
                      <p className="empty-state">Không có khách nào phù hợp với bộ lọc.</p>
                    ) : (
                      filteredAssignBookings.map((booking, index) => {
                        const c = getAvatarColor(booking.customerName);
                        return (
                          <div
                            key={booking.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 12px",
                              borderRadius: 10,
                              border: "0.5px solid #e5e7eb",
                              background: booking.gender === "FEMALE" ? "#fdf2f8" : "#fff",
                            }}
                          >
                            <div className="racket-row-stt" style={{ flexShrink: 0 }}>{index + 1}</div>
                            <div style={{ width: 34, height: 34, borderRadius: "50%", background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                              {getPlayerInitials(booking.customerName)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {booking.customerName}
                              </div>
                              <div style={{ fontSize: 12, color: "#6b7280" }}>
                                {getSkillLevelLabel(booking.skillLevel)} · {booking.startTime}–{booking.endTime}
                              </div>
                            </div>
                            <select
                              value={booking.court?.id ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                void handleAssignCourtToBooking(booking.id, v ? Number(v) : null);
                              }}
                              style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12, minWidth: 110 }}
                            >
                              <option value="">— Chưa phân —</option>
                              {activeCourts.map((court) => (
                                <option key={court.id} value={court.id}>
                                  {court.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right: courts with assigned players (filtered by slot) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 700, overflowY: "auto", paddingRight: 4 }}>
                  {assignSlotFilter === "all" ? (
                    <div style={{
                      padding: "32px 20px",
                      borderRadius: 12,
                      background: "#f9fafb",
                      border: "1.5px dashed #d1d5db",
                      textAlign: "center",
                      color: "#6b7280",
                    }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🕐</div>
                      <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 500, color: "#374151" }}>
                        Vui lòng chọn một khung giờ
                      </p>
                      <p style={{ margin: 0, fontSize: 13 }}>
                        Sân sẽ hiển thị ở đây sau khi bạn chọn khung giờ ở bộ lọc bên trái.
                      </p>
                    </div>
                  ) : null}
                  {assignSlotFilter !== "all" && [...activeCourts].sort((a, b) => a.name.localeCompare(b.name)).map((court) => {
                    const courtBookings = sortBookingsStable(
                      dayBookings
                        .filter((b) => b.court?.id === court.id)
                        .filter((b) => `${b.startTime}|${b.endTime}` === assignSlotFilter),
                    );
                    return (
                      <div
                        key={court.id}
                        style={{
                          background: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          padding: "12px 14px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <strong style={{ fontSize: 15 }}>{court.name}</strong>
                          <span style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: courtBookings.length > 4 ? "#fef3c7" : courtBookings.length > 0 ? "#dcfce7" : "#f3f4f6",
                            color: courtBookings.length > 4 ? "#92400e" : courtBookings.length > 0 ? "#166534" : "#9ca3af",
                            fontWeight: 500,
                          }}>
                            {courtBookings.length} khách
                          </span>
                        </div>
                        {courtBookings.length === 0 ? (
                          <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
                            Chưa có khách
                          </p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {courtBookings.map((booking) => {
                              const c = getAvatarColor(booking.customerName);
                              return (
                                <div
                                  key={booking.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "5px 8px",
                                    borderRadius: 6,
                                    background: booking.gender === "FEMALE" ? "#fdf2f8" : "#f9fafb",
                                  }}
                                >
                                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                                    {getPlayerInitials(booking.customerName)}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {booking.customerName}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#6b7280" }}>
                                      {getSkillLevelLabel(booking.skillLevel)} · {booking.startTime}–{booking.endTime}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    title="Bỏ phân sân"
                                    onClick={() => void handleAssignCourtToBooking(booking.id, null)}
                                    style={{ width: 22, height: 22, padding: 0, border: "none", borderRadius: 4, background: "transparent", color: "#9ca3af", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                                  >
                                    ×
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {assignSlotFilter !== "all" && activeCourts.length === 0 ? (
                    <p className="empty-state">Chưa có sân nào. Vào tab "Quản lý sân" để thêm sân.</p>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        );
      })() : null}

      {isCourtFormOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={closeCourtForm}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-head">
              <div>
                <p className="panel-tag">{editingCourt ? "Sửa tên sân" : "Thêm sân"}</p>
                <h2>{editingCourt ? editingCourt.name : "Sân mới"}</h2>
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <label>
                Tên sân *
                <input
                  value={courtFormDraft.name}
                  onChange={(e) => setCourtFormDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Ví dụ: Sân 1, Sân A..."
                  autoFocus
                  required
                />
              </label>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" className="ghost-button" onClick={closeCourtForm}>
                  Hủy
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={isCourtSubmitting}
                  onClick={() => void handleCourtSubmit()}
                >
                  {isCourtSubmitting
                    ? "Đang lưu..."
                    : editingCourt
                      ? "Lưu tên mới"
                      : "Thêm sân"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isShopFormOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={closeShopForm}>
          <div
            className="modal-card shop-form-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="shop-form-head">
              <div>
                <p className="panel-tag">{editingShopItem ? "Sửa sản phẩm" : "Thêm sản phẩm"}</p>
                <h2>{editingShopItem ? editingShopItem.name : "Sản phẩm mới"}</h2>
              </div>
              <button
                type="button"
                className="shop-form-close"
                onClick={closeShopForm}
                aria-label="Đóng"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </header>

            <div className="shop-form-body">
              <div className="shop-form-section">
                <p className="shop-form-section-label">Hình ảnh</p>
                <label className="shop-image-uploader">
                  {shopFormDraft.imageUrl ? (
                    <img
                      src={getDisplayPhotoUrl(shopFormDraft.imageUrl)}
                      alt="Preview"
                      className="shop-image-preview"
                    />
                  ) : (
                    <div className="shop-image-placeholder">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                      <p>{isShopImageUploading ? "Đang tải lên..." : "Nhấn để chọn ảnh"}</p>
                      <small>JPG, PNG · khuyến nghị vuông 1:1</small>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleShopImageUpload(e.target.files?.[0] ?? null)}
                    style={{ display: "none" }}
                  />
                </label>
                {shopFormDraft.imageUrl ? (
                  <div className="shop-image-actions">
                    <label className="shop-image-replace-btn">
                      Đổi ảnh
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => void handleShopImageUpload(e.target.files?.[0] ?? null)}
                        style={{ display: "none" }}
                      />
                    </label>
                    <button
                      type="button"
                      className="shop-image-remove-btn"
                      onClick={() => setShopFormDraft((d) => ({ ...d, imageUrl: "", imagePublicId: "" }))}
                    >
                      Xóa ảnh
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="shop-form-section">
                <p className="shop-form-section-label">Thông tin sản phẩm</p>
                <div className="shop-form-fields">
                  <label className="shop-form-field">
                    <span>Tên sản phẩm <em>*</em></span>
                    <input
                      value={shopFormDraft.name}
                      onChange={(e) => setShopFormDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="Ví dụ: Vợt Hellokitty 2xx"
                      required
                    />
                  </label>

                  <label className="shop-form-field">
                    <span>Giá / Nhãn</span>
                    <input
                      value={shopFormDraft.priceLabel}
                      onChange={(e) => setShopFormDraft((d) => ({ ...d, priceLabel: e.target.value }))}
                      placeholder="Ví dụ: 290k, S80, 1.2tr..."
                    />
                  </label>

                  <label className="shop-form-field">
                    <span>Link affiliate</span>
                    <input
                      type="url"
                      value={shopFormDraft.link}
                      onChange={(e) => setShopFormDraft((d) => ({ ...d, link: e.target.value }))}
                      placeholder="https://..."
                    />
                  </label>
                </div>
              </div>

              <div className="shop-form-section">
                <p className="shop-form-section-label">Hiển thị</p>
                <div className="shop-form-display-row">
                  <label className="shop-form-field shop-form-field-compact">
                    <span>Thứ tự</span>
                    <input
                      type="number"
                      min={0}
                      value={shopFormDraft.displayOrder}
                      onChange={(e) => setShopFormDraft((d) => ({ ...d, displayOrder: Number(e.target.value) || 0 }))}
                    />
                  </label>

                  <label className="shop-form-toggle">
                    <input
                      type="checkbox"
                      checked={shopFormDraft.isActive}
                      onChange={(e) => setShopFormDraft((d) => ({ ...d, isActive: e.target.checked }))}
                    />
                    <span className="shop-form-toggle-track">
                      <span className="shop-form-toggle-thumb" />
                    </span>
                    <span className="shop-form-toggle-text">
                      <strong>Hiện trên web khách</strong>
                      <small>{shopFormDraft.isActive ? "Đang bật" : "Đang tắt — khách không nhìn thấy"}</small>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <footer className="shop-form-footer">
              <button type="button" className="ghost-button" onClick={closeShopForm}>
                Hủy
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={isShopSubmitting || isShopImageUploading}
                onClick={() => void handleShopSubmit()}
              >
                {isShopSubmitting
                  ? "Đang lưu..."
                  : editingShopItem
                    ? "Lưu thay đổi"
                    : "Thêm sản phẩm"}
              </button>
            </footer>
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
                transactionBookings.map((booking, index) => {
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
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="racket-row-stt" style={{ flexShrink: 0 }}>{index + 1}</div>
                          <div>
                            <h3 style={{ margin: 0 }}>{booking.customerName}</h3>
                            <p style={{ margin: "2px 0 0" }}>
                              {booking.bookingDate} · {booking.startTime} –{" "}
                              {booking.endTime}
                            </p>
                          </div>
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
                filteredRacketPlayerBookings.map((booking, index) =>
                  renderAssignedBookingCard(booking, index),
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



