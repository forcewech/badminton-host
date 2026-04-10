import { Body, Controller, Headers, Post } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { BookingsService } from "./bookings.service";

@Controller("payment")
export class PaymentController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Public()
  @Post("callback")
  async callback(
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    await this.bookingsService.processDepositWebhook(payload, headers);
    return "Data received";
  }
}
