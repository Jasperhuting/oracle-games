import { NextRequest, NextResponse } from 'next/server';
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';

export async function POST(request: NextRequest) {
  try {
    const { to, subject, message } = await request.json();

    // Validate input
    if (!to || !subject || !message) {
      return NextResponse.json(
        { error: 'Ontbrekende velden: to, subject en message zijn verplicht' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Ongeldig email adres' },
        { status: 400 }
      );
    }

    // Check for MailerSend API key
    const apiKey = process.env.MAILERSEND_API_KEY;
    const fromEmail = process.env.MAILERSEND_FROM_EMAIL;
    const fromName = process.env.MAILERSEND_FROM_NAME || 'Oracle Games';

    if (!apiKey || !fromEmail) {
      console.error('MailerSend API key or from email not configured');
      return NextResponse.json(
        { error: 'Email service not configured. Please contact the administrator.' },
        { status: 500 }
      );
    }

    // Initialize MailerSend
    const mailerSend = new MailerSend({
      apiKey: apiKey,
    });

    // Create email parameters
    const sentFrom = new Sender(fromEmail, fromName);
    const recipients = [new Recipient(to, to)];

    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject(subject)
      .setHtml(`<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <p>${message.replace(/\n/g, '<br>')}</p>
      </div>`)
      .setText(message);

    // Send email
    const response = await mailerSend.email.send(emailParams);

    return NextResponse.json({
      success: true,
      message: 'Email succesvol verstuurd',
      messageId: response.headers?.get('x-message-id') || 'unknown',
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Kon email niet versturen',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
