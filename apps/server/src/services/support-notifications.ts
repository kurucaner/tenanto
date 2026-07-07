import { userDb } from "@/db/users";
import { UserType } from "@/packages/shared";
import { notificationStreamHub } from "@/services/notification-stream-hub";
import { notifyUser, truncateNotificationBody } from "@/services/user-notifications";
import { sendSupportReplyEmail } from "@/ses/transactional-emails";

export interface NotifySupportAdminReplyParams {
  attachmentCount: number;
  messageBody: string;
  supportRequestId: string;
  ticketUserId: string;
}

function buildSupportReplyNotificationBody(messageBody: string, attachmentCount: number): string {
  if (messageBody.length === 0 && attachmentCount > 0) {
    return "Sent an image";
  }
  return messageBody;
}

export async function notifySupportAdminReply(
  params: NotifySupportAdminReplyParams
): Promise<void> {
  const notificationBody = truncateNotificationBody(
    buildSupportReplyNotificationBody(params.messageBody, params.attachmentCount)
  );

  await notifyUser({
    body: notificationBody,
    resourceId: params.supportRequestId,
    resourceType: "support_request",
    title: "New reply on your support request",
    type: "support_request_reply",
    userId: params.ticketUserId,
  });

  if (notificationStreamHub.isUserConnected(params.ticketUserId)) {
    return;
  }

  const user = await userDb.findById(params.ticketUserId);
  if (user == null || user.userType !== UserType.USER) {
    return;
  }

  await sendSupportReplyEmail(user.email, {
    messagePreview: notificationBody,
    supportRequestId: params.supportRequestId,
  });
}
