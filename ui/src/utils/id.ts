// Small client-side id generator for localStorage-backed task rows.
// Prefers crypto.randomUUID where available, with a non-crypto fallback.
export function newId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
