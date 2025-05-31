import axios from 'axios';
import { readFile } from 'fs-extra';
import { join } from 'path';
import Handlebars from 'handlebars';

const RESEND_API_URL = 'https://api.resend.com/emails';

interface SendEmailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
  from?: string;
}

export async function sendEmail({
  to,
  subject,
  template,
  context,
  from = process.env.RESEND_DOMAIN,
}: SendEmailOptions): Promise<void> {
  try {
    const templatePath = join(__dirname, '..', 'templates', template);
    const rawHtml = await readFile(templatePath, 'utf-8');
    const compiled = Handlebars.compile(rawHtml);
    const html = compiled(context);

    const response = await axios.post(
      RESEND_API_URL,
      { to, subject, html, from },
      {
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.status >= 400) {
      console.error('Email send error:', response.data);
      throw new Error('Failed to send email');
    }
  } catch (err) {
    console.error('Resend API error:', err?.response?.data || err.message);
    throw err;
  }
}

export async function sendResetTokenEmail(email: string, token: string) {
  await sendEmail({
    to: email,
    subject: 'Password Reset Request',
    template: 'reset-password.html',
    context: { token },
  });
}
