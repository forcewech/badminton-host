import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudinaryService } from '../bookings/cloudinary.service';
import { ShopItem } from './entities/shop-item.entity';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShopItem])],
  controllers: [ShopController],
  providers: [ShopService, CloudinaryService],
})
export class ShopModule {}
