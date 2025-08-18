import type { Surreal } from "surrealdb";
import { RecordId } from "surrealdb";
import type {
	ModelStatic,
	InferShapeFromFields,
	ModelInstance,
	TableDefineOptions,
} from "../types/model";
import type { SelectQueryOptions, OrderByClause } from "../types/query";
import type { FieldDefinition } from "../../field/types";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Builds the SELECT and FROM clauses of a SurrealDB query.
 * Handles RecordId binding, ONLY clause, and field selection.
 */
function buildSelectFromClause<TTable>(
	opts: SelectQueryOptions<TTable>,
	tableName: string,
	bindings: Record<string, unknown>,
): { selectFromClause: string; isDirectIdQuery: boolean } {
	const selectFields =
		opts.select && opts.select.length > 0
			? (opts.select as string[]).join(", ")
			: "*";

	let fromClause: string;
	let isDirectIdQuery = false;

	if (opts.from) {
		if (opts.from instanceof RecordId) {
			bindings.fromIdBinding = opts.from;
			fromClause = "$fromIdBinding";
			isDirectIdQuery = true;
		} else {
			fromClause = opts.from;
		}
	} else {
		fromClause = tableName;
	}

	const selectFromClause = `SELECT ${selectFields} FROM${opts.only ? " ONLY" : ""} ${fromClause}`;
	return { selectFromClause, isDirectIdQuery };
}

/**
 * Builds the ORDER BY clause from OrderByClause objects.
 * Handles field, direction, collation, and numeric sorting options.
 */
function buildOrderByClause(orderBy: OrderByClause[]): string {
	const orderByClauses = orderBy.map((ob) => {
		let clause = String(ob.field);
		if (ob.collate) clause += " COLLATE";
		if (ob.numeric) clause += " NUMERIC";
		if (ob.order) clause += ` ${ob.order.toUpperCase()}`;
		return clause;
	});
	return `ORDER BY ${orderByClauses.join(", ")}`;
}

/**
 * Builds the complete SurrealDB query string from query options.
 * Assembles all clauses in the correct order: SELECT, FROM, WITH, WHERE, SPLIT, GROUP BY, ORDER BY, LIMIT, START, FETCH, TIMEOUT, PARALLEL, TEMPFILES, EXPLAIN.
 */
function buildQuery<TTable>(
	opts: SelectQueryOptions<TTable>,
	tableName: string,
	bindings: Record<string, unknown>,
): { query: string; isDirectIdQuery: boolean } {
	const queryParts: string[] = [];

	// SELECT and FROM clauses
	const { selectFromClause, isDirectIdQuery } = buildSelectFromClause(
		opts,
		tableName,
		bindings,
	);
	queryParts.push(selectFromClause);

	// WITH clause (after FROM)
	if (opts.with) {
		if ("noIndex" in opts.with && opts.with.noIndex) {
			queryParts.push("WITH NOINDEX");
		} else if ("indexes" in opts.with && opts.with.indexes.length > 0) {
			queryParts.push(`WITH INDEX ${opts.with.indexes.join(", ")}`);
		}
	}

	// WHERE clause
	if (opts.where) {
		queryParts.push(`WHERE ${opts.where}`);
		if (isDirectIdQuery) {
			console.warn(
				"[ORM WARNING] Applying WHERE clause to a direct RecordId query. This is unusual.",
			);
		}
	}

	// SPLIT clause (after WHERE)
	if (opts.split && opts.split.length > 0) {
		queryParts.push(`SPLIT ${opts.split.join(", ")}`);
	}

	// GROUP BY clause
	if (opts.groupBy && opts.groupBy.length > 0) {
		queryParts.push(`GROUP BY ${opts.groupBy.join(", ")}`);
	}

	// ORDER BY clause
	if (opts.orderBy && opts.orderBy.length > 0) {
		queryParts.push(buildOrderByClause(opts.orderBy));
	}

	// LIMIT clause
	if (opts.limit !== undefined) {
		queryParts.push(`LIMIT ${opts.limit}`);
	}

	// START clause
	if (opts.start !== undefined) {
		queryParts.push(`START ${opts.start}`);
	}

	// FETCH clause
	if (opts.fetch && opts.fetch.length > 0) {
		queryParts.push(`FETCH ${opts.fetch.join(", ")}`);
	}

	// TIMEOUT clause (after FETCH)
	if (opts.timeout) {
		queryParts.push(`TIMEOUT ${opts.timeout}`);
	}

	// PARALLEL clause (after TIMEOUT)
	if (opts.parallel) {
		queryParts.push("PARALLEL");
	}

	// TEMPFILES clause (after PARALLEL)
	if (opts.tempfiles) {
		queryParts.push("TEMPFILES");
	}

	// EXPLAIN clause (after TEMPFILES)
	if (opts.explain) {
		queryParts.push("EXPLAIN");
	}

	return { query: queryParts.join(" "), isDirectIdQuery };
}

/**
 * Executes a SurrealDB query and processes the results.
 * Returns either raw data (for projections/grouping) or hydrated model instances.
 */
async function executeAndProcessQuery<T, ModelInstanceType, TTable>(
	db: Surreal,
	query: string,
	bindings: Record<string, unknown>,
	opts: SelectQueryOptions<TTable>,
	ModelClass: new (data: T) => ModelInstanceType,
): Promise<unknown> {
	// console.debug(
	// 	`[ORM DEBUG] Executing query: "${query}" with bindings:`,
	// 	JSON.parse(JSON.stringify(bindings)),
	// );

	const shouldReturnRawData =
		!!opts.groupBy || !!opts.select || !!opts.explain || !!opts.split;

	if (opts.only) {
		// Single record query
		const [queryResult] = await db.query<T[]>(query, bindings);
		return shouldReturnRawData
			? (queryResult as T)
			: queryResult && new ModelClass(queryResult);
	}

	// Multiple records query
	const [queryResults] = await db.query<T[][]>(query, bindings);
	// console.debug("[ORM DEBUG] Query completed, processing results:", {
	// 	resultCount: queryResults?.length,
	// 	shouldReturnRawData,
	// 	hasGroupBy: !!opts.groupBy,
	// 	hasFetch: !!opts.fetch,
	// });

	return shouldReturnRawData
		? (queryResults as T[])
		: queryResults?.map((r) => new ModelClass(r));
}

// ============================================================================
// MAIN FACTORY FUNCTION
// ============================================================================

/**
 * A factory function that generates the static `select` method for a model class.
 * This versatile method handles querying for records with options for filtering, sorting, pagination, and more.
 * It can return either hydrated model instances or raw query results, depending on the options provided.
 *
 * @example
 * ```ts
 * // Basic select all
 * const users = await User.select(db);
 *
 * // Find by ID (returns a single instance or undefined)
 * const user = await User.select(db, { from: 'user:1', only: true });
 *
 * // Simple filtering
 * const activeUsers = await User.select(db, { where: 'isActive = true' });
 *
 * // Parameterized filtering
 * const youngUsers = await User.select(db, {
 *   where: 'age < $maxAge',
 *   vars: { maxAge: 30 }
 * });
 *
 * // Sorting and pagination
 * const sortedUsers = await User.select(db, {
 *   orderBy: [{ field: 'name', order: 'ASC' }],
 *   limit: 10,
 *   start: 20
 * });
 *
 * // Fetching related records
 * const usersWithPosts = await User.select(db, { fetch: ['posts'] });
 *
 * // Custom projection (returns raw data, not model instances)
 * const userNames = await User.select(db, { select: ['name'] });
 * ```
 *
 * @returns The static `select` method implementation.
 * @internal
 */
export function getSelectMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	return async function select<T extends Record<string, unknown>>(
		this: ModelStatic<
			ModelInstance<InferShapeFromFields<TFields>>,
			TFields,
			TableDefineOptions<TFields>
		>,
		db: Surreal,
		options?: SelectQueryOptions<
			InferShapeFromFields<(typeof this)["_fields"]>
		>,
	): Promise<unknown> {
		const opts = options || {};
		const tableName = this.getTableName();
		const bindings: Record<string, unknown> = opts.vars || {};

		// Build the complete query
		const { query } = buildQuery(opts, tableName, bindings);

		// Execute query and process results
		return executeAndProcessQuery<
			InferShapeFromFields<(typeof this)["_fields"]>,
			InstanceType<typeof this>,
			InferShapeFromFields<(typeof this)["_fields"]>
		>(db, query, bindings, opts, this);
	};
}
