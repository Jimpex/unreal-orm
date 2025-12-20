import type { RecordId, Table, BoundQuery, Expr } from "surrealdb";
import type { FieldDefinition } from "../../field/types";
import type { SelectOption, OmitSelect, TypedExpr } from "./select";

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
 *
 * @template TTable The data shape of the table being queried.
 * @template TFields The field definitions of the table (for type-safe select).
 *
 * @example
 * ```ts
 * // Type-safe field selection
 * const posts = await Post.select({
 *   select: {
 *     title: true,
 *     author: { name: true, email: true },
 *   },
 * });
 * // Type: { title: string; author: { name: string; email: string } }[]
 *
 * // With custom computed field
 * const posts = await Post.select({
 *   select: {
 *     title: true,
 *     commentCount: typed<number>(surql`count(<-comment)`),
 *   },
 * });
 *
 * // String array (pass-through)
 * const posts = await Post.select({
 *   select: ['title', 'author.name'],
 * });
 *
 * // Raw SurrealQL
 * const posts = await Post.select({
 *   select: surql`title, count(<-comment) AS commentCount`,
 * });
 * ```
 */
export interface SelectQueryOptions<
	TTable,
	TFields extends Record<string, FieldDefinition<unknown>> = Record<
		string,
		FieldDefinition<unknown>
	>,
> {
	/**
	 * Fields to select. Supports multiple formats:
	 * - Object: Type-safe field selection with nested support
	 * - String array: Pass-through field names
	 * - BoundQuery/Expr: Raw SurrealQL
	 *
	 * If omitted, all fields (`*`) are selected.
	 */
	select?: SelectOption<TFields>;

	/**
	 * Fields to omit from the result (native OMIT clause).
	 * Cannot be used together with `select`.
	 *
	 * Supports two formats:
	 * - Object: Type-safe `{ field: true }` format with inferred return type
	 * - String array: Pass-through field names (less type-safe)
	 *
	 * @example
	 * ```ts
	 * // Type-safe omit (recommended)
	 * const users = await User.select({ omit: { password: true } });
	 * // → SELECT * OMIT password FROM user
	 * // Type: Omit<User, 'password'>[]
	 *
	 * // String array (less type-safe)
	 * const users = await User.select({ omit: ['password'] });
	 * // → SELECT * OMIT password FROM user
	 * ```
	 */
	omit?: OmitSelect<TFields> | string[];

	/**
	 * Select a single field's values (native SELECT VALUE).
	 * Returns an array of values instead of objects.
	 * Cannot be used together with `select`.
	 *
	 * @example
	 * ```ts
	 * const names = await User.select({ value: 'name' });
	 * // → SELECT VALUE name FROM user
	 * // Type: string[]
	 * ```
	 */
	value?: string;

	/** The table or record ID to select from. Defaults to the model's table. Supports Table, RecordId, BoundQuery, or raw Expr for advanced use cases. */
	from?: Table | RecordId | BoundQuery | Expr;
	/** If true, returns only the first record from the result set. */
	only?: boolean;
	/** The `WITH` clause for the query, specifying index usage. */
	with?: { indexes: string[] } | { noIndex: true };
	/** The `WHERE` clause for the query. Use surql templates or SurrealDB expressions for type-safe parameter binding. */
	where?: BoundQuery | Expr;
	/** An array of fields to split the results by. */
	split?: string[];
	/** An array of fields to group the results by. */
	groupBy?: string[];
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
 *   where: surql`isActive = true`
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

// ============================================================================
// INSERT QUERY OPTIONS
// ============================================================================

/**
 * Extends the table data type with an optional `id` field for INSERT operations.
 * This allows specifying a custom record ID when inserting data.
 *
 * @template TData The base data type (typically CreateData<TFields>).
 *
 * @example
 * ```ts
 * // InsertData allows specifying id even if not in the schema
 * await User.insert({
 *   data: { id: 'user:123', name: 'John', email: 'john@example.com' },
 * });
 * ```
 */
export type InsertData<TData> = TData & { id?: RecordId };

/**
 * Defines the RETURN clause options for INSERT/UPDATE statements.
 * - `"NONE"` - Return nothing
 * - `"BEFORE"` - Return the record before the operation (for INSERT, same as NONE)
 * - `"AFTER"` - Return the record after the operation (default)
 * - `"DIFF"` - Return the changeset diff
 * - `string[]` - Return specific fields
 * - `{ value: string }` - Return VALUE of a single field
 * - `BoundQuery` - Native SurrealQL expression (e.g., `surql`id, name, count(<-comment)``)`
 * - `Expr` - SurrealDB expression
 */
export type ReturnType =
	| "NONE"
	| "none"
	| "BEFORE"
	| "before"
	| "AFTER"
	| "after"
	| "DIFF"
	| "diff"
	| string[]
	| { value: string }
	| BoundQuery
	| Expr;

/**
 * Defines the options available for an `INSERT` query.
 *
 * @template TTable The data shape of the table being inserted into.
 * @template TData The type of data to insert (single object or array).
 *
 * @example
 * ```ts
 * // Single insert
 * const user = await User.insert({
 *   data: { name: 'John', email: 'john@example.com' },
 * });
 *
 * // Bulk insert
 * const users = await User.insert({
 *   data: [
 *     { name: 'John', email: 'john@example.com' },
 *     { name: 'Jane', email: 'jane@example.com' },
 *   ],
 * });
 *
 * // With IGNORE (skip duplicates silently)
 * const users = await User.insert({
 *   data: { name: 'John', email: 'john@example.com' },
 *   ignore: true,
 * });
 *
 * // With ON DUPLICATE KEY UPDATE
 * const users = await User.insert({
 *   data: { name: 'John', email: 'john@example.com' },
 *   onDuplicate: surql`visits += 1`,
 * });
 *
 * // With custom RETURN clause
 * const names = await User.insert({
 *   data: { name: 'John', email: 'john@example.com' },
 *   return: { value: 'name' },
 * });
 * ```
 */
export interface InsertQueryOptions<TTable, TData = TTable | TTable[]> {
	/**
	 * The data to insert. Can be a single object or an array of objects.
	 * Optionally includes an `id` field for specifying custom record IDs.
	 *
	 * @example
	 * ```ts
	 * // Single record
	 * { data: { name: 'John', email: 'john@example.com' } }
	 *
	 * // With custom ID
	 * { data: { id: 'user:john', name: 'John', email: 'john@example.com' } }
	 *
	 * // Multiple records
	 * { data: [
	 *   { name: 'John', email: 'john@example.com' },
	 *   { name: 'Jane', email: 'jane@example.com' },
	 * ]}
	 * ```
	 */
	data: TData extends unknown[]
		? (TData[number] & { id?: RecordId })[]
		: TData & { id?: RecordId };

	/**
	 * If true, uses INSERT RELATION syntax for relation tables.
	 * Automatically set for relation tables defined with Table.relation().
	 */
	relation?: boolean;

	/**
	 * If true, silently ignores duplicate record IDs instead of throwing an error.
	 * Equivalent to `INSERT IGNORE INTO`.
	 *
	 * @example
	 * ```ts
	 * // Will not throw error if user:123 already exists
	 * await User.insert({
	 *   data: { id: 'user:123', name: 'John' },
	 *   ignore: true,
	 * });
	 * ```
	 */
	ignore?: boolean;

	/**
	 * Specifies what to return from the INSERT operation.
	 *
	 * @example
	 * ```ts
	 * // Return nothing
	 * await User.insert({ data, return: 'NONE' });
	 *
	 * // Return specific fields
	 * await User.insert({ data, return: ['id', 'name'] });
	 *
	 * // Return single field value
	 * const names = await User.insert({ data, return: { value: 'name' } });
	 * ```
	 */
	return?: ReturnType;

	/**
	 * Specifies how to update existing records when a duplicate ID or unique index
	 * violation occurs. Can be:
	 * - Object: `{ field: value }` pairs to update
	 * - BoundQuery: Raw SurrealQL for complex updates
	 *
	 * Use `$input.field` to reference the attempted insert data.
	 *
	 * @example
	 * ```ts
	 * // Simple field updates
	 * await User.insert({
	 *   data: { name: 'John', email: 'john@example.com' },
	 *   onDuplicate: { updatedAt: new Date() },
	 * });
	 *
	 * // Increment/decrement with raw query
	 * await User.insert({
	 *   data: { name: 'John', email: 'john@example.com' },
	 *   onDuplicate: surql`visits += 1, lastSeen = time::now()`,
	 * });
	 *
	 * // Reference input data
	 * await User.insert({
	 *   data: { name: 'John', email: 'john@example.com' },
	 *   onDuplicate: surql`name = $input.name, updatedAt = time::now()`,
	 * });
	 * ```
	 */
	onDuplicate?: Partial<TTable> | BoundQuery | Expr;
}
