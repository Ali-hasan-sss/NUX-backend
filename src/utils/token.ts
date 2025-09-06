//src/utils/token.ts
import jwt from 'jsonwebtoken';
import {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
} from '../config/jwt';

interface UserPayload {
  userId: string;
  role: string;
}

export const generateAccessToken = (payload: UserPayload) => {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
};

export const generateRefreshToken = (payload: UserPayload) => {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
};

export const verifyAccessToken = (token: string) => jwt.verify(token, ACCESS_TOKEN_SECRET);

export const verifyRefreshToken = (token: string) => jwt.verify(token, REFRESH_TOKEN_SECRET);
