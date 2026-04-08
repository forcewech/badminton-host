import { FormEvent, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from './api';
import type {
  Booking,
  Court,
  CourtPayload,
  CreateBookingPayload,
  CustomerGender,
  DashboardOverview,
  SkillLevel,
} from './types';

const today = new Date().toISOString().slice(0, 10);

const genderOptions: CustomerGender[] = ['MALE', 'FEMALE', 'OTHER'];
const skillLevelOptions: SkillLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

const initialForm: CreateBookingPayload = {
  customerName: '',
  customerPhone: '',
  gender: 'OTHER',
  skillLevel: 'BEGINNER',
  bookingDate: today,
  startTime: '18:00',
  endTime: '19:00',
  depositAmount: 200,
  notes: '',
};

const initialCourtForm: CourtPayload = {
  name: '',
  zone: '',
  hourlyRate: 0,
  isActive: true,
};

function getSkillLevelLabel(skillLevel: SkillLevel) {
  switch (skillLevel) {
    case 'BEGINNER':
      return 'Mới bắt đầu';
    case 'INTERMEDIATE':
      return 'Trung bình';
    case 'ADVANCED':
      return 'Nâng cao';
    default:
      return skillLevel;
  }
}

function getGenderLabel(gender: CustomerGender) {
  switch (gender) {
    case 'MALE':
      return 'Nam';
    case 'FEMALE':
      return 'Nữ';
    case 'OTHER':
      return 'Khác';
    default:
      return gender;
  }
}

function getMatchTracking(matchTracking?: boolean[]) {
  return Array.from({ length: 7 }, (_, index) => matchTracking?.[index] ?? false);
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
  const [historyDate, setHistoryDate] = useState<string>(today);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [transferFilter, setTransferFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [participationFilter, setParticipationFilter] = useState<
    'all' | 'checked_in' | 'no_show'
  >('all');
  const [courtForm, setCourtForm] = useState<CourtPayload>(initialCourtForm);
  const [isCourtModalOpen, setIsCourtModalOpen] = useState(false);
  const [editingCourtId, setEditingCourtId] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCourtSubmitting, setIsCourtSubmitting] = useState(false);

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
        const fallbackCourtId = courtsData.some((court) => court.id === selectedCourtId)
          ? selectedCourtId
          : courtsData[0].id;
        setSelectedCourtId(fallbackCourtId);
      } else {
        setSelectedCourtId(0);
      }

      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải dữ liệu');
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleBookingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await api.createBooking(form);
      setForm(initialForm);
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể tạo lượt đặt');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignCourt(id: number) {
    if (!selectedCourtId) {
      setError('Vui lòng tạo sân trước khi phân khách.');
      return;
    }

    try {
      await api.assignCourt(id, selectedCourtId);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Phân sân thất bại');
    }
  }

  async function handleDeposit(id: number) {
    try {
      await api.confirmDeposit(id);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Cập nhật tiền cọc thất bại');
    }
  }

  async function handleCheckIn(id: number) {
    try {
      await api.checkIn(id);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Check-in thất bại');
    }
  }

  async function handleFullPayment(id: number) {
    try {
      await api.confirmFullPayment(id);
      await loadData();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Cập nhật thanh toán đủ thất bại',
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
          : 'Cập nhật trạng thái không đến thất bại',
      );
    }
  }

  async function handleDeleteBooking(id: number) {
    try {
      await api.deleteBooking(id);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Xóa lượt đặt thất bại');
    }
  }

  async function handleMatchTracking(id: number, slot: number, checked: boolean) {
    try {
      await api.updateMatchTracking(id, slot, checked);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Cập nhật lượt chơi thất bại');
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
      setError(submitError instanceof Error ? submitError.message : 'Cập nhật sân thất bại');
    } finally {
      setIsCourtSubmitting(false);
    }
  }

  async function handleDeleteCourt(id: number) {
    try {
      await api.deleteCourt(id);
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Xóa sân thất bại');
    }
  }

  const selectedCourt = courts.find((court) => court.id === selectedCourtId) ?? courts[0];
  const unassignedBookings = sortBookingsStable(
    bookings
    .filter((booking) => booking.bookingDate === historyDate)
    .filter((booking) => booking.court === null)
    .filter((booking) =>
      booking.customerName.toLowerCase().includes(searchTerm.trim().toLowerCase()),
    ),
  );

  const courtBookings = sortBookingsStable(
    bookings.filter((booking) => booking.court?.id === selectedCourt?.id),
  );
  const historyBookings = sortBookingsStable(
    courtBookings
    .filter((booking) => booking.bookingDate === historyDate)
    .filter((booking) =>
      booking.customerName.toLowerCase().includes(searchTerm.trim().toLowerCase()),
    )
    .filter((booking) => {
      if (transferFilter === 'paid') {
        return booking.fullPaymentTransferred;
      }

      if (transferFilter === 'unpaid') {
        return !booking.fullPaymentTransferred;
      }

      return true;
    })
    .filter((booking) => {
      if (participationFilter === 'checked_in') {
        return booking.status === 'CHECKED_IN' || booking.status === 'COMPLETED';
      }

      if (participationFilter === 'no_show') {
        return booking.status === 'NO_SHOW';
      }

      return true;
    }),
  );

  function exportHistoryToExcel() {
    const rows = historyBookings.map((booking) => ({
      Court: booking.court?.name ?? 'Chưa phân sân',
      Date: booking.bookingDate,
      Start: booking.startTime,
      End: booking.endTime,
      CustomerName: booking.customerName,
      Gender: getGenderLabel(booking.gender),
      SkillLevel: getSkillLevelLabel(booking.skillLevel),
      Phone: booking.customerPhone,
      DepositAmount: booking.depositAmount,
      DepositPaid: booking.depositPaid ? 'Có' : 'Không',
      FullTransfer: booking.fullPaymentTransferred ? 'Có' : 'Không',
      PlaysCompleted: getMatchTracking(booking.matchTracking).filter(Boolean).length,
      Status: booking.status,
      Notes: booking.notes,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'QuảnLýSân');
    XLSX.writeFile(
      workbook,
      `${selectedCourt?.name ?? 'sân'}-${historyDate}-quản-lý.xlsx`,
    );
  }

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Quản Lý Sân Cầu Lông</p>
          <h1>Tiếp nhận khách, sắp xếp sân và vận hành trong một giao diện duy nhất.</h1>
          <p className="intro">
            Nhập danh sách khách đã đặt và đã cọc trước, sau đó phân sân cho từng khách
            khi bạn sẵn sàng.
          </p>
        </div>
        <div className="hero-note">
          <span>Thông tin nhanh</span>
          <strong>{overview?.totals.todaysBookings ?? 0} lượt đặt hôm nay</strong>
          <p>
            {unassignedBookings.length} khách đang chờ phân sân và{' '}
            {overview?.totals.pendingTransfers ?? 0} giao dịch còn chờ xác nhận.
          </p>
        </div>
      </header>

      {error ? <div className="alert">{error}</div> : null}

      <section className="stats-grid">
        <StatCard label="Sân đang hoạt động" value={overview?.totals.courts ?? 0} />
        <StatCard label="Lượt đặt hôm nay" value={overview?.totals.todaysBookings ?? 0} />
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
                  required
                />
              </label>
            </div>

            <div className="grid-two">
              <label>
                Giới tính
                <select
                  value={form.gender}
                  onChange={(event) =>
                    setForm({ ...form, gender: event.target.value as CustomerGender })
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
                    setForm({ ...form, skillLevel: event.target.value as SkillLevel })
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
                <input
                  type="number"
                  min="0"
                  value={form.depositAmount}
                  onChange={(event) =>
                    setForm({ ...form, depositAmount: Number(event.target.value) })
                  }
                  required
                />
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

            <label>
              Ghi chú
              <input
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Thuê vợt, đến muộn, nhóm mới"
              />
            </label>

            <div className="selected-court-card">
              <span className="selected-court-label">Quy trình</span>
              <strong>Tiền cọc được ghi nhận đã thanh toán khi thêm khách</strong>
              <small>Phân sân sau trong mục Quản lý sân.</small>
            </div>

            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : 'Thêm khách đặt sân'}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="panel-tag">Quản lý sân</p>
              <h2>{selectedCourt ? `${selectedCourt.name} - phân sân` : 'Quản lý sân'}</h2>
            </div>
          </div>

          <div className="court-tabs" role="tablist" aria-label="Danh sách sân">
            {courts.map((court) => (
              <button
                key={court.id}
                type="button"
                className={court.id === selectedCourtId ? 'court-tab active' : 'court-tab'}
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
                  setTransferFilter(event.target.value as 'all' | 'paid' | 'unpaid')
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
                    event.target.value as 'all' | 'checked_in' | 'no_show',
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
                <p className="empty-state">Không có khách nào chờ phân sân trong ngày này.</p>
              ) : (
                unassignedBookings.map((booking) => (
                  <article key={booking.id} className="booking-card compact-card">
                    <div className="booking-card-top">
                      <div>
                        <h3>{booking.customerName}</h3>
                        <p>
                          {getGenderLabel(booking.gender)} - {getSkillLevelLabel(booking.skillLevel)}
                        </p>
                      </div>
                      <span className={`status status-${booking.status.toLowerCase()}`}>
                        {booking.status}
                      </span>
                    </div>
                    <div className="booking-meta">
                      <span>{booking.customerPhone}</span>
                      <span>Đã cọc ({booking.depositAmount})</span>
                      <span>
                        {booking.startTime} - {booking.endTime}
                      </span>
                    </div>
                    <div className="booking-actions">
                      <button
                        type="button"
                        className="primary-button"
                        disabled={!selectedCourtId}
                        onClick={() => handleAssignCourt(booking.id)}
                      >
                        Phân vào {selectedCourt?.name ?? 'sân'}
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
            <h3>
              {selectedCourt ? `${selectedCourt.name} - danh sách khách` : 'Khách đã phân sân'}
            </h3>
          </div>

          <div className="schedule-list">
            {historyBookings.length === 0 ? (
              <p className="empty-state">Không có khách nào được phân vào sân này trong ngày này.</p>
            ) : (
              historyBookings.map((booking) => (
                <article key={booking.id} className="booking-card">
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
                    <span>{booking.customerPhone}</span>
                    <span>{getGenderLabel(booking.gender)}</span>
                    <span>{getSkillLevelLabel(booking.skillLevel)}</span>
                    <span>
                      Cọc {booking.depositPaid ? 'đã thanh toán' : 'đang chờ'} ({booking.depositAmount})
                    </span>
                    <span>
                      Thanh toán đủ {booking.fullPaymentTransferred ? 'đã xác nhận' : 'đang chờ'}
                    </span>
                  </div>

                  <div className="booking-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={booking.depositPaid || booking.status === 'NO_SHOW'}
                      onClick={() => handleDeposit(booking.id)}
                    >
                      Xác nhận cọc
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={
                        booking.status === 'CHECKED_IN' ||
                        booking.status === 'COMPLETED' ||
                        booking.status === 'NO_SHOW'
                      }
                      onClick={() => handleCheckIn(booking.id)}
                    >
                      Check-in
                    </button>
                    <button
                      type="button"
                      className="success-button"
                      disabled={
                        booking.status !== 'CHECKED_IN' || booking.fullPaymentTransferred
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
                        booking.status === 'CHECKED_IN' ||
                        booking.status === 'COMPLETED' ||
                        booking.status === 'NO_SHOW'
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
                      <strong>{getMatchTracking(booking.matchTracking).filter(Boolean).length}/7 lượt</strong>
                    </div>
                    <div className="match-tracking-grid">
                      {getMatchTracking(booking.matchTracking).map((checked, index) => (
                        <label
                          key={index}
                          className={checked ? 'match-box checked' : 'match-box'}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              void handleMatchTracking(booking.id, index, event.target.checked)
                            }
                          />
                          <span>Lượt {index + 1}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </article>
              ))
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
            <button type="button" className="primary-button" onClick={openCreateCourtModal}>
              Thêm sân
            </button>
          </div>

          <div className="court-grid">
            {courts.map((court) => (
              <article key={court.id} className="court-card">
                <h3>{court.name}</h3>
                <p>{court.zone}</p>
                <ul>
                  <li>Giá: {court.hourlyRate} THB/giờ</li>
                  <li>Trạng thái: {court.isActive ? 'Đang hoạt động' : 'Tạm dừng'}</li>
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
        <div className="modal-backdrop" role="presentation" onClick={closeCourtModal}>
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
                <h2 id="court-modal-title">{editingCourtId ? 'Sửa sân' : 'Thêm sân'}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={closeCourtModal}>
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
                  <input
                    type="number"
                    min="0"
                    value={courtForm.hourlyRate}
                    onChange={(event) =>
                      setCourtForm({
                        ...courtForm,
                        hourlyRate: Number(event.target.value),
                      })
                    }
                    required
                  />
                </label>
              </div>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={courtForm.isActive}
                  onChange={(event) =>
                    setCourtForm({ ...courtForm, isActive: event.target.checked })
                  }
                />
                <span>Sân đang hoạt động</span>
              </label>

              <button className="primary-button" type="submit" disabled={isCourtSubmitting}>
                {isCourtSubmitting
                  ? 'Đang lưu...'
                  : editingCourtId
                    ? 'Lưu thay đổi'
                    : 'Tạo sân'}
              </button>
            </form>
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
