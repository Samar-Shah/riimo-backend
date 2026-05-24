// Modules
import { Module } from '@nestjs/common';
import { AuthGuard, AuthModule } from '@thallesp/nestjs-better-auth';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './user/user.module';
// Controllers
import { AppController } from './app.controller';
// Services
import { AppService } from './app.service';
// Guards
import { APP_GUARD } from '@nestjs/core';
import { UserStatusGuard } from './common/guards/user-status.guard';
// Configs
import { auth } from './auth';
import { OrganizationModule } from './organization/organization.module';

@Module({
  imports: [
    DatabaseModule,
    UserModule,
    AuthModule.forRoot({ auth, disableGlobalAuthGuard: true }),
    OrganizationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: UserStatusGuard },
  ],
})
export class AppModule {}
