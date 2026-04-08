import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';

@Entity('courts')
export class Court {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  name!: string;

  @Column()
  zone!: string;

  @Column()
  hourlyRate!: number;

  @Column({ default: true })
  isActive!: boolean;

  @OneToMany(() => Booking, (booking) => booking.court)
  bookings!: Booking[];
}
