import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { PrismaModule } from '../database/prisma.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GoogleStrategy } from './google.strategy';
import { SessionSerializer } from './session.serializer';

@Module({
  imports: [PrismaModule, PassportModule.register({ session: true })],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, SessionSerializer],
  exports: [AuthService],
})
export class AuthModule {}
