import type { SurrealLike } from "../define/table/types/model";

/**
 * Type guard to check if a value is a SurrealDB-like connection object.
 * Used internally to distinguish between explicit `db` arguments and user options.
 *
 * @param value - Value to check.
 * @returns `true` if the value looks like a SurrealDB connection.
 * @internal
 */
export function isSurrealLike(value: unknown): value is SurrealLike {
	if (!value || typeof value !== "object") {
		return false;
	}

	const obj = value as Record<string, unknown>;

	return (
		typeof obj.query === "function" &&
		typeof obj.select === "function" &&
		typeof obj.create === "function" &&
		typeof obj.update === "function" &&
		typeof obj.delete === "function"
	);
}

/**
 * Validates that a value is a usable SurrealDB connection.
 * Throws a clear error when a model method is called without `db`.
 *
 * @param db - The value to validate.
 * @throws Error if `db` is missing or not a SurrealDB-like object.
 * @internal
 */
export function validateDb(db: unknown): asserts db is SurrealLike {
	if (!isSurrealLike(db)) {
		throw new Error(
			"db is required. Pass a SurrealDB connection or transaction as the first argument.",
		);
	}
}
