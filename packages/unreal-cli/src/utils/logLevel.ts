export type LogLevel = "silent" | "normal" | "debug";

let _level: LogLevel = "normal";

/** Set the current log level */
export function setLogLevel(level: LogLevel): void {
	_level = level;
}

/** Get the current log level */
export function getLogLevel(): LogLevel {
	return _level;
}

/** Check if output should be suppressed (silent mode) */
export function isSilent(): boolean {
	return _level === "silent";
}

/** Check if debug logging is enabled */
export function isDebug(): boolean {
	return _level === "debug";
}

/** Valid log level values for CLI option validation */
export const LOG_LEVEL_CHOICES = ["silent", "normal", "debug"] as const;
