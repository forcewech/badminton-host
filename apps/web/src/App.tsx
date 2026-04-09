import { FormEvent, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "./api";
import type {
  Booking,
  Court,
  CourtPayload,
  CreateBookingPayload,
  CustomerGender,
  DashboardOverview,
  SkillLevel,
} from "./types";

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

const initialForm: CreateBookingPayload = {
  customerName: "",
  customerPhone: "",
  gender: "OTHER",
  skillLevel: "BEGINNER",
  bookingDate: today,
  startTime: "18:00",
  endTime: "19:00",
  depositAmount: 30000,
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
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [form, setForm] = useState<CreateBookingPayload>(initialForm);
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
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [fullscreenPhotoUrl, setFullscreenPhotoUrl] = useState<string | null>(
    null,
  );
  const [editingCourtId, setEditingCourtId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCourtSubmitting, setIsCourtSubmitting] = useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);

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

  async function loadData() {
    try {
      const [overviewData, courtsData, bookingsData] = await Promise.all([
        api.getOverview(),
        api.getCourts(),
        api.getBookings(),
      ]);

      setOverview(overviewData);
      setCourts(courtsData);
      setBookings(bookingsData);

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
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải dữ liệu",
      );
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

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

  async function handleAssignCourt(id: number) {
    if (!selectedCourtId) {
      setError("Vui lòng tạo sân trước khi phân khách.");
      return;
    }

    try {
      await api.assignCourt(id, selectedCourtId);
      await loadData();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Phân sân thất bại",
      );
    }
  }

  async function handleDeposit(id: number) {
    try {
      await api.confirmDeposit(id);
      await loadData();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Cập nhật tiền cọc thất bại",
      );
    }
  }

  async function handleCheckIn(id: number) {
    try {
      await api.checkIn(id);
      await loadData();
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
      } else {
        await api.createCourt(courtForm);
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
      <article key={booking.id} className={className}>
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

        <div className="booking-actions">
          <button
            type="button"
            className="ghost-button view-button"
            onClick={() => setDetailBooking(booking)}
          >
            <span className="view-icon" aria-hidden="true">
              👁
            </span>
            Xem khách
          </button>
          <button
            type="button"
            className="ghost-button"
            disabled={booking.depositPaid || booking.status === "NO_SHOW"}
            onClick={() => handleDeposit(booking.id)}
          >
            Xác nhận cọc
          </button>
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

        <div className="match-tracking">
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
        </div>
      </header>

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

      <main className="layout">
        <section className="panel panel-form">
          <div className="panel-head">
            <div>
              <p className="panel-tag">Tiếp nhận khách</p>
              <h2>Nhập danh sách khách đã cọc</h2>
            </div>
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
                  <p className="panel-tag">Khung giờ nhanh</p>
                  <h3>Chọn nhanh thời gian chơi</h3>
                </div>
              </div>
              <div className="time-slot-grid">
                {quickTimeSlots.map((slot) => {
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
                      <span className="time-slot-label">{slot.label}</span>
                      <small className="time-slot-meta">{slot.note}</small>
                    </button>
                  );
                })}
              </div>
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
                    src={form.photoUrl}
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

          <div className="court-tabs" role="tablist" aria-label="Danh sách sân">
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
            <div className="panel-subhead">
              <p className="panel-tag">Danh sách chờ</p>
              <h3>Khách hàng đang chờ phân sân</h3>
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
                    className="booking-card compact-card"
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
                        Đã cọc ({formatCurrencyDisplay(booking.depositAmount)})
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
                    <div className="booking-actions">
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
      </main>

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
                    Trạng thái: {court.isActive ? "Đang hoạt động" : "Tạm dừng"}
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
          className="modal-backdrop"
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
                      src={detailBooking.photoUrl}
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
              src={fullscreenPhotoUrl}
              alt="Ảnh khách toàn màn hình"
              className="photo-lightbox-image"
            />
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
                <p className="panel-tag">Theo dõi sân</p>
                <h2 id="history-modal-title">
                  {selectedCourt
                    ? `${selectedCourt.name} - theo dõi trận & danh sách khách`
                    : "Theo dõi trận"}
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

            <div className="fullscreen-summary">
              <div className="selected-court-card">
                <span className="selected-court-label">Ngày theo dõi</span>
                <strong>{historyDate}</strong>
                <small>{historyBookings.length} khách đã phân sân</small>
              </div>
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
