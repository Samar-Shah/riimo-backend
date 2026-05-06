import { Resend } from 'resend';
import { BadRequestException } from '@nestjs/common';
import { OnboardingTemplate } from '../templates/OnboardingTemplate';

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {
  constructor() {}

  async sendEmail(to: string[]) {
    const { data, error } = await resend.emails.send({
      to,
      from: `Riimo <${process.env.ONBOARDING_EMAIL || 'no-reply@riimo.com'}>`,
      subject: 'Set up your password for Riimo',
      html: OnboardingTemplate,
    });

    if (error) throw new BadRequestException(error.message);

    return data;
  }
}
