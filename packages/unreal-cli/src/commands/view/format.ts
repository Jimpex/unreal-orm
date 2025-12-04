import { theme } from "./theme";

/**
 * Format a count value for display
 */
export function formatCount(count: number | "?" | "timeout"): string {
	if (count === "timeout") return theme.warning("timeout");
	if (count === "?") return theme.dim("?");
	if (count >= 1000000)
		return theme.highlight(`${(count / 1000000).toFixed(1)}M`);
	if (count >= 1000) return theme.highlight(`${(count / 1000).toFixed(1)}K`);
	return theme.highlight(String(count));
}

/**
 * Format a value for table/list display (compact, single-line)
 * @param maxLen - Maximum length for strings before truncation (default 40)
 */
export function formatValue(val: unknown, maxLen = 40): string {
	if (val === undefined || val === null) {
		return theme.dim("null");
	}
	if (Array.isArray(val)) {
		if (val.length === 0) return theme.dim("[]");
		if (val.length <= 5) {
			const preview = val.map((v) => formatPrimitive(v)).join(", ");
			const result = `[${preview}]`;
			if (result.length > maxLen) return theme.dim(`[${val.length} items]`);
			return theme.dim(result);
		}
		return theme.dim(`[${val.length} items]`);
	}
	if (typeof val === "object") {
		// Try to stringify for special objects (RecordId, etc.)
		const str = String(val);
		if (str !== "[object Object]") {
			if (str.length > maxLen)
				return theme.dim(`${str.slice(0, maxLen - 3)}...`);
			return theme.dim(str);
		}
		const keys = Object.keys(val);
		if (keys.length === 0) {
			try {
				const json = JSON.stringify(val);
				if (json.length > maxLen)
					return theme.dim(`${json.slice(0, maxLen - 3)}...`);
				return theme.dim(json);
			} catch {
				return theme.dim("{}");
			}
		}
		if (keys.length <= 5) {
			const preview = keys
				.map(
					(k) =>
						`${k}: ${formatPrimitive((val as Record<string, unknown>)[k])}`,
				)
				.join(", ");
			const result = `{${preview}}`;
			if (result.length > maxLen) return theme.dim(`{${keys.length} fields}`);
			return theme.dim(result);
		}
		return theme.dim(`{${keys.length} fields}`);
	}
	if (typeof val === "boolean") {
		return val ? theme.success("true") : theme.error("false");
	}
	if (typeof val === "number") {
		return theme.highlight(String(val));
	}
	// String - escape and truncate
	const escaped = String(val)
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t");
	if (escaped.length > maxLen) {
		return `${escaped.slice(0, maxLen - 3)}...`;
	}
	return escaped;
}

/**
 * Format a primitive value for inline preview (no colors, truncated)
 */
export function formatPrimitive(val: unknown): string {
	if (val === undefined || val === null) return "null";
	if (Array.isArray(val)) return `[${val.length}]`;
	if (typeof val === "object") {
		const str = String(val);
		if (str !== "[object Object]") {
			if (str.length > 15) return `${str.slice(0, 12)}...`;
			return str;
		}
		const keys = Object.keys(val);
		if (keys.length === 0) {
			try {
				const json = JSON.stringify(val);
				if (json.length > 15) return `${json.slice(0, 12)}...`;
				return json;
			} catch {
				return "{}";
			}
		}
		return `{${keys.length}}`;
	}
	if (typeof val === "string") {
		const escaped = val.replace(/\n/g, "\\n");
		if (escaped.length > 15) return `"${escaped.slice(0, 12)}..."`;
		return `"${escaped}"`;
	}
	return String(val);
}

/**
 * Parse a string value into appropriate type
 */
export function parseValue(input: string): unknown {
	if (!input) return "";

	// Try to parse as JSON first
	try {
		return JSON.parse(input);
	} catch {
		// Check for special values
		if (input === "true") return true;
		if (input === "false") return false;
		if (input === "null") return null;
		const num = Number(input);
		if (!Number.isNaN(num) && input.trim() !== "") return num;
		return input;
	}
}
