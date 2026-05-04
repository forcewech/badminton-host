import { IsIn, IsString, IsNotEmpty } from 'class-validator';
import type { PlayerSkillLevel } from '../entities/play-session-player.entity';

export class AddPlayerDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(['Y', 'TB_MINUS', 'TB', 'TB_PLUS', 'KHA', 'TUYEN'])
  skillLevel!: PlayerSkillLevel;
}
