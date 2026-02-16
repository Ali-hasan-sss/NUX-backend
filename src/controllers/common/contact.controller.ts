import { Request, Response } from 'express';
import { sendContactEmail } from '../../utils/email';
import { body } from 'express-validator';

/**
 * POST /api/contact
 * Public. Sends contact form to support email (same as website).
 */
export const submitContact = async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message } = req.body;

    await sendContactEmail({
      name: String(name).trim(),
      email: String(email).trim(),
      subject: subject ? String(subject).trim() : '',
      message: String(message).trim(),
    });

    return res.status(200).json({
      success: true,
      message: 'Your message was sent successfully. We will contact you soon.',
    });
  } catch (err: any) {
    console.error('Contact form error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to send message. Please try again later.',
    });
  }
};

export const contactValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Please provide a valid email'),
  body('subject').optional().trim(),
  body('message').trim().notEmpty().withMessage('Message is required'),
];
