import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CourseService } from '../services/course.service';
import { CreateCourseDto } from '../dto/create-course.dto';
import { AuthGuard } from '../../../supabase/auth.guard';
import { Request } from 'express';

@Controller('courses')
@UseGuards(AuthGuard) // Apply authentication guard to all endpoints
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post()
  async create(
    @Body() createCourseDto: CreateCourseDto,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.courseService.create(createCourseDto, req.accessToken);
  }

  @Get()
  async findAll(@Req() req: Request & { accessToken: string }) {
    return this.courseService.findAll(req.accessToken);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.courseService.findOne(id, req.accessToken);
  }
}
