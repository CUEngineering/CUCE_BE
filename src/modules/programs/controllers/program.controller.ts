import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ProgramService } from '../services/program.service';
import { CreateProgramDto } from '../dto/create-program.dto';
import { AuthGuard } from '../../../supabase/auth.guard';

@Controller('programs')
@UseGuards(AuthGuard) // Apply authentication guard to all endpoints
export class ProgramController {
  constructor(private readonly programService: ProgramService) {}

  @Post()
  async create(@Body() createProgramDto: CreateProgramDto) {
    return this.programService.create(createProgramDto);
  }

  @Get()
  async findAll() {
    return this.programService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.programService.findOne(id);
  }

  @Get(':id/courses')
  async getProgramCourses(@Param('id') id: string) {
    return this.programService.getProgramCourses(id);
  }

  @Get(':id/students')
  async getProgramStudents(@Param('id') id: string) {
    return this.programService.getProgramStudents(id);
  }
}
