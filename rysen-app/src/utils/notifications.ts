// utils/notifications.ts
import { messaging, messagingSupportPromise } from "../firebase";
import { getToken } from "firebase/messaging";

export async function requestNotificationPermission() {
  await messagingSupportPromise;
  if (!messaging) {
    console.warn("FCM not supported or not initialized");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const fcmToken = await getToken(messaging, {
        vapidKey: "BCMW_1bVlIj4L6Tcm9NyYTZb5uDfjisopKjKybhNfMXgs3s-JFYDVGyOSRgC7FWwHTkAUL5qbgE_aX7dcMaAP88",
      });
      console.log("FCM Token:", fcmToken);
      return fcmToken;
    } else {
      console.warn("Notification permission denied");
      return null;
    }
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
}
