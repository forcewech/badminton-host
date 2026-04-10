import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { api } from "./api";
import type {
  CustomerGender,
  PublicBookingPayload,
  PublicBookingResponse,
  PublicPaymentStatus,
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

const quickSlots = [
  { label: "7:00 PM - 9:00 PM", startTime: "19:00", endTime: "21:00" },
  { label: "8:00 PM - 10:00 PM", startTime: "20:00", endTime: "22:00" },
  { label: "9:00 PM - 11:00 PM", startTime: "21:00", endTime: "23:00" },
];

function getLocalDateInputValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-US");
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [fullscreenPhotoUrl, setFullscreenPhotoUrl] = useState<string | null>(
    null,
  );
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [hasHandledSuccessfulPayment, setHasHandledSuccessfulPayment] =
    useState(false);

  const paymentReference = submission?.booking.depositReference ?? null;

  useEffect(() => {
    if (!paymentReference || paymentStatus?.depositPaid) {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const nextStatus = await api.getPaymentStatus(paymentReference);
        setPaymentStatus(nextStatus);

        if (nextStatus.depositPaid) {
          toast.success("Đã xác nhận tiền cọc. Hẹn bạn trên sân.");
        }
      } catch {
        // Continue polling silently.
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [paymentReference, paymentStatus?.depositPaid]);

  const currentPayment = paymentStatus?.payment ?? submission?.payment ?? null;
  const isPaid =
    paymentStatus?.depositPaid ?? submission?.booking.depositPaid ?? false;

  useEffect(() => {
    if (!isPaid || hasHandledSuccessfulPayment) {
      return;
    }

    setHasHandledSuccessfulPayment(true);
    setIsSuccessModalOpen(true);
    toast.success("Đã xác nhận tiền cọc. Hẹn bạn trên sân.");
  }, [hasHandledSuccessfulPayment, isPaid]);

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
                    <p className="panel-tag">Khung giờ nhanh</p>
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
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="form-grid">
                    <label>
                      Giờ bắt đầu
                      <input
                        type="time"
                        value={form.startTime}
                        onChange={(event) => {
                          setSelectedSlot("");
                          handleFormChange("startTime", event.target.value);
                        }}
                        required
                      />
                    </label>

                    <label>
                      Giờ kết thúc
                      <input
                        type="time"
                        value={form.endTime}
                        onChange={(event) => {
                          setSelectedSlot("");
                          handleFormChange("endTime", event.target.value);
                        }}
                        required
                      />
                    </label>
                  </div>
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
                  disabled={isSubmitting}
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
                    {isPaid ? "Đã nhận tiền cọc" : "Đang chờ xác nhận tiền cọc"}
                  </span>
                  {!isPaid ? (
                    <div className="payment-loading-row">
                      <span className="payment-spinner" aria-hidden="true" />
                      <small>
                        Vui lòng chờ khoảng 30s để hệ thống xác nhận giao
                        dịch...
                      </small>
                    </div>
                  ) : null}
                  {currentPayment?.qrImageUrl ? (
                    <button
                      type="button"
                      className="qr-button"
                      onClick={() =>
                        setFullscreenPhotoUrl(currentPayment.qrImageUrl)
                      }
                    >
                      <img
                        src={currentPayment.qrImageUrl}
                        alt="Mã QR ngân hàng"
                      />
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
                      {bookingSummary?.bookingDate} ·{" "}
                      {bookingSummary?.startTime} đến {bookingSummary?.endTime}
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
            <p className="panel-tag">Đặc cược thành công</p>
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
