import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PlaySession } from './play-session.entity';

export type MatchStatus = 'PLAYING' | 'ENDED';

@Entity()
export class PlaySessionMatch {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => PlaySession, (s) => s.matches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session!: PlaySession;

  @Column()
  sessionId!: number;

  @Column()
  courtNumber!: number;

  @Column()
  teamAPlayer1Id!: number;

  @Column()
  teamAPlayer2Id!: number;

  @Column()
  teamBPlayer1Id!: number;

  @Column()
  teamBPlayer2Id!: number;

  @Column({ default: 0 })
  scoreA!: number;

  @Column({ default: 0 })
  scoreB!: number;

  @Column({ default: 'PLAYING' })
  status!: MatchStatus;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ nullable: true, type: 'timestamptz' })
  endedAt!: Date | null;
}
