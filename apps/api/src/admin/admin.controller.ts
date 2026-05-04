import { Controller, Delete } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Delete('reset-past')
  resetPastData() {
    return this.adminService.resetPastData();
  }
}
