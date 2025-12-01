/**
 * Type-safe wrappers for SurrealDB query results.
 * These types provide structure for the INFO FOR DB/TABLE queries.
 */

export interface QueryResult<T = unknown> {
	status: "OK" | "ERR";
	result?: T;
	detail?: string;
}

export interface DBInfo {
	tables: Record<string, string>;
	accesses?: Record<string, string>;
	analyzers?: Record<string, string>;
	apis?: Record<string, string>;
	buckets?: Record<string, string>;
	configs?: Record<string, string>;
	functions?: Record<string, string>;
	models?: Record<string, string>;
	modules?: Record<string, string>;
	params?: Record<string, string>;
	sequences?: Record<string, string>;
	scopes?: Record<string, string>;
	tokens?: Record<string, string>;
	users?: Record<string, string>;
}

export interface TableInfo {
	fields: Record<string, string>;
	indexes: Record<string, string>;
	events: Record<string, string>;
	tables?: Record<string, string>;
	lives?: Record<string, string>;
}

/**
 * Helper to safely extract query result with type checking.
 */
export function extractQueryResult<T>(
	results: unknown,
	index = 0,
): QueryResult<T> {
	if (!Array.isArray(results) || !results[index]) {
		throw new Error("Invalid query results structure");
	}
	return results[index] as QueryResult<T>;
}

/**
 * Helper to validate and extract successful query result.
 * The SDK's .collect() returns data directly, not wrapped in QueryResult.
 */
export function extractSuccessResult<T>(
	result: unknown,
	errorMessage: string,
): T {
	if (!result) {
		throw new Error(`${errorMessage}: No data returned`);
	}

	return result as T;
}
