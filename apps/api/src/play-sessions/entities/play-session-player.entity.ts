import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PlaySession } from './play-session.entity';

export type PlayerSkillLevel = 'TB' | 'TB_PLUS' | 'KHA' | 'GIOI';

@Entity()
export class PlaySessionPlayer {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => PlaySession, (s) => s.players, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session!: PlaySession;

  @Column()
  sessionId!: number;

  @Column()
  name!: string;

  @Column({ type: 'int', nullable: true })
  bookingId!: number | null;

  @Column({ default: 'TB' })
  skillLevel!: PlayerSkillLevel;

  @Column({ default: false })
  isCheckedIn!: boolean;

  @Column({ nullable: true, type: 'timestamptz' })
  checkedInAt!: Date | null;

  @Column({ default: 0 })
  matchesPlayed!: number;

  @Column({ default: 0 })
  consecutiveMatches!: number;

  @Column({ nullable: true, type: 'timestamptz' })
  lastMatchEndedAt!: Date | null;

  @Column({ default: false })
  isCurrentlyPlaying!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
