interface SendNotificationInput {
    userId: string;
    title: string;
    body: string;
    type?: string;
    data?: Record<string, string>;
}
interface SendNotificationToUsersInput {
    userIds: string[];
    title: string;
    body: string;
    type?: string;
    data?: Record<string, string>;
}
export declare const sendNotificationToUser: (input: SendNotificationInput) => Promise<{
    id: number;
    createdAt: Date;
    title: string;
    userId: string;
    body: string;
    type: string;
    isRead: boolean;
}>;
export declare const sendNotificationToUsers: (input: SendNotificationToUsersInput) => Promise<import("@prisma/client").Prisma.BatchPayload>;
export {};
//# sourceMappingURL=notification.service.d.ts.map