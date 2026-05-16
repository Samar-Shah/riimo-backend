import { Resend } from 'resend';
import { BadRequestException } from '@nestjs/common';

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {
  constructor() {}

  async sendEmail(to: string[], from: string, subject: string, html: string) {
    const { data, error } = await resend.emails.send({
      to,
      from,
      subject,
      html,
    });

    if (error) throw new BadRequestException(error.message);

    return data;
  }
}
