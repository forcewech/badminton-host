import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CloudinaryService } from '../bookings/cloudinary.service';
import { CreateShopItemDto } from './dto/create-shop-item.dto';
import { UpdateShopItemDto } from './dto/update-shop-item.dto';
import { ShopItem } from './entities/shop-item.entity';

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(ShopItem)
    private readonly shopRepository: Repository<ShopItem>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  findAllPublic() {
    return this.shopRepository.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
  }

  findAllAdmin() {
    return this.shopRepository.find({
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
  }

  async create(dto: CreateShopItemDto) {
    const item = this.shopRepository.create({
      name: dto.name,
      imageUrl: dto.imageUrl ?? null,
      imagePublicId: dto.imagePublicId ?? null,
      priceLabel: dto.priceLabel ?? null,
      link: dto.link ?? null,
      displayOrder: dto.displayOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    return this.shopRepository.save(item);
  }

  async update(id: number, dto: UpdateShopItemDto) {
    const item = await this.shopRepository.findOneBy({ id });
    if (!item) throw new NotFoundException(`Shop item ${id} not found.`);

    if (dto.imagePublicId && item.imagePublicId && item.imagePublicId !== dto.imagePublicId) {
      await this.cloudinaryService.deleteImage(item.imagePublicId);
    }

    if (dto.name !== undefined) item.name = dto.name;
    if (dto.imageUrl !== undefined) item.imageUrl = dto.imageUrl || null;
    if (dto.imagePublicId !== undefined) item.imagePublicId = dto.imagePublicId || null;
    if (dto.priceLabel !== undefined) item.priceLabel = dto.priceLabel || null;
    if (dto.link !== undefined) item.link = dto.link || null;
    if (dto.displayOrder !== undefined) item.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) item.isActive = dto.isActive;

    return this.shopRepository.save(item);
  }

  async remove(id: number) {
    const item = await this.shopRepository.findOneBy({ id });
    if (!item) throw new NotFoundException(`Shop item ${id} not found.`);
    if (item.imagePublicId) {
      await this.cloudinaryService.deleteImage(item.imagePublicId);
    }
    await this.shopRepository.remove(item);
    return { id, deleted: true };
  }

  uploadImage(file: { buffer?: Buffer; mimetype?: string; originalname?: string; size?: number }) {
    return this.cloudinaryService.uploadShopImage(file);
  }
}
