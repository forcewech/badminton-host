import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/public.decorator';
import { CreateShopItemDto } from './dto/create-shop-item.dto';
import { UpdateShopItemDto } from './dto/update-shop-item.dto';
import { ShopService } from './shop.service';

@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Public()
  @Get('items')
  findAllPublic() {
    return this.shopService.findAllPublic();
  }

  @Get('admin/items')
  findAllAdmin() {
    return this.shopService.findAllAdmin();
  }

  @Post('items')
  create(@Body() dto: CreateShopItemDto) {
    return this.shopService.create(dto);
  }

  @Patch('items/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShopItemDto,
  ) {
    return this.shopService.update(id, dto);
  }

  @Delete('items/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.shopService.remove(id);
  }

  @Post('items/upload-image')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @UploadedFile()
    file: { buffer?: Buffer; mimetype?: string; originalname?: string; size?: number },
  ) {
    return this.shopService.uploadImage(file);
  }
}
