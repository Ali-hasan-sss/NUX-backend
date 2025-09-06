import jwt from 'jsonwebtoken';
interface UserPayload {
    userId: string;
    role: string;
}
export declare const generateAccessToken: (payload: UserPayload) => string;
export declare const generateRefreshToken: (payload: UserPayload) => string;
export declare const verifyAccessToken: (token: string) => string | jwt.JwtPayload;
export declare const verifyRefreshToken: (token: string) => string | jwt.JwtPayload;
export {};
//# sourceMappingURL=token.d.ts.map