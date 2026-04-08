import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Court } from '../../courts/entities/court.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';

export enum CustomerGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum SkillLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  customerName!: string;

  @Column({ default: '' })
  customerPhone!: string;

  @Column({
    type: 'enum',
    enum: CustomerGender,
    default: CustomerGender.OTHER,
  })
  gender!: CustomerGender;

  @Column({
    type: 'enum',
    enum: SkillLevel,
    default: SkillLevel.BEGINNER,
  })
  skillLevel!: SkillLevel;

  @Column()
  bookingDate!: string;

  @Column()
  startTime!: string;

  @Column()
  endTime!: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  depositAmount!: number;

  @Column({ default: false })
  depositPaid!: boolean;

  @Column({ default: false })
  fullPaymentTransferred!: boolean;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status!: BookingStatus;

  @Column({ default: '' })
  notes!: string;

  @Column({
    type: 'jsonb',
    default: () => "'[false,false,false,false,false,false,false]'",
  })
  matchTracking!: boolean[];

  @Column({ nullable: true })
  checkInAt?: string;

  @Column({ nullable: true })
  paymentTransferredAt?: string;

  @ManyToOne(() => Court, (court) => court.bookings, {
    eager: true,
    onDelete: 'RESTRICT',
    nullable: true,
  })
  court!: Court | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
