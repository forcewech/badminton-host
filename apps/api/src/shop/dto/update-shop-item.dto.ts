import { PartialType } from '@nestjs/mapped-types';
import { CreateShopItemDto } from './create-shop-item.dto';

export class UpdateShopItemDto extends PartialType(CreateShopItemDto) {}
