import type { RecordId } from "surrealdb";

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
	from?: string | RecordId<string>;
	/** If true, returns only the first record from the result set. */
	only?: boolean;
	/** The `WITH` clause for the query, specifying index usage. */
	with?: { indexes: string[] } | { noIndex: true };
	/** The `WHERE` clause for the query. */
	where?: string;
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
	/** An object of variables to bind to the query. */
	vars?: Record<string, unknown>;
}

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
