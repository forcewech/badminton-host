import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('shop_items')
export class ShopItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  imageUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  imagePublicId?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  priceLabel?: string | null;

  @Column({ type: 'text', nullable: true })
  link?: string | null;

  @Column({ type: 'int', default: 0 })
  displayOrder!: number;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
