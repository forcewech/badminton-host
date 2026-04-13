import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('quick_slots')
@Index(['bookingDate', 'startTime', 'endTime'], { unique: true })
export class QuickSlot {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  bookingDate!: string;

  @Column()
  startTime!: string;

  @Column()
  endTime!: string;
}
