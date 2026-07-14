export const USER_NOTIFICATIONS_RETENTION_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getUserNotificationsRetentionCutoff(now = new Date()): Date {
  return new Date(now.getTime() - USER_NOTIFICATIONS_RETENTION_DAYS * MS_PER_DAY);
}
