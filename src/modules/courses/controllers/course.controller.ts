import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CourseService } from '../services/course.service';
import { CreateCourseDto } from '../dto/create-course.dto';
import { UpdateCourseDto } from '../dto/update-course.dto';
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

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCourseDto: UpdateCourseDto,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.courseService.update(id, updateCourseDto, req.accessToken);
  }
}
