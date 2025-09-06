import { Request, Response, NextFunction } from 'express';
export declare const isAdminMiddleware: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const verifyRestaurantOwnership: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=Authorization.d.ts.map