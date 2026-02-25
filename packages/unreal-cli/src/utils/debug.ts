import { isDebug } from "./logLevel";

let _lastTime = performance.now();

/**
 * Log a timestamped debug message.
 * Only outputs when log level is "debug".
 */
export function debug(label: string): void {
	if (!isDebug()) return;
	const now = performance.now();
	const elapsed = now - _lastTime;
	_lastTime = now;
	console.log(`[DEBUG +${elapsed.toFixed(0)}ms] ${label}`);
}
