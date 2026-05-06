import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { EmailModule } from 'src/email/email.module';

@Module({
  controllers: [UserController],
  providers: [UserService],
  imports: [EmailModule],
})
export class UserModule {}
