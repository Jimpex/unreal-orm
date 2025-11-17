import type { RecordId, Table, BoundQuery, Expr } from "surrealdb";

/**
 * Defines a single clause for an `ORDER BY` statement.
 * @example { field: 'name', order: 'ASC' }
 */
export interface OrderByClause {
	/** The field to order by. */
	field: string;
	/** The sort direction. */
	order?: "ASC" | "DESC" | "asc" | "desc";
	/** If true, performs string collation. */
	collate?: boolean;
	/** If true, performs numeric collation on string fields. */
	numeric?: boolean;
}

/**
 * Defines the options available for a `SELECT` query.
 * @template TTable The data shape of the table being queried.
 * @example
 * ```ts
 * // Find all active users, order by name, and fetch their posts
 * const activeUsers = await User.find({
 *   where: 'isActive = true',
 *   orderBy: [{ field: 'name', order: 'ASC' }],
 *   fetch: ['posts'],
 *   limit: 50
 * });
 * ```
 */
export interface SelectQueryOptions<TTable> {
	/** An array of fields to select. If omitted, all fields (`*`) are selected. */
	select?: (keyof TTable | string)[];
	/** The table or record ID to select from. Defaults to the model's table. */
	from?: Table | RecordId;
	/** If true, returns only the first record from the result set. */
	only?: boolean;
	/** The `WITH` clause for the query, specifying index usage. */
	with?: { indexes: string[] } | { noIndex: true };
	/** The `WHERE` clause for the query. Use surql templates or SurrealDB expressions for type-safe parameter binding. */
	where?: BoundQuery | Expr;
	/** An array of fields to split the results by. */
	split?: (keyof TTable | string)[];
	/** An array of fields to group the results by. */
	groupBy?: (keyof TTable | string)[];
	/** An array of `OrderByClause` objects to sort the results. */
	orderBy?: OrderByClause[];
	/** The maximum number of records to return. */
	limit?: number;
	/** The starting record number. */
	start?: number;
	/** An array of fields to fetch (expand related records). */
	fetch?: string[];
	/** The timeout for the query, specified in a duration string (e.g. "1m"). */
	timeout?: string;
	/** If true, runs the query in parallel with other queries. */
	parallel?: boolean;
	/** If true, enables temporary file usage for the query. */
	tempfiles?: boolean;
	/** If true, returns the query plan instead of the results. */
	explain?: boolean;
}

/**
 * Defines the update mode for SurrealDB 2.0 builder pattern.
 * Determines how the update operation will modify the record.
 */
export type UpdateMode = "content" | "merge" | "replace" | "patch";

/**
 * JSON Patch operation for patch mode (RFC 6902)
 */
export interface JsonPatchOperation {
	op: "add" | "remove" | "replace" | "move" | "copy" | "test";
	path: string;
	value?: unknown;
	from?: string;
}

/**
 * Defines the options available for an `UPDATE` query using SurrealDB 2.0 builder pattern.
 * @template TTable The data shape of the table being updated.
 * @example
 * ```ts
 * // Full content replacement (UPDATE)
 * await User.update(db, userId, {
 *   data: { name: 'John', age: 30 },
 *   mode: 'content'
 * });
 *
 * // Partial merge (MERGE/PATCH)
 * await User.update(db, userId, {
 *   data: { age: 31 },
 *   mode: 'merge'
 * });
 *
 * // JSON Patch operations
 * await User.update(db, userId, {
 *   data: [{ op: 'replace', path: '/age', value: 31 }],
 *   mode: 'patch'
 * });
 * ```
 */
export type StandardUpdateOptions<TTable> = {
	data: Partial<TTable>;
	mode: Exclude<UpdateMode, "patch">;
};

export type PatchUpdateOptions = {
	data: JsonPatchOperation[];
	mode: "patch";
};

export type UpdateOptions<TTable> =
	| StandardUpdateOptions<TTable>
	| PatchUpdateOptions;

export type UpdateOptionsForMode<
	TTable,
	TMode extends UpdateMode,
> = TMode extends "patch"
	? PatchUpdateOptions
	: StandardUpdateOptions<TTable> & {
			mode: Exclude<UpdateMode, "patch"> & TMode;
		};

/**
 * Defines the options available for a `COUNT` query.
 * @template TTable The data shape of the table being queried.
 * @example
 * ```ts
 * // Count all active users
 * const activeUserCount = await User.count({
 *   where: 'isActive = true'
 * });
 * ```
 */
export interface CountQueryOptions<TTable> {
	/** The `WHERE` clause to filter the records before counting. */
	where?: string;
	/** An array of fields to group the results by before counting. */
	groupBy?: (keyof TTable | string)[];
	/** If true, runs the query in parallel with other queries. */
	parallel?: boolean;
	/** The timeout for the query, specified in a duration string (e.g. "1m"). */
	timeout?: string;
}
