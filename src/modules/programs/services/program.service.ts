import { Injectable, Req } from '@nestjs/common';
import { CreateProgramDto } from '../dto/create-program.dto';
import { SupabaseService } from '../../../supabase/supabase.service';

@Injectable()
export class ProgramService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createProgramDto: CreateProgramDto, accessToken: string) {
    return this.supabaseService.insert(
      accessToken,
      'programs',
      createProgramDto,
    );
  }

  async findAll(accessToken: string) {
    return this.supabaseService.select(accessToken, 'programs', {});
  }

  async findOne(id: string, accessToken: string) {
    return this.supabaseService.select(accessToken, 'programs', {
      filter: { program_id: id },
    });
  }

  async getProgramCourses(id: string, accessToken: string) {
    return this.supabaseService.select(accessToken, 'program_courses', {
      filter: { program_id: id },
    });
  }

  async getProgramStudents(id: string, accessToken: string) {
    return this.supabaseService.select(accessToken, 'students', {
      filter: { program_id: id },
    });
  }
}
