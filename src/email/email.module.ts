import { Module, OnModuleInit } from '@nestjs/common';
import { EmailService } from './email.service';
import { setEmailService } from '../auth';

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule implements OnModuleInit {
  constructor(private readonly emailService: EmailService) {}

  onModuleInit() {
    setEmailService(this.emailService);
  }
}
