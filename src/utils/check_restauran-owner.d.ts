export declare function assertOwnerOrAdmin(userId: string, restaurantId: string): Promise<{
    ok: boolean;
    code: 404;
    msg: string;
} | {
    ok: boolean;
    code: 401;
    msg: string;
} | {
    ok: true;
    code?: never;
    msg?: never;
} | {
    ok: boolean;
    code: 403;
    msg: string;
}>;
//# sourceMappingURL=check_restauran-owner.d.ts.map