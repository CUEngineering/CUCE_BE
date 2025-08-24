import { Global, Module } from '@nestjs/common';
import { SharedSessionService } from './services/session.service';

const providers = [SharedSessionService];

@Global()
@Module({
  providers,
  exports: providers,
})
export class SharedModule {}
