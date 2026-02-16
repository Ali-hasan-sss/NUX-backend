import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';

// SMTP: use your own settings via env (no Resend).
// Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
// Optional: SMTP_SECURE (true/false), EMAIL_FROM (display name/address)
const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!user || !pass) {
    throw new Error('SMTP credentials missing: set SMTP_USER/SMTP_PASS or EMAIL_USER/EMAIL_PASS');
  }

  if (host) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });
  }

  // Fallback: Gmail-style (service + auth only)
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
};

const getFrom = (): string => {
  const from = process.env.EMAIL_FROM;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  if (from) return from;
  if (user) return `"Support" <${user}>`;
  return '"Support"';
};

const getLogoUrl = (): string => {
  const base = process.env.FRONTEND_URL || process.env.SITE_URL || 'https://nuxapp.de';
  return `${base.replace(/\/$/, '')}/images/logo.png`;
};

const getAppName = (): string => {
  return process.env.APP_NAME || 'nux';
};

// Site visual identity: primary #00D9FF (cyan), dark text, light background
const BRAND = {
  primary: '#00D9FF',
  primaryDark: '#00b8d9',
  text: '#1a1a2e',
  textMuted: '#374151',
  textLight: '#6b7280',
  bgCard: '#ffffff',
  bgPage: '#f4f4f5',
  bgFooter: '#f0f9fa',
  border: '#e5e7eb',
  radius: '12px',
  fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
};

/** Shared HTML layout: logo, title, content block, footer (site branding) */
const buildBrandedEmail = (title: string, bodyHtml: string): string => {
  const logoUrl = getLogoUrl();
  const appName = getAppName();
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${appName}</title>
</head>
<body style="margin:0; padding:0; background-color:${BRAND.bgPage}; font-family:${BRAND.fontFamily};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${BRAND.bgPage}; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px; background-color:${BRAND.bgCard}; border-radius:${BRAND.radius}; box-shadow:0 2px 12px rgba(0,0,0,0.08); overflow:hidden;">
          <tr>
            <td style="padding: 28px 24px; text-align:center; border-bottom:1px solid ${BRAND.border}; background:linear-gradient(to bottom, #fff 0%, ${BRAND.bgFooter} 100%);">
              <img src="${logoUrl}" alt="${appName}" width="140" height="56" style="display:inline-block; max-height:56px; object-fit:contain;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 24px;">
              <h1 style="margin:0 0 20px; font-size:22px; font-weight:600; color:${BRAND.text};">${title}</h1>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 24px; background-color:${BRAND.bgFooter}; text-align:center; font-size:12px; color:${BRAND.textLight}; border-top:1px solid ${BRAND.border};">
              &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const sendVerificationEmail = async (user: { id: string; email: string }) => {
  const transporter = getTransporter();
  const from = getFrom();
  const secret =
    process.env.EMAIL_TOKEN_SECRET || process.env.ACCESS_TOKEN_SECRET || 'email-secret';
  const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '1d' });
  const url = `${process.env.FRONTEND_URL || 'https://nuxapp.de'}/verify-email?token=${token}`;

  const appName = getAppName();
  const html = buildBrandedEmail(
    'Verify your email',
    `<p style="margin:0 0 16px; font-size:15px; line-height:1.5; color:${BRAND.textMuted};">Click the button below to verify your email address.</p>
     <p style="margin:0 0 24px;"><a href="${url}" style="display:inline-block; padding:12px 24px; background-color:${BRAND.primary}; color:#fff; text-decoration:none; border-radius:8px; font-weight:600;">Verify email</a></p>
     <p style="margin:0; font-size:13px; color:${BRAND.textLight};">This link expires in 24 hours. If you didn't request this, you can ignore this email.</p>`,
  );

  await transporter.sendMail({
    from,
    to: user.email,
    subject: `Verify your email - ${appName}`,
    html,
  });
};

export const sendResetCodeEmail = async (email: string, code: string) => {
  const transporter = getTransporter();
  const appName = getAppName();
  const bodyHtml = `
    <p style="margin:0 0 16px; font-size:15px; line-height:1.5; color:${BRAND.textMuted};">You requested a password reset. Use the code below to set a new password.</p>
    <p style="margin:0 0 8px; font-size:13px; color:${BRAND.textLight};">Your reset code:</p>
    <p style="margin:0 0 20px; font-size:28px; font-weight:700; letter-spacing:6px; color:${BRAND.text}; background:${BRAND.bgFooter}; padding:16px 24px; border-radius:8px; text-align:center; border:1px solid ${BRAND.border};">${code}</p>
    <p style="margin:0; font-size:13px; color:${BRAND.textLight};">This code expires in 10 minutes. If you didn't request a reset, you can ignore this email.</p>`;
  const html = buildBrandedEmail('Password reset', bodyHtml);

  await transporter.sendMail({
    from: getFrom(),
    to: email,
    subject: `Password reset code - ${appName}`,
    text: `Your password reset code is: ${code}. It expires in 10 minutes.`,
    html,
  });
};

export const sendEmailVerificationCode = async (email: string, code: string) => {
  const transporter = getTransporter();
  const appName = getAppName();
  const bodyHtml = `
    <p style="margin:0 0 16px; font-size:15px; line-height:1.5; color:${BRAND.textMuted};">Please use the code below to verify your email address.</p>
    <p style="margin:0 0 8px; font-size:13px; color:${BRAND.textLight};">Your verification code:</p>
    <p style="margin:0 0 20px; font-size:28px; font-weight:700; letter-spacing:6px; color:${BRAND.text}; background:${BRAND.bgFooter}; padding:16px 24px; border-radius:8px; text-align:center; border:1px solid ${BRAND.border};">${code}</p>
    <p style="margin:0; font-size:13px; color:${BRAND.textLight};">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`;
  const html = buildBrandedEmail('Verify your email', bodyHtml);

  await transporter.sendMail({
    from: getFrom(),
    to: email,
    subject: `Verify your email - ${appName}`,
    text: `Your verification code is: ${code}. It expires in 10 minutes.`,
    html,
  });
};

const getContactEmail = (): string => {
  return process.env.CONTACT_EMAIL || process.env.SMTP_USER || 'info@nuxapp.de';
};

export interface ContactFormParams {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/**
 * Send contact form submission to support (info@nuxapp.de).
 */
export const sendContactEmail = async (params: ContactFormParams) => {
  const { name, email, subject, message } = params;
  const transporter = getTransporter();
  const to = getContactEmail();
  const appName = getAppName();
  const title = 'Contact form - NUX App';
  const bodyHtml = `
    <p style="margin:0 0 8px; font-size:15px; line-height:1.5; color:${BRAND.textMuted};"><strong>From:</strong> ${name} &lt;${email}&gt;</p>
    <p style="margin:0 0 8px; font-size:15px; line-height:1.5; color:${BRAND.textMuted};"><strong>Subject:</strong> ${subject || '(no subject)'}</p>
    <p style="margin:0 0 16px; font-size:13px; color:${BRAND.textLight}; border-bottom:1px solid ${BRAND.border}; padding-bottom:12px;">—</p>
    <p style="margin:0; font-size:15px; line-height:1.6; color:${BRAND.text}; white-space:pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
  const html = buildBrandedEmail(title, bodyHtml);

  await transporter.sendMail({
    from: getFrom(),
    to,
    replyTo: email,
    subject: `[NUX Contact] ${subject || 'Message from app'}`,
    text: `From: ${name} <${email}>\nSubject: ${subject || '(no subject)'}\n\n${message}`,
    html,
  });
};

export interface SubscriptionReminderParams {
  to: string;
  restaurantName: string;
  planName: string;
  endDate: Date;
  daysLeft: number;
}

/**
 * Send subscription renewal reminder email to restaurant owner (English).
 */
export const sendSubscriptionReminderEmail = async (params: SubscriptionReminderParams) => {
  const { to, restaurantName, planName, endDate, daysLeft } = params;
  const transporter = getTransporter();
  const appName = getAppName();
  const endDateStr = endDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const title =
    daysLeft === 30
      ? 'Subscription renewal reminder (30 days)'
      : 'Subscription renewal reminder (3 days)';
  const bodyHtml = `
    <p style="margin:0 0 16px; font-size:15px; line-height:1.5; color:${BRAND.textMuted};">Your subscription for <strong>${restaurantName}</strong> (plan: ${planName}) will end in <strong>${daysLeft} days</strong>.</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.5; color:${BRAND.textMuted};">End date: <strong>${endDateStr}</strong>.</p>
    <p style="margin:0 0 20px; font-size:15px; line-height:1.5; color:${BRAND.textMuted};">Please renew your subscription to continue using all features without interruption.</p>
    <p style="margin:0; font-size:13px; color:${BRAND.textLight};">If you have already renewed, you can ignore this email.</p>`;
  const html = buildBrandedEmail(title, bodyHtml);

  await transporter.sendMail({
    from: getFrom(),
    to,
    subject: `${title} - ${appName}`,
    text: `Your subscription for ${restaurantName} (${planName}) ends in ${daysLeft} days (${endDateStr}). Please renew to continue.`,
    html,
  });
};
