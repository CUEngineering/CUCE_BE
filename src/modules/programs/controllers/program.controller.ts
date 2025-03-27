import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProgramService } from '../services/program.service';
import { CreateProgramDto } from '../dto/create-program.dto';
import { AddCoursesToProgramDto } from '../dto/add-courses-to-program.dto';
import { AuthGuard } from '../../../supabase/auth.guard';
import { Request } from 'express';

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

  @Get()
  async findAll(@Req() req: Request & { accessToken: string }) {
    return this.programService.findAll(req.accessToken);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.programService.findOne(id, req.accessToken);
  }

  @Get(':id/courses')
  async getProgramCourses(
    @Param('id') id: string,
    @Req() req: Request & { accessToken: string },
  ) {
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
    @Param('courseId') courseId: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.programService.removeCourse(id, courseId, req.accessToken);
  }
}
