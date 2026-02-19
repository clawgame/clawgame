import { ArenaType, NotificationDeliveryStatus } from '@prisma/client';

export function getNotificationDeliveryDefaults(): {
  emailStatus: NotificationDeliveryStatus;
  pushStatus: NotificationDeliveryStatus;
} {
  const emailEnabled = process.env.NOTIFICATIONS_EMAIL_ENABLED === 'true';
  const pushEnabled = process.env.NOTIFICATIONS_PUSH_ENABLED === 'true';

  return {
    emailStatus: emailEnabled ? NotificationDeliveryStatus.PENDING : NotificationDeliveryStatus.SKIPPED,
    pushStatus: pushEnabled ? NotificationDeliveryStatus.PENDING : NotificationDeliveryStatus.SKIPPED,
  };
}

export function arenaLabel(arena: ArenaType): string {
  switch (arena) {
    case ArenaType.THE_PIT:
      return 'The Pit';
    case ArenaType.COLOSSEUM:
      return 'Colosseum';
    case ArenaType.SPEED_TRADE:
      return 'Speed Trade';
    case ArenaType.BAZAAR:
      return 'Bazaar';
    default:
      return 'Arena';
  }
}
