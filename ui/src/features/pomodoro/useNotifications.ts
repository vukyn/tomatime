"use client";

import { useCallback, useEffect, useState } from "react";
import { NOTIF_DISMISSED_STORAGE_KEY } from "@/features/pomodoro/constants";

// True only in browsers that expose the Notification Web API. SSR-safe.
const notificationsSupported =
	typeof window !== "undefined" && "Notification" in window;

function readPermission(): NotificationPermission {
	// Guarded for browsers without the API; "default" is the neutral fallback so
	// callers can treat it uniformly (the nudge gates on `supported` separately).
	if (!notificationsSupported) return "default";
	return Notification.permission;
}

function loadDismissed(): boolean {
	try {
		return localStorage.getItem(NOTIF_DISMISSED_STORAGE_KEY) === "true";
	} catch {
		return false;
	}
}

export interface UseNotificationsReturn {
	// False on browsers without the Notification API — the nudge never shows.
	supported: boolean;
	permission: NotificationPermission; // "default" | "denied" | "granted"
	// Ask for permission (only meaningful while still "default"). Fire-and-forget;
	// re-reads Notification.permission once the user answers.
	request: () => void;
	// Persisted "user dismissed the nudge" flag (mirrors useTasks persistence).
	dismissed: boolean;
	dismiss: () => void;
}

// Drives the notification NUDGE banner UI: tracks the current browser permission
// + a persisted dismissed flag, and lets the banner trigger a permission request.
// The actual firing of notifications at interval end lives in useTimer — this
// hook does NOT notify; it only powers the nudge and the explicit "Enable" path.
export function useNotifications(): UseNotificationsReturn {
	const [permission, setPermission] = useState<NotificationPermission>(() =>
		readPermission()
	);
	const [dismissed, setDismissed] = useState<boolean>(() => loadDismissed());

	useEffect(() => {
		try {
			localStorage.setItem(
				NOTIF_DISMISSED_STORAGE_KEY,
				dismissed ? "true" : "false"
			);
		} catch {
			// storage may be unavailable (private mode / quota) — degrade silently.
		}
	}, [dismissed]);

	// Ask once, on the user gesture that clicked "Enable". Browsers only grant
	// from a gesture and only while the choice is pending, so we skip if already
	// granted or denied. Re-read permission when the prompt resolves to swap the
	// banner to its granted/denied variant. Idempotent — overlaps harmlessly with
	// useTimer's own start-time requestNotifyPermission.
	const request = useCallback(() => {
		if (!notificationsSupported) return;
		if (Notification.permission !== "default") {
			setPermission(Notification.permission);
			return;
		}
		void Notification.requestPermission()
			.then(() => setPermission(Notification.permission))
			.catch(() => {});
	}, []);

	const dismiss = useCallback(() => {
		setDismissed(true);
	}, []);

	return {
		supported: notificationsSupported,
		permission,
		request,
		dismissed,
		dismiss,
	};
}
