// Format a number of seconds as a tabular "MM:SS" countdown string.
export function formatCountdown(totalSeconds: number): string {
	const safe = Math.max(0, Math.floor(totalSeconds));
	const minutes = Math.floor(safe / 60);
	const seconds = safe % 60;
	const pad = (n: number) => n.toString().padStart(2, "0");
	return `${pad(minutes)}:${pad(seconds)}`;
}

// Format a wall-clock Date as "h:mm AM/PM" — used for the "Est. finish" stat.
export function formatClockTime(date: Date): string {
	let hours = date.getHours();
	const minutes = date.getMinutes();
	const meridiem = hours >= 12 ? "PM" : "AM";
	hours = hours % 12;
	if (hours === 0) hours = 12;
	return `${hours}:${minutes.toString().padStart(2, "0")} ${meridiem}`;
}

// Format a duration in minutes as a compact "Xh Ym" / "Ym" focus-time label.
export function formatDuration(totalMinutes: number): string {
	const safe = Math.max(0, Math.round(totalMinutes));
	const hours = Math.floor(safe / 60);
	const minutes = safe % 60;
	if (hours === 0) return `${minutes}m`;
	return `${hours}h ${minutes}m`;
}
