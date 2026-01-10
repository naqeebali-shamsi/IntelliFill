import { Resend } from 'resend';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';
const FROM_EMAIL = process.env.EMAIL_FROM || 'IntelliFill <noreply@intellifill.com>';

interface InvitationEmailParams {
  email: string;
  organizationName: string;
  inviterName: string;
  role: string;
  invitationId: string;
}

export async function sendInvitationEmail(params: InvitationEmailParams): Promise<boolean> {
  const { email, organizationName, inviterName, role, invitationId } = params;

  if (!resend) {
    logger.warn(
      'Email service not configured (RESEND_API_KEY not set), skipping invitation email',
      {
        email,
        organizationName,
      }
    );
    return false;
  }

  const inviteUrl = `${FRONTEND_URL}/accept-invite?token=${invitationId}`;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `You've been invited to join ${organizationName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #3b82f6; margin: 0;">IntelliFill</h1>
            </div>

            <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
              <h2 style="margin: 0 0 20px 0; color: #1e293b;">You've been invited!</h2>
              <p style="margin: 0 0 20px 0; font-size: 16px;">
                <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> as a <strong>${role}</strong>.
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteUrl}" style="display: inline-block; padding: 14px 32px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Accept Invitation
                </a>
              </div>

              <p style="margin: 20px 0 0 0; font-size: 14px; color: #64748b;">
                This invitation expires in 7 days.
              </p>
            </div>

            <div style="text-align: center; font-size: 12px; color: #94a3b8;">
              <p>If you didn't expect this invitation, you can safely ignore this email.</p>
              <p style="margin-top: 10px;">
                <a href="${FRONTEND_URL}" style="color: #3b82f6; text-decoration: none;">IntelliFill</a>
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      logger.error('Failed to send invitation email', { email, error: error.message });
      return false;
    }

    logger.info('Invitation email sent successfully', { email, organizationName });
    return true;
  } catch (error) {
    logger.error('Email service error', {
      email,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}
