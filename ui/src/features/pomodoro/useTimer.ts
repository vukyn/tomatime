"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	INTERVAL_MINUTES,
	MAX_MINUTES,
	MIN_MINUTES,
	POMODOROS_PER_LONG_BREAK,
} from "@/features/pomodoro/constants";
import type { IntervalKind } from "@/features/pomodoro/types";

const clampMinutes = (value: number) =>
	Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(value)));

// Alarm played when any interval reaches 00:00. The file may be longer than we
// want, so we cap playback to the first ALARM_PLAY_MS and then stop. A single
// shared element is reused (preloaded once) — never one Audio per tick.
const ALARM_SRC = "/sounds/alarm.mp3";
const ALARM_PLAY_MS = 3000;
// HTMLAudioElement.volume maxes out at 1.0, so to make the alarm a touch louder
// than the raw file we route it through a Web Audio gain node and boost above
// unity. The graph (element → gain → speakers) is wired once on first play.
const ALARM_GAIN = 1.6;
let alarmEl: HTMLAudioElement | null = null;
let alarmStopTimer: number | undefined;
let alarmContext: AudioContext | null = null;
let alarmGainWired = false;

function playAlarm() {
	if (typeof window === "undefined") return;
	if (!alarmEl) {
		alarmEl = new Audio(ALARM_SRC);
		alarmEl.preload = "auto";
		// crossOrigin lets the element feed a MediaElementSource without tainting.
		alarmEl.crossOrigin = "anonymous";
	}
	// Wire the gain graph the first time we have a user-gesture-unlocked context.
	// createMediaElementSource can only be called once per element, hence the flag.
	if (!alarmGainWired) {
		const AudioCtx =
			window.AudioContext ?? (window as typeof window & {
				webkitAudioContext?: typeof AudioContext;
			}).webkitAudioContext;
		if (AudioCtx) {
			try {
				alarmContext = new AudioCtx();
				const source = alarmContext.createMediaElementSource(alarmEl);
				const gain = alarmContext.createGain();
				gain.gain.value = ALARM_GAIN;
				source.connect(gain).connect(alarmContext.destination);
				alarmGainWired = true;
			} catch {
				// No Web Audio (or already wired) — fall back to the raw element.
				alarmContext = null;
			}
		}
	}
	// The context starts suspended until a gesture; START is one, so resume here.
	void alarmContext?.resume().catch(() => {});
	window.clearTimeout(alarmStopTimer);
	alarmEl.currentTime = 0;
	// Autoplay is unlocked once the user clicks START, so this resolves; swallow
	// any reject (e.g. file missing) so the timer never breaks on audio.
	void alarmEl.play().catch(() => {});
	alarmStopTimer = window.setTimeout(() => {
		if (!alarmEl) return;
		alarmEl.pause();
		alarmEl.currentTime = 0;
	}, ALARM_PLAY_MS);
}

// Short keypress click played on every start/stop toggle. Shared element,
// preloaded once. The file has ~50ms of dead lead-in, so playback starts at
// CLICK_START_OFFSET to skip it and the tap is heard immediately.
const CLICK_SRC = "/sounds/click.mp3";
const CLICK_START_OFFSET = 0.04; // seconds skipped at the head
let clickEl: HTMLAudioElement | null = null;

function playClick() {
	if (typeof window === "undefined") return;
	if (!clickEl) {
		clickEl = new Audio(CLICK_SRC);
		clickEl.preload = "auto";
	}
	clickEl.currentTime = CLICK_START_OFFSET;
	void clickEl.play().catch(() => {});
}

// Desktop notification fired alongside the alarm when an interval ends, so a
// backgrounded tab still surfaces the hand-off. No-op on browsers without the
// API and unless the user has granted permission. A stable tag makes repeated
// notifications replace rather than stack.
const NOTIFY_ICON = "/tomatime.svg";
const NOTIFY_TAG = "tomatime-timer";

function notify(title: string, body: string) {
	if (typeof window === "undefined" || !("Notification" in window)) return;
	if (Notification.permission !== "granted") return;
	try {
		// requireInteraction keeps the banner up until the user dismisses it, so a
		// glance away doesn't miss the hand-off; renotify re-alerts even though the
		// stable tag would otherwise silently replace the prior one.
		new Notification(title, {
			body,
			icon: NOTIFY_ICON,
			tag: NOTIFY_TAG,
			requireInteraction: true,
			// renotify re-alerts despite the stable tag; not yet in the TS DOM lib.
			renotify: true,
		} as NotificationOptions & { renotify: boolean });
	} catch {
		// Never let a notification failure break the timer.
	}
}

// Ask once, on the user gesture that starts the timer. Browsers only grant from
// a gesture and only when the choice is still pending, so we skip if already
// granted or denied. Fire-and-forget; unsupported browsers no-op.
function requestNotifyPermission() {
	if (typeof window === "undefined" || !("Notification" in window)) return;
	if (Notification.permission !== "default") return;
	void Notification.requestPermission().catch(() => {});
}

export interface UseTimerOptions {
	// Fired when a FOCUS (pomodoro) interval reaches 00:00 naturally.
	// NOT fired when the focus interval is skipped.
	onFocusComplete?: () => void;
}

export interface UseTimerReturn {
	interval: IntervalKind;
	running: boolean;
	remaining: number; // seconds left
	total: number; // seconds in the current interval
	progress: number; // 0..1 elapsed fraction
	minutes: number; // configured pomodoro length (idle-adjustable)
	selectInterval: (kind: IntervalKind) => void;
	start: () => void;
	stop: () => void;
	toggle: () => void;
	skip: () => void;
	incrementMinutes: () => void;
	decrementMinutes: () => void;
	atMinMinutes: boolean;
	atMaxMinutes: boolean;
}

// Drives the countdown + the interval cycle rule. Pure client state.
export function useTimer(options: UseTimerOptions = {}): UseTimerReturn {
	const { onFocusComplete } = options;

	// User-configurable focus length; break lengths use their fixed defaults.
	const [pomodoroMinutes, setPomodoroMinutes] = useState(INTERVAL_MINUTES.pomodoro);
	const [interval, setInterval] = useState<IntervalKind>("pomodoro");
	const [running, setRunning] = useState(false);
	const [remaining, setRemaining] = useState(INTERVAL_MINUTES.pomodoro * 60);
	// Completed focus pomodoros in the current set (drives long-break cadence).
	const [setCount, setSetCount] = useState(0);

	const onFocusCompleteRef = useRef(onFocusComplete);
	useEffect(() => {
		onFocusCompleteRef.current = onFocusComplete;
	}, [onFocusComplete]);

	const minutesFor = useCallback(
		(kind: IntervalKind) =>
			kind === "pomodoro" ? pomodoroMinutes : INTERVAL_MINUTES[kind],
		[pomodoroMinutes]
	);

	const total = minutesFor(interval) * 60;

	// Load a given interval's default duration and reset to idle.
	const loadInterval = useCallback(
		(kind: IntervalKind, nextSetCount?: number) => {
			setInterval(kind);
			setRemaining(minutesFor(kind) * 60);
			setRunning(false);
			if (nextSetCount !== undefined) setSetCount(nextSetCount);
		},
		[minutesFor]
	);

	// Apply the cycle rule when a focus/break interval ends (or is skipped).
	// `countedFocus` = a focus interval finished naturally (count it).
	const advanceCycle = useCallback(
		(countedFocus: boolean) => {
			if (interval === "pomodoro") {
				const newSetCount = countedFocus ? setCount + 1 : setCount;
				const goLong = countedFocus && newSetCount % POMODOROS_PER_LONG_BREAK === 0;
				loadInterval(goLong ? "longBreak" : "shortBreak", newSetCount);
			} else if (interval === "longBreak") {
				// Long break done → fresh set.
				loadInterval("pomodoro", 0);
			} else {
				loadInterval("pomodoro");
			}
		},
		[interval, setCount, loadInterval]
	);

	// Keep the latest interval + advance handler in refs so the once-per-second
	// tick can resolve natural completion without re-subscribing every tick.
	const intervalRef = useRef(interval);
	useEffect(() => {
		intervalRef.current = interval;
	}, [interval]);
	const advanceCycleRef = useRef(advanceCycle);
	useEffect(() => {
		advanceCycleRef.current = advanceCycle;
	}, [advanceCycle]);

	// Absolute wall-clock target the countdown is racing toward. We derive
	// `remaining` from this on every tick instead of counting ticks, so the timer
	// stays accurate even when background tabs throttle the interval — one tick on
	// refocus snaps the display back to real time. Null while idle/paused.
	const deadlineRef = useRef<number | null>(null);

	// Mirror `remaining` so the running effect can seed a fresh deadline without
	// re-subscribing every second (it keys only on `running`).
	const remainingRef = useRef(remaining);
	useEffect(() => {
		remainingRef.current = remaining;
	}, [remaining]);

	// Tick while running. We pin a deadline once, then each tick recomputes how
	// many whole seconds are left from the clock. The tick runs from a timer
	// callback (not an effect/render body), so it drives the countdown and the
	// zero-cross side-effects with plain setState calls — the cycle rule's own
	// state updates must stay OUT of the setRemaining updater, or returning 0 from
	// that updater clobbers the next interval's reset. A finer interval makes the
	// refocus snap + repaint feel smoother; the visible value still steps once per
	// second because we ceil to whole seconds.
	useEffect(() => {
		if (!running) return;
		// Resume builds a fresh deadline from the frozen `remaining`, so pausing
		// and continuing preserves the seconds left.
		if (deadlineRef.current == null) {
			deadlineRef.current = Date.now() + remainingRef.current * 1000;
		}
		const tick = () => {
			if (deadlineRef.current == null) return;
			const left = Math.max(
				0,
				Math.ceil((deadlineRef.current - Date.now()) / 1000)
			);
			if (left > 0) {
				setRemaining(left);
				return;
			}
			// Reached zero — clear the deadline first so a stray throttled tick
			// can't re-enter these side-effects before the effect tears down.
			deadlineRef.current = null;
			const wasFocus = intervalRef.current === "pomodoro";
			// Sound on every natural interval end (focus + breaks), capped to 3s.
			playAlarm();
			// Mirror the alarm with a notification so a backgrounded tab still
			// announces the hand-off to the next phase.
			if (wasFocus) {
				notify("Focus complete", "Nice work — time for a break.");
			} else {
				notify("Break over", "Back to focus.");
			}
			if (wasFocus) onFocusCompleteRef.current?.();
			// advanceCycle resets running/remaining/interval for the next phase.
			advanceCycleRef.current(wasFocus);
		};
		const handle = window.setInterval(tick, 250);
		// Recompute the instant the tab regains focus so a long-throttled timer
		// doesn't wait up to a full interval before snapping to the right value.
		const onVisibility = () => {
			if (!document.hidden) tick();
		};
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			window.clearInterval(handle);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [running]);

	const selectInterval = useCallback(
		(kind: IntervalKind) => {
			if (kind === interval) return;
			loadInterval(kind);
		},
		[interval, loadInterval]
	);

	const start = useCallback(() => {
		// Starting is a user gesture — the one moment a browser will prompt.
		requestNotifyPermission();
		if (remaining <= 0) setRemaining(total);
		setRunning(true);
	}, [remaining, total]);

	// Pausing drops the deadline so the next start rebuilds it from the frozen
	// `remaining`, preserving the seconds left across pause/resume.
	const stop = useCallback(() => {
		deadlineRef.current = null;
		setRunning(false);
	}, []);
	const toggle = useCallback(() => {
		playClick();
		// Toggling to running is also a start gesture — ask while we still can.
		if (!running) requestNotifyPermission();
		setRunning((prev) => {
			// Pausing via toggle must also drop the deadline (it bypasses stop) so
			// resume rebuilds it from the frozen `remaining` rather than racing a
			// stale, now-past target.
			if (prev) deadlineRef.current = null;
			return !prev;
		});
	}, [running]);

	// Skip ends the current interval immediately (does NOT count a focus pomodoro).
	const skip = useCallback(() => {
		advanceCycle(false);
	}, [advanceCycle]);

	const incrementMinutes = useCallback(() => {
		if (running || interval !== "pomodoro") return;
		setPomodoroMinutes((prev) => {
			const next = clampMinutes(prev + 1);
			setRemaining(next * 60);
			return next;
		});
	}, [running, interval]);

	const decrementMinutes = useCallback(() => {
		if (running || interval !== "pomodoro") return;
		setPomodoroMinutes((prev) => {
			const next = clampMinutes(prev - 1);
			setRemaining(next * 60);
			return next;
		});
	}, [running, interval]);

	const progress = total > 0 ? (total - remaining) / total : 0;

	return {
		interval,
		running,
		remaining,
		total,
		progress,
		minutes: pomodoroMinutes,
		selectInterval,
		start,
		stop,
		toggle,
		skip,
		incrementMinutes,
		decrementMinutes,
		atMinMinutes: pomodoroMinutes <= MIN_MINUTES,
		atMaxMinutes: pomodoroMinutes >= MAX_MINUTES,
	};
}
