import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('equipment_items')
export class EquipmentItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'int' })
  quantityAvailable!: number;

  @Column({ type: 'int', default: 0 })
  quantityInUse!: number;

  @Column({ default: true })
  isChecked!: boolean;

  @Column({ default: '' })
  conditionNotes!: string;
}
