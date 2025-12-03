import type { Surreal, BoundQuery, Expr } from "surrealdb";
import { RecordId, surql } from "surrealdb";
import type {
	ModelStatic,
	InferShapeFromFields,
	ModelInstance,
	TableDefineOptions,
	SurrealLike,
} from "../types/model";
import type { SelectQueryOptions, OrderByClause } from "../types/query";
import type { FieldDefinition } from "../../field/types";
import { getDatabase, isSurrealLike } from "../../../config";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Builds the ORDER BY clause from OrderByClause objects.
 * Handles field, direction, collation, and numeric sorting options.
 * @param orderBy - Array of order by clause objects.
 * @returns Formatted ORDER BY clause string.
 * @internal
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
 * Builds the complete SurrealDB query string and bindings from query options.
 * Assembles all clauses in the correct order: SELECT, FROM, WITH, WHERE, SPLIT, GROUP BY, ORDER BY, LIMIT, START, FETCH, TIMEOUT, PARALLEL, TEMPFILES, EXPLAIN.
 * Returns raw query string and bindings to avoid BoundQuery module resolution issues.
 */
function buildQuery<TTable>(
	opts: SelectQueryOptions<TTable>,
	tableName: string,
): {
	queryString: string;
	bindings: Record<string, unknown>;
	isDirectIdQuery: boolean;
} {
	// Build the base SurrealQL string
	const onlyClause = opts.only ? " ONLY" : "";
	const selectFields =
		opts.select && opts.select.length > 0
			? (opts.select as string[]).join(", ")
			: "*";
	let sqlString = `SELECT ${selectFields} FROM${onlyClause}`;
	const bindings: Record<string, unknown> = {};
	let isDirectIdQuery = false;

	// Handle FROM clause - use type::table() for string table names to avoid module issues
	if (opts.from) {
		// Check if it's a RecordId-like object (has tb and id properties)
		if (
			opts.from &&
			typeof opts.from === "object" &&
			"tb" in opts.from &&
			"id" in opts.from
		) {
			// RecordId - bind directly
			isDirectIdQuery = true;
			const recordKey = `record_${Date.now()}`;
			sqlString += ` $${recordKey}`;
			bindings[recordKey] = opts.from;
		} else if (
			opts.from &&
			typeof opts.from === "object" &&
			"query" in opts.from &&
			"bindings" in opts.from
		) {
			// BoundQuery FROM clause - use directly
			const boundQuery = opts.from as {
				query: string;
				bindings: Record<string, unknown>;
			};
			sqlString += ` ${boundQuery.query}`;
			Object.assign(bindings, boundQuery.bindings);
		} else if (typeof opts.from === "string") {
			// String table name - use type::table()
			const tableKey = `table_${Date.now()}`;
			sqlString += ` type::table($${tableKey})`;
			bindings[tableKey] = opts.from;
		} else {
			// Other (Expr, etc.) - convert to BoundQuery using surql template
			const fromQuery = surql`${opts.from as Expr}`;
			sqlString += ` ${fromQuery.query}`;
			Object.assign(bindings, fromQuery.bindings);
		}
	} else {
		// Default: use the model's table name with type::table()
		const tableKey = `table_${Date.now()}`;
		sqlString += ` type::table($${tableKey})`;
		bindings[tableKey] = tableName;
	}

	// WITH clause (after FROM)
	if (opts.with) {
		if ("noIndex" in opts.with && opts.with.noIndex) {
			sqlString += " WITH NOINDEX";
		} else if ("indexes" in opts.with && opts.with.indexes.length > 0) {
			sqlString += ` WITH INDEX ${opts.with.indexes.join(", ")}`;
		}
	}

	// WHERE clause
	if (opts.where) {
		let whereQuery: BoundQuery;

		// Check if opts.where is an object before using 'in' operator
		if (
			opts.where &&
			typeof opts.where === "object" &&
			"query" in opts.where &&
			"bindings" in opts.where
		) {
			// BoundQuery where clause - use directly
			whereQuery = opts.where as BoundQuery;
		} else {
			// Expr where clause - convert to BoundQuery using surql template
			whereQuery = surql`${opts.where as Expr}`;
		}

		sqlString += ` WHERE ${whereQuery.query}`;
		// Merge WHERE bindings
		Object.assign(bindings, whereQuery.bindings);
		if (isDirectIdQuery) {
			console.warn(
				"[ORM WARNING] Applying WHERE clause to a direct RecordId query. This is unusual.",
			);
		}
	}

	// SPLIT clause (after WHERE)
	if (opts.split && opts.split.length > 0) {
		sqlString += ` SPLIT ${opts.split.join(", ")}`;
	}

	// GROUP BY clause
	if (opts.groupBy && opts.groupBy.length > 0) {
		sqlString += ` GROUP BY ${opts.groupBy.join(", ")}`;
	}

	// ORDER BY clause
	if (opts.orderBy && opts.orderBy.length > 0) {
		sqlString += ` ${buildOrderByClause(opts.orderBy)}`;
	}

	// LIMIT clause
	if (opts.limit !== undefined) {
		const limitKey = `limit_${Date.now()}`;
		sqlString += ` LIMIT $${limitKey}`;
		bindings[limitKey] = opts.limit;
	}

	// START clause
	if (opts.start !== undefined) {
		const startKey = `start_${Date.now()}`;
		sqlString += ` START $${startKey}`;
		bindings[startKey] = opts.start;
	}

	// FETCH clause
	if (opts.fetch && opts.fetch.length > 0) {
		sqlString += ` FETCH ${opts.fetch.join(", ")}`;
	}

	// TIMEOUT clause (after FETCH)
	if (opts.timeout) {
		sqlString += ` TIMEOUT ${opts.timeout}`;
	}

	// PARALLEL clause (after TIMEOUT)
	if (opts.parallel) {
		sqlString += " PARALLEL";
	}

	// TEMPFILES clause (after PARALLEL)
	if (opts.tempfiles) {
		sqlString += " TEMPFILES";
	}

	// EXPLAIN clause (after TEMPFILES)
	if (opts.explain) {
		sqlString += " EXPLAIN";
	}

	// Return raw query string and bindings to avoid BoundQuery module resolution issues
	return { queryString: sqlString, bindings, isDirectIdQuery };
}

/**
 * Executes a SurrealDB query and processes the results.
 * Returns either raw data (for projections/grouping) or hydrated model instances.
 * Uses string query with bindings to avoid BoundQuery module resolution issues.
 */
async function executeAndProcessQuery<T, ModelInstanceType, TTable>(
	db: SurrealLike,
	queryString: string,
	bindings: Record<string, unknown>,
	opts: SelectQueryOptions<TTable>,
	ModelClass: new (data: T) => ModelInstanceType,
): Promise<unknown> {
	const shouldReturnRawData =
		!!opts.groupBy || !!opts.select || !!opts.explain || !!opts.split;

	// Use string query with bindings, then collect results
	const queryBuilder = (db as unknown as Surreal).query(queryString, bindings);
	const result = (await queryBuilder.collect()) as unknown as unknown[];

	if (opts.only) {
		// Single record query with ONLY - returns single object, not array
		// Result structure: [singleRecord] where singleRecord is the object directly
		const queryResult = result[0] as T | undefined;
		return shouldReturnRawData
			? queryResult
			: queryResult && new ModelClass(queryResult);
	}

	// Multiple records query - returns array of records
	// Result structure: [recordsArray] where recordsArray is T[]
	const queryResults = result[0] as T[] | undefined;

	return shouldReturnRawData
		? queryResults
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
 * Supports two calling patterns:
 * - `User.select(db, options)` - explicit database instance
 * - `User.select(options)` - uses configured default database
 *
 * @example
 * ```ts
 * // Basic select all (with configured db)
 * const users = await User.select();
 *
 * // Basic select all (with explicit db)
 * const users = await User.select(db);
 *
 * // Find by ID (returns a single instance or undefined)
 * const user = await User.select({ from: 'user:1', only: true });
 *
 * // Simple filtering
 * const activeUsers = await User.select({ where: surql`isActive = true` });
 *
 * // Parameterized filtering
 * const youngUsers = await User.select({
 *   where: surql`age < $maxAge`,
 *   vars: { maxAge: 30 }
 * });
 *
 * // Sorting and pagination
 * const sortedUsers = await User.select({
 *   orderBy: [{ field: 'name', order: 'ASC' }],
 *   limit: 10,
 *   start: 20
 * });
 *
 * // Fetching related records
 * const usersWithPosts = await User.select({ fetch: ['posts'] });
 *
 * // Custom projection (returns raw data, not model instances)
 * const userNames = await User.select({ select: ['name'] });
 *
 * // With explicit db (always works)
 * const users = await User.select(db, { limit: 10 });
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
		dbOrOptions?:
			| SurrealLike
			| SelectQueryOptions<InferShapeFromFields<(typeof this)["_fields"]>>,
		maybeOptions?: SelectQueryOptions<
			InferShapeFromFields<(typeof this)["_fields"]>
		>,
	): Promise<unknown> {
		// Resolve db and options based on calling pattern
		let db: SurrealLike;
		let opts: SelectQueryOptions<
			InferShapeFromFields<(typeof this)["_fields"]>
		>;

		if (isSurrealLike(dbOrOptions)) {
			// Pattern: select(db, options?)
			db = dbOrOptions;
			opts = maybeOptions || {};
		} else {
			// Pattern: select(options?) - use configured default
			db = await getDatabase();
			opts = dbOrOptions || {};
		}

		const tableName = this.getTableName();

		// Build the complete query string and bindings
		const { queryString, bindings } = buildQuery(opts, tableName);

		// Execute query and process results
		return executeAndProcessQuery<
			InferShapeFromFields<(typeof this)["_fields"]>,
			InstanceType<typeof this>,
			InferShapeFromFields<(typeof this)["_fields"]>
		>(db, queryString, bindings, opts, this);
	};
}
