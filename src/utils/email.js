"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailVerificationCode = exports.sendResetCodeEmail = exports.sendVerificationEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});
const sendVerificationEmail = async (user) => {
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.EMAIL_TOKEN_SECRET, {
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
exports.sendVerificationEmail = sendVerificationEmail;
const sendResetCodeEmail = async (email, code) => {
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Password Reset Code',
        text: `Your password reset code is: ${code}. It will expire in 10 minutes.`,
    });
};
exports.sendResetCodeEmail = sendResetCodeEmail;
const sendEmailVerificationCode = async (email, code) => {
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'رمز تفعيل البريد الإلكتروني',
        text: `رمز التحقق الخاص بتفعيل بريدك الإلكتروني هو: ${code}. صالح لمدة 10 دقائق.`,
    });
};
exports.sendEmailVerificationCode = sendEmailVerificationCode;
//# sourceMappingURL=email.js.map