declare module 'xss-clean';
declare module 'csurf';

import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
