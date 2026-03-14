export function isBrowserNotificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getBrowserNotificationPermission():
  | NotificationPermission
  | "unsupported" {
  if (!isBrowserNotificationsSupported()) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestBrowserNotificationPermission():
  Promise<NotificationPermission | "unsupported"> {
  if (!isBrowserNotificationsSupported()) {
    return "unsupported";
  }
  return Notification.requestPermission();
}

export function sendBrowserNotification(
  title: string,
  options?: NotificationOptions
) {
  if (!isBrowserNotificationsSupported()) return false;
  if (Notification.permission !== "granted") return false;
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
