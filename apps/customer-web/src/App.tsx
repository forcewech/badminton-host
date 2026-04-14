import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { api } from "./api";
import type {
  CustomerGender,
  PublicBookingPayload,
  PublicBookingResponse,
  PublicPaymentStatus,
  QuickSlot,
  SkillLevel,
} from "./types";

const genderOptions: Array<{ value: CustomerGender; label: string }> = [
  { value: "MALE", label: "Nam" },
  { value: "FEMALE", label: "Nữ" },
  { value: "OTHER", label: "Khác" },
];

const skillOptions: Array<{ value: SkillLevel; label: string }> = [
  { value: "BEGINNER", label: "Mới bắt đầu" },
  { value: "INTERMEDIATE", label: "Trung bình" },
  { value: "ADVANCED", label: "Nâng cao" },
];

function getLocalDateInputValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-US");
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

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

const initialForm: PublicBookingPayload = {
  customerName: "",
  customerPhone: "",
  gender: "OTHER",
  skillLevel: "BEGINNER",
  bookingDate: getLocalDateInputValue(),
  startTime: "19:00",
  endTime: "21:00",
  notes: "",
  photoUrl: "",
  photoPublicId: "",
};

export default function App() {
  const [form, setForm] = useState<PublicBookingPayload>(initialForm);
  const [quickSlots, setQuickSlots] = useState<QuickSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState(
    `${initialForm.startTime}-${initialForm.endTime}`,
  );
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [submission, setSubmission] = useState<PublicBookingResponse | null>(
    null,
  );
  const [paymentStatus, setPaymentStatus] =
    useState<PublicPaymentStatus | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(120);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isLoadingQuickSlots, setIsLoadingQuickSlots] = useState(false);
  const [fullscreenPhotoUrl, setFullscreenPhotoUrl] = useState<string | null>(
    null,
  );
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [hasHandledSuccessfulPayment, setHasHandledSuccessfulPayment] =
    useState(false);

  const paymentReference = submission?.booking.depositReference ?? null;
  const currentPayment = paymentStatus?.payment ?? submission?.payment ?? null;
  const isPaid =
    paymentStatus?.depositPaid ?? submission?.booking.depositPaid ?? false;
  const paymentExpiresAt =
    paymentStatus?.depositExpiresAt ?? currentPayment?.expiresAt ?? null;
  const isExpired =
    !isPaid &&
    Boolean(
      paymentStatus?.isExpired ||
        paymentStatus?.status === "CANCELLED" ||
        (paymentExpiresAt &&
          new Date(paymentExpiresAt).getTime() <= Date.now()),
    );

  useEffect(() => {
    if (
      !paymentReference ||
      paymentStatus?.depositPaid ||
      paymentStatus?.isExpired ||
      paymentStatus?.status === "CANCELLED"
    ) {
      return;
    }

    const syncPaymentStatus = async () => {
      try {
        const nextStatus = await api.getPaymentStatus(paymentReference);
        setPaymentStatus(nextStatus);

        if (nextStatus.depositPaid) {
          toast.success("Đã xác nhận tiền cọc. Hẹn bạn trên sân.");
        }
      } catch {
        // Continue polling silently.
      }
    };

    void syncPaymentStatus();

    const interval = window.setInterval(() => {
      void syncPaymentStatus();
    }, 1000);

    return () => window.clearInterval(interval);
  }, [
    paymentReference,
    paymentStatus?.depositPaid,
    paymentStatus?.isExpired,
    paymentStatus?.status,
  ]);

  useEffect(() => {
    if (submission) {
      return;
    }

    let cancelled = false;

    const loadQuickSlots = async () => {
      setIsLoadingQuickSlots(true);

      try {
        const nextQuickSlots = await api.getQuickSlots(form.bookingDate);
        if (cancelled) {
          return;
        }

        setQuickSlots(nextQuickSlots);

        if (nextQuickSlots.length === 0) {
          setSelectedSlot("");
          return;
        }

        const activeSlot = nextQuickSlots.find(
          (slot) =>
            slot.startTime === form.startTime && slot.endTime === form.endTime,
        );

        if (activeSlot) {
          setSelectedSlot(`${activeSlot.startTime}-${activeSlot.endTime}`);
          return;
        }

        const firstSlot = nextQuickSlots[0];
        setSelectedSlot(`${firstSlot.startTime}-${firstSlot.endTime}`);
        setForm((current) => ({
          ...current,
          startTime: firstSlot.startTime,
          endTime: firstSlot.endTime,
        }));
      } catch {
        if (!cancelled) {
          setQuickSlots([]);
          setSelectedSlot("");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingQuickSlots(false);
        }
      }
    };

    void loadQuickSlots();

    return () => {
      cancelled = true;
    };
  }, [form.bookingDate, submission]);

  useEffect(() => {
    const activeSlot = quickSlots.find(
      (slot) =>
        slot.startTime === form.startTime && slot.endTime === form.endTime,
    );

    setSelectedSlot(
      activeSlot ? `${activeSlot.startTime}-${activeSlot.endTime}` : "",
    );
  }, [form.startTime, form.endTime, quickSlots]);

  useEffect(() => {
    if (!isPaid || hasHandledSuccessfulPayment) {
      return;
    }

    setHasHandledSuccessfulPayment(true);
    setIsSuccessModalOpen(true);
    toast.success("Đã xác nhận tiền cọc. Hẹn bạn trên sân.");
  }, [hasHandledSuccessfulPayment, isPaid]);

  useEffect(() => {
    if (!paymentExpiresAt || isPaid) {
      setRemainingSeconds(120);
      return;
    }

    const syncRemainingTime = () => {
      const expiresAt = new Date(paymentExpiresAt).getTime();
      const seconds = Math.max(
        0,
        Math.ceil((expiresAt - Date.now()) / 1000),
      );
      setRemainingSeconds(seconds);
    };

    syncRemainingTime();
    const interval = window.setInterval(syncRemainingTime, 1000);
    return () => window.clearInterval(interval);
  }, [isPaid, paymentExpiresAt]);

  const bookingSummary = useMemo(() => {
    if (!submission) {
      return null;
    }

    return {
      customerName: submission.booking.customerName,
      bookingDate: paymentStatus?.bookingDate ?? submission.booking.bookingDate,
      startTime: paymentStatus?.startTime ?? submission.booking.startTime,
      endTime: paymentStatus?.endTime ?? submission.booking.endTime,
    };
  }, [paymentStatus, submission]);

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  function handleFormChange<K extends keyof PublicBookingPayload>(
    key: K,
    value: PublicBookingPayload[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedPhoto(file);

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoPreview(file ? URL.createObjectURL(file) : "");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      if (quickSlots.length === 0) {
        throw new Error(
          "Chưa có khung giờ chơi nào được thiết lập cho ngày hôm nay",
        );
      }

      let photoUrl = form.photoUrl;
      let photoPublicId = form.photoPublicId;

      if (selectedPhoto) {
        setIsUploadingPhoto(true);
        const uploadResult = await api.uploadBookingPhoto(selectedPhoto);
        photoUrl = uploadResult.url;
        photoPublicId = uploadResult.publicId;
      }

      const result = await api.createBooking({
        ...form,
        photoUrl,
        photoPublicId,
      });

      setSubmission(result);
      setPaymentStatus({
        reference: result.booking.depositReference ?? null,
        depositAmount: result.payment.amount,
        depositPaid: result.booking.depositPaid,
        depositExpiresAt: result.payment.expiresAt ?? null,
        isExpired: false,
        status: result.booking.status,
        customerName: result.booking.customerName,
        bookingDate: result.booking.bookingDate,
        startTime: result.booking.startTime,
        endTime: result.booking.endTime,
        payment: result.payment,
      });
      setHasHandledSuccessfulPayment(false);
      setIsSuccessModalOpen(false);

      toast.success("Đã ghi nhận thông tin. Vui lòng chuyển khoản tiền cọc.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể gửi thông tin.",
      );
    } finally {
      setIsSubmitting(false);
      setIsUploadingPhoto(false);
    }
  }

  function resetFlow() {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setForm(initialForm);
    setSelectedSlot(`${initialForm.startTime}-${initialForm.endTime}`);
    setSelectedPhoto(null);
    setPhotoPreview("");
    setSubmission(null);
    setPaymentStatus(null);
    setRemainingSeconds(120);
    setHasHandledSuccessfulPayment(false);
    setIsSuccessModalOpen(false);
  }

  return (
    <div className="customer-shell">
      <Toaster position="top-center" />

      <header className="customer-hero">
        <div className="hero-copy">
          <p className="hero-tag">Đặt sân cầu lông online</p>
        </div>
      </header>

      <main className="customer-layout">
        <section className="booking-panel">
          {!submission ? (
            <>
              <div className="panel-copy">
                <p className="panel-tag">Biểu mẫu khách hàng</p>
                <h2>Điền thông tin lịch chơi</h2>
              </div>

              <form className="customer-form" onSubmit={handleSubmit}>
                <div className="form-grid">
                  <label>
                    Tên khách hàng
                    <input
                      value={form.customerName}
                      onChange={(event) =>
                        handleFormChange("customerName", event.target.value)
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
                        handleFormChange("customerPhone", event.target.value)
                      }
                      placeholder="Có thể bỏ trống"
                    />
                  </label>

                  <label>
                    Giới tính
                    <select
                      value={form.gender}
                      onChange={(event) =>
                        handleFormChange(
                          "gender",
                          event.target.value as CustomerGender,
                        )
                      }
                    >
                      {genderOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Trình độ
                    <select
                      value={form.skillLevel}
                      onChange={(event) =>
                        handleFormChange(
                          "skillLevel",
                          event.target.value as SkillLevel,
                        )
                      }
                    >
                      {skillOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Ngày đặt
                    <input
                      type="date"
                      value={form.bookingDate}
                      onChange={(event) =>
                        handleFormChange("bookingDate", event.target.value)
                      }
                      required
                    />
                  </label>
                </div>

                <div className="quick-slot-card">
                  <div className="panel-copy compact">
                    <p className="panel-tag">Khung giờ chơi</p>
                    <h3>Chạm một lần để chọn nhanh</h3>
                  </div>

                  <div className="slot-grid">
                    {quickSlots.map((slot) => {
                      const slotKey = `${slot.startTime}-${slot.endTime}`;

                      return (
                        <button
                          key={slotKey}
                          type="button"
                          className={
                            selectedSlot === slotKey
                              ? "slot-button active"
                              : "slot-button"
                          }
                          onClick={() => {
                            setSelectedSlot(slotKey);
                            handleFormChange("startTime", slot.startTime);
                            handleFormChange("endTime", slot.endTime);
                          }}
                        >
                          {formatQuickSlotLabel(slot.startTime, slot.endTime)}
                        </button>
                      );
                    })}
                  </div>

                  {isLoadingQuickSlots ? (
                    <p className="slot-empty-state">
                      Đang tải khung giờ chơi cho ngày đã chọn...
                    </p>
                  ) : null}
                  {!isLoadingQuickSlots && quickSlots.length === 0 ? (
                    <p className="slot-empty-state">
                      Chưa có khung giờ chơi nào được thiết lập cho ngày hôm nay
                    </p>
                  ) : null}
                </div>

                <label>
                  Ghi chú thêm
                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      handleFormChange("notes", event.target.value)
                    }
                    placeholder="Ví dụ: đi nhóm 4 người, muốn khung giờ ổn định..."
                    rows={4}
                  />
                </label>

                <div className="photo-card">
                  <div className="photo-card-copy">
                    <p className="panel-tag">Ảnh khách hàng</p>
                    <h3>Tùy chọn tải ảnh</h3>
                    <p>
                      Không bắt buộc. Nếu có ảnh, hệ thống sẽ lưu cùng hồ sơ đặt
                      sân của bạn.
                    </p>
                  </div>

                  <div className="photo-card-side">
                    {photoPreview ? (
                      <button
                        type="button"
                        className="photo-preview-button"
                        onClick={() => setFullscreenPhotoUrl(photoPreview)}
                      >
                        <img src={photoPreview} alt="Xem trước ảnh khách" />
                      </button>
                    ) : (
                      <div className="photo-placeholder">Chưa có ảnh</div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="submit-button"
                  disabled={isSubmitting || quickSlots.length === 0}
                >
                  {isSubmitting
                    ? isUploadingPhoto
                      ? "Đang tải ảnh..."
                      : "Đang gửi thông tin..."
                    : "Tiếp tục đến bước chuyển khoản cọc"}
                </button>
              </form>
            </>
          ) : (
            <div className="payment-screen">
              <div className="panel-copy">
                <p className="panel-tag">Bước chuyển khoản</p>
                <h2>Quét QR hoặc chuyển khoản thủ công</h2>
                <p>
                  Màn hình sẽ tự cập nhật ngay khi webhook ngân hàng báo đã nhận
                  tiền cọc.
                </p>
              </div>

              <div className="payment-layout">
                <section className="payment-card">
                  <span
                    className={
                      isPaid ? "payment-pill success" : "payment-pill pending"
                    }
                  >
                    {isPaid
                      ? "Đã nhận tiền cọc"
                      : isExpired
                        ? "Mã QR đã hết hạn"
                        : "Đang chờ xác nhận tiền cọc"}
                  </span>

                  {!isPaid && !isExpired ? (
                    <>
                      <div className="payment-loading-row">
                        <span className="payment-spinner" aria-hidden="true" />
                        <small>Hệ thống đang chờ xác nhận giao dịch cọc.</small>
                      </div>
                      <div className="payment-countdown-row">
                        <small>
                          Mã QR sẽ tự hết hạn sau{" "}
                          {formatCountdown(remainingSeconds)}
                        </small>
                      </div>
                    </>
                  ) : null}

                  {!isPaid && isExpired ? (
                    <div className="payment-loading-row payment-loading-row-expired">
                      <small>
                        Mã QR đã hết hạn sau 2 phút. Vui lòng tạo lượt đăng ký
                        mới.
                      </small>
                    </div>
                  ) : null}

                  {currentPayment?.qrImageUrl ? (
                    <button
                      type="button"
                      className={
                        isExpired ? "qr-button qr-button-expired" : "qr-button"
                      }
                      onClick={() =>
                        !isExpired
                          ? setFullscreenPhotoUrl(currentPayment.qrImageUrl)
                          : undefined
                      }
                      disabled={isExpired}
                    >
                      {isExpired ? (
                        <span className="qr-expired-overlay">Hết hạn</span>
                      ) : null}
                      <img src={currentPayment.qrImageUrl} alt="Mã QR ngân hàng" />
                    </button>
                  ) : (
                    <div className="qr-fallback">
                      QR ngân hàng chưa được cấu hình. Vui lòng dùng thông tin
                      tài khoản ở phần bên phải.
                    </div>
                  )}

                  <div className="payment-highlight">
                    <strong>
                      {formatCurrency(currentPayment?.amount ?? 0)} VND
                    </strong>
                    <span>Tiền cọc cần chuyển</span>
                  </div>
                </section>

                <section className="payment-info">
                  <div className="summary-card">
                    <h3>Thông tin đặt sân</h3>
                    <p>{bookingSummary?.customerName}</p>
                    <small>
                      {bookingSummary?.bookingDate} · {bookingSummary?.startTime}{" "}
                      đến {bookingSummary?.endTime}
                    </small>
                  </div>

                  <div className="info-grid">
                    <article>
                      <span>Ngân hàng</span>
                      <strong>{currentPayment?.bankName ?? "Ngân hàng"}</strong>
                    </article>
                    <article>
                      <span>Số tài khoản</span>
                      <strong>
                        {currentPayment?.accountNumber || "Chưa cấu hình"}
                      </strong>
                    </article>
                    <article>
                      <span>Chủ tài khoản</span>
                      <strong>
                        {currentPayment?.accountName || "Chưa cấu hình"}
                      </strong>
                    </article>
                    <article>
                      <span>Nội dung chuyển khoản</span>
                      <strong>
                        {currentPayment?.transferContent ?? "Đang tạo"}
                      </strong>
                    </article>
                  </div>

                  <div className="payment-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={isExpired}
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          currentPayment?.transferContent ?? "",
                        );
                        toast.success("Đã sao chép nội dung chuyển khoản.");
                      }}
                    >
                      Sao chép nội dung chuyển khoản
                    </button>

                    <button
                      type="button"
                      className="ghost-button"
                      onClick={resetFlow}
                    >
                      Tạo lượt đăng ký mới
                    </button>
                  </div>
                </section>
              </div>
            </div>
          )}
        </section>
      </main>

      {fullscreenPhotoUrl ? (
        <div className="lightbox" onClick={() => setFullscreenPhotoUrl(null)}>
          <div
            className="lightbox-card"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setFullscreenPhotoUrl(null)}
            >
              Đóng
            </button>
            <img
              src={getDisplayPhotoUrl(fullscreenPhotoUrl)}
              alt="Xem ảnh toàn màn hình"
            />
          </div>
        </div>
      ) : null}

      {isSuccessModalOpen ? (
        <div
          className="success-modal-backdrop"
          onClick={() => setIsSuccessModalOpen(false)}
        >
          <div
            className="success-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="success-modal-icon" aria-hidden="true">
              ✓
            </div>
            <p className="panel-tag">Đặt cọc thành công</p>
            <h2>Chúc mừng, hệ thống đã nhận tiền cọc của bạn.</h2>
            <p>
              {bookingSummary?.customerName} đã được ghi nhận lịch chơi vào{" "}
              {bookingSummary?.bookingDate} từ {bookingSummary?.startTime} đến{" "}
              {bookingSummary?.endTime}.
            </p>
            <button
              type="button"
              className="submit-button"
              onClick={() => setIsSuccessModalOpen(false)}
            >
              Đã hiểu
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
