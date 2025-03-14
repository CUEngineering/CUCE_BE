import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { AuthGuard } from './auth.guard';
import { SignUpDto, SignInDto } from './dto/auth.dto';

@Controller('auth')
export class SupabaseController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Post('signup')
  @UsePipes(new ValidationPipe())
  async signUp(@Body() signUpDto: SignUpDto) {
    return this.supabaseService.signUp(signUpDto.email, signUpDto.password);
  }

  @Post('signin')
  @UsePipes(new ValidationPipe())
  async signIn(@Body() signInDto: SignInDto) {
    return this.supabaseService.signIn(signInDto.email, signInDto.password);
  }

  @Post('signout')
  @UseGuards(AuthGuard)
  async signOut() {
    return this.supabaseService.signOut();
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getCurrentUser(@Req() req) {
    return req.user;
  }
}
