export declare const sendVerificationEmail: (user: {
    id: string;
    email: string;
}) => Promise<void>;
export declare const sendResetCodeEmail: (email: string, code: string) => Promise<void>;
export declare const sendEmailVerificationCode: (email: string, code: string) => Promise<void>;
//# sourceMappingURL=email.d.ts.map