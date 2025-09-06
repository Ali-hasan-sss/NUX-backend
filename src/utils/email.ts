import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER!,
    pass: process.env.EMAIL_PASS!,
  },
});

export const sendVerificationEmail = async (user: { id: string; email: string }) => {
  const token = jwt.sign({ userId: user.id }, process.env.EMAIL_TOKEN_SECRET!, {
    expiresIn: '1d',
  });

  const url = `https://yourdomain.com/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"Support" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'تأكيد البريد الإلكتروني',
    html: `<p>اضغط على الرابط التالي لتأكيد بريدك الإلكتروني:</p><a href="${url}">${url}</a>`,
  });
};

export const sendResetCodeEmail = async (email: string, code: string) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset Code',
    text: `Your password reset code is: ${code}. It will expire in 10 minutes.`,
  });
};

export const sendEmailVerificationCode = async (email: string, code: string) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'رمز تفعيل البريد الإلكتروني',
    text: `رمز التحقق الخاص بتفعيل بريدك الإلكتروني هو: ${code}. صالح لمدة 10 دقائق.`,
  });
};
