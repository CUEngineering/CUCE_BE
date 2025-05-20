import { Controller, Get } from '@nestjs/common';

@Controller()
export class HomeController {
  @Get()
  getHome() {
    return {
      message: 'Welcome to CUCE backend version 1',
    };
  }
}
