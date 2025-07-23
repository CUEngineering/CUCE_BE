import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../../../supabase/auth.guard';
import {
  AddCoursesToProgramDto,
  CreateProgramWithCoursesDto,
} from '../dto/add-courses-to-program.dto';
import { CreateProgramDto } from '../dto/create-program.dto';
import { UpdateProgramDto } from '../dto/update-program.dto';
import { ProgramService } from '../services/program.service';
import { ProgramCourseWithEnrollmentStatus } from '../types/program.types';

@Controller('programs')
@UseGuards(AuthGuard) // Apply authentication guard to all endpoints
export class ProgramController {
  constructor(private readonly programService: ProgramService) {}

  @Post()
  async create(
    @Body() createProgramDto: CreateProgramDto,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.programService.create(createProgramDto, req.accessToken);
  }
  // v1
  // @Get()
  // async findAll(@Req() req: Request & { accessToken: string }) {
  //   return this.programService.findAll(req.accessToken);
  // }
  // v2
  @Get()
  async findAll(@Req() req: Request & { accessToken: string }) {
    return this.programService.getAllProgramsWithStats(req.accessToken);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.programService.findOne(id, req.accessToken);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateProgramDto: UpdateProgramDto,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.programService.update(id, updateProgramDto, req.accessToken);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.programService.delete(id, req.accessToken);
  }

  @Get(':id/courses')
  async getProgramCourses(
    @Param('id') id: string,
    @Req() req: Request & { accessToken: string },
  ): Promise<ProgramCourseWithEnrollmentStatus[]> {
    return this.programService.getProgramCourses(id, req.accessToken);
  }

  @Get(':id/students')
  async getProgramStudents(
    @Param('id') id: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.programService.getProgramStudents(id, req.accessToken);
  }

  @Post(':id/courses')
  async addCourses(
    @Param('id') id: string,
    @Body() addCoursesDto: AddCoursesToProgramDto,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.programService.addCourses(id, addCoursesDto, req.accessToken);
  }

  @Delete(':id/courses/:courseId')
  async removeCourse(
    @Param('id') id: string,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.programService.removeCourse(id, courseId, req.accessToken);
  }

  @Post('with-courses')
  async createWithCourses(
    @Body() dto: CreateProgramWithCoursesDto,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.programService.createWithCourses(dto, req.accessToken);
  }
}
