// Modules
import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './user/user.module';
// Controllers
import { AppController } from './app.controller';
// Services
import { AppService } from './app.service';
// Configs
import { auth } from './auth';

@Module({
  imports: [DatabaseModule, AuthModule.forRoot({ auth }), UserModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
