import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { Booking } from '../bookings/entities/booking.entity';
import { Court } from '../courts/entities/court.entity';
import { EquipmentItem } from '../equipment/entities/equipment-item.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(Court)
    private readonly courtsRepository: Repository<Court>,
    @InjectRepository(EquipmentItem)
    private readonly equipmentRepository: Repository<EquipmentItem>,
  ) {}

  async getOverview() {
    const timezone = process.env.APP_TIMEZONE ?? 'Asia/Bangkok';
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
    }).format(new Date());
    const [bookings, courts, equipment] = await Promise.all([
      this.bookingsRepository.find(),
      this.courtsRepository.find(),
      this.equipmentRepository.find(),
    ]);

    const todaysBookings = bookings.filter((booking) => booking.bookingDate === today);
    const checkedInCount = todaysBookings.filter(
      (booking) => booking.status === BookingStatus.CHECKED_IN,
    ).length;
    const pendingDeposits = todaysBookings.filter(
      (booking) => booking.depositAmount > 0 && !booking.depositPaid,
    ).length;
    const pendingTransfers = todaysBookings.filter(
      (booking) => booking.status === BookingStatus.CHECKED_IN && !booking.fullPaymentTransferred,
    ).length;
    const equipmentIssues = equipment.filter((item) => !item.isChecked).length;

    return {
      date: today,
      totals: {
        courts: courts.length,
        todaysBookings: todaysBookings.length,
        checkedInCount,
        pendingDeposits,
        pendingTransfers,
        equipmentIssues,
      },
    };
  }
}
