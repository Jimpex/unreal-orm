import type {
	BoundQuery,
	Expr,
	RecordId,
	RecordIdValue,
	Surreal,
} from "surrealdb";
import {
	BoundIncluded,
	RecordIdRange,
	StringRecordId,
	surql,
	toSurrealqlString,
} from "surrealdb";
import type { FieldProxy } from "../../../query/field-proxy";
import { createFieldProxy } from "../../../query/field-proxy";
import { validateDb } from "../../../utils/validate-db";
import type { FieldDefinition } from "../../field/types";
import type {
	InferShapeFromFields,
	ModelInstance,
	ModelStatic,
	SurrealLike,
	TableDefineOptions,
} from "../types/model";
import type { OrderByClause, SelectQueryOptions } from "../types/query";
import type {
	FieldSelect,
	InferOmitResult,
	InferSelectResult,
	OmitSelect,
	TypedExpr,
} from "../types/select";

/**
 * Global counter for unique binding keys to avoid collisions within a single query.
 * @internal
 */
let queryBindingCounter = 0;
function getUniqueKey(prefix: string): string {
	return `${prefix}_${queryBindingCounter++}`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Checks if a value is a TypedExpr (custom computed field).
 * @internal
 */
function isTypedExpr(value: unknown): value is TypedExpr<unknown> {
	return (
		value !== null &&
		typeof value === "object" &&
		"expr" in value &&
		value.expr !== undefined
	);
}

/**
 * Checks if a value is a BoundQuery.
 * @internal
 */
function isBoundQuery(value: unknown): value is BoundQuery {
	return (
		value !== null &&
		typeof value === "object" &&
		"query" in value &&
		"bindings" in value
	);
}

/**
 * Checks if a value is an Expr (has toJSON method but not query/bindings).
 * @internal
 */
function isExpr(value: unknown): value is Expr {
	return (
		value !== null &&
		typeof value === "object" &&
		!isBoundQuery(value) &&
		!isTypedExpr(value) &&
		!Array.isArray(value)
	);
}

/**
 * Transforms a FieldSelect object into SurrealQL SELECT fields.
 * Handles nested objects, records, and custom TypedExpr fields.
 *
 * @param select - The FieldSelect object
 * @param prefix - Optional prefix for nested fields (e.g., "author")
 * @returns Object with fields array and bindings
 * @internal
 *
 * @example
 * ```ts
 * // { title: true, author: { name: true } }
 * // → ["title", "author.{name}"]
 *
 * // { '*': true, commentCount: typed<number>(surql`count(<-comment)`) }
 * // → ["*", "count(<-comment) AS commentCount"]
 * ```
 */
function buildSelectFields(
	select: Record<string, unknown>,
	prefix = "",
): { fields: string[]; bindings: Record<string, unknown> } {
	const fields: string[] = [];
	const bindings: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(select)) {
		if (value === undefined) continue;

		const fieldPath = prefix ? `${prefix}.${key}` : key;

		if (key === "*") {
			// Select all fields
			fields.push(prefix ? `${prefix}.*` : "*");
		} else if (value === true) {
			// Select this field (or all of nested record/object)
			fields.push(fieldPath);
		} else if (isTypedExpr(value)) {
			// Custom computed field with TypedExpr
			const expr = value.expr;
			if (isBoundQuery(expr)) {
				fields.push(`${expr.query} AS ${key}`);
				Object.assign(bindings, expr.bindings);
			} else {
				// Convert Expr to BoundQuery
				const boundExpr = surql`${expr as Expr}`;
				fields.push(`${boundExpr.query} AS ${key}`);
				Object.assign(bindings, boundExpr.bindings);
			}
		} else if (typeof value === "object" && value !== null) {
			// Nested object selection - use destructuring syntax
			const nestedResult = buildSelectFields(
				value as Record<string, unknown>,
				"",
			);

			// Check if it's just simple field selections (all true values)
			const nestedKeys = Object.keys(value);
			const allSimple = nestedKeys.every(
				(k) => (value as Record<string, unknown>)[k] === true && k !== "*",
			);

			if (allSimple && nestedKeys.length > 0) {
				// Use SurrealDB destructuring syntax: field.{a, b, c}
				fields.push(`${fieldPath}.{${nestedKeys.join(", ")}}`);
			} else {
				// Complex nested - prefix each field
				for (const nestedField of nestedResult.fields) {
					if (nestedField.includes(" AS ")) {
						// Computed field - keep as is but update alias
						fields.push(nestedField);
					} else if (nestedField === "*") {
						fields.push(`${fieldPath}.*`);
					} else {
						fields.push(`${fieldPath}.${nestedField}`);
					}
				}
				Object.assign(bindings, nestedResult.bindings);
			}
		}
	}

	return { fields, bindings };
}

/**
 * Builds the ORDER BY clause from OrderByClause objects.
 * Handles field (string or Expr/BoundQuery), direction, collation, and numeric sorting options.
 * @param orderBy - Array of order by clause objects.
 * @param bindings - Bindings object to merge any BoundQuery bindings into.
 * @returns Formatted ORDER BY clause string.
 * @internal
 */
function buildOrderByClause(
	orderBy: OrderByClause[],
	bindings: Record<string, unknown>,
): string {
	const orderByClauses = orderBy.map((ob) => {
		let clause: string;
		if (typeof ob.field === "string") {
			clause = ob.field;
		} else if (isBoundQuery(ob.field)) {
			clause = ob.field.query;
			Object.assign(bindings, ob.field.bindings);
		} else {
			// Expr — convert to BoundQuery
			const bound = surql`${ob.field as Expr}`;
			clause = bound.query;
			Object.assign(bindings, bound.bindings);
		}
		if (ob.collate) clause += " COLLATE";
		if (ob.numeric) clause += " NUMERIC";
		if (ob.order) clause += ` ${ob.order.toUpperCase()}`;
		return clause;
	});
	return `ORDER BY ${orderByClauses.join(", ")}`;
}

/**
 * Builds the SELECT clause from the various select option formats.
 * @returns Object with selectClause string and any bindings from computed fields.
 * @internal
 */
function buildSelectClause<
	TTable,
	TFields extends Record<string, FieldDefinition<unknown>> = Record<
		string,
		FieldDefinition<unknown>
	>,
>(
	opts: SelectQueryOptions<TTable, TFields>,
): {
	selectClause: string;
	selectBindings: Record<string, unknown>;
} {
	// Handle value option (SELECT VALUE)
	if (opts.value) {
		return { selectClause: `VALUE ${String(opts.value)}`, selectBindings: {} };
	}

	// Handle omit option (SELECT * OMIT)
	if (opts.omit) {
		let omitFields: string;
		if (Array.isArray(opts.omit)) {
			// String array format
			if (opts.omit.length === 0) {
				return { selectClause: "*", selectBindings: {} };
			}
			omitFields = opts.omit.join(", ");
		} else {
			// Object format: { field: true }
			const fields = Object.entries(opts.omit)
				.filter(([, v]) => v === true)
				.map(([k]) => k);
			if (fields.length === 0) {
				return { selectClause: "*", selectBindings: {} };
			}
			omitFields = fields.join(", ");
		}
		return { selectClause: `* OMIT ${omitFields}`, selectBindings: {} };
	}

	// No select option - select all
	if (!opts.select) {
		return { selectClause: "*", selectBindings: {} };
	}

	// String array - pass through
	if (Array.isArray(opts.select)) {
		return {
			selectClause: opts.select.length > 0 ? opts.select.join(", ") : "*",
			selectBindings: {},
		};
	}

	// BoundQuery - raw SurrealQL (has query and bindings properties)
	if (isBoundQuery(opts.select)) {
		return {
			selectClause: opts.select.query,
			selectBindings: opts.select.bindings,
		};
	}

	// Object (FieldSelect) - build from object
	// Check this BEFORE Expr since plain objects would match isExpr
	if (typeof opts.select === "object" && opts.select !== null) {
		// Check if it looks like a FieldSelect (has keys that are true, objects, or TypedExpr)
		const keys = Object.keys(opts.select);
		const firstKey = keys[0];
		if (keys.length > 0 && firstKey !== undefined) {
			const firstValue = (opts.select as Record<string, unknown>)[firstKey];
			// If first value is true, an object, or a TypedExpr, treat as FieldSelect
			if (
				firstValue === true ||
				(typeof firstValue === "object" && firstValue !== null)
			) {
				const { fields, bindings } = buildSelectFields(
					opts.select as Record<string, unknown>,
				);
				return {
					selectClause: fields.length > 0 ? fields.join(", ") : "*",
					selectBindings: bindings,
				};
			}
		}
	}

	// Expr - convert to BoundQuery (fallback for Expr objects)
	const boundExpr = surql`${opts.select as Expr}`;
	return {
		selectClause: boundExpr.query,
		selectBindings: boundExpr.bindings,
	};
}

/**
 * Builds the complete SurrealDB query string and bindings from query options.
 * Assembles all clauses in the correct order: SELECT, FROM, WITH, WHERE, SPLIT, GROUP BY, ORDER BY, LIMIT, START, FETCH, TIMEOUT, PARALLEL, TEMPFILES, EXPLAIN.
 * Returns raw query string and bindings to avoid BoundQuery module resolution issues.
 */
function buildQuery<
	TTable,
	TFields extends Record<string, FieldDefinition<unknown>> = Record<
		string,
		FieldDefinition<unknown>
	>,
>(
	opts: SelectQueryOptions<TTable, TFields>,
	tableName: string,
): {
	queryString: string;
	bindings: Record<string, unknown>;
	isDirectIdQuery: boolean;
} {
	// Build the SELECT clause
	const { selectClause, selectBindings } = buildSelectClause(opts);
	const onlyClause = opts.only ? " ONLY" : "";
	let sqlString = `SELECT ${selectClause} FROM${onlyClause}`;
	const bindings: Record<string, unknown> = { ...selectBindings };
	let isDirectIdQuery = false;

	// Handle FROM clause - use type::table() for string table names to avoid module issues
	if (opts.from) {
		// Check if it's a RecordId-like object (has table and id properties)
		if (
			opts.from &&
			typeof opts.from === "object" &&
			!Array.isArray(opts.from) &&
			!("range" in opts.from) &&
			!("query" in opts.from) &&
			"table" in opts.from &&
			"id" in opts.from
		) {
			// RecordId - bind directly
			isDirectIdQuery = true;
			const recordKey = getUniqueKey("record");
			sqlString += ` $${recordKey}`;
			bindings[recordKey] = opts.from;
		} else if (
			opts.from &&
			typeof opts.from === "object" &&
			Array.isArray(opts.from) &&
			opts.from.length > 0 &&
			opts.from[0] != null &&
			"table" in opts.from[0]
		) {
			// RecordId[] — select multiple records by ID (no table scan)
			// SurrealDB syntax: FROM [$r1, $r2, ...]
			isDirectIdQuery = true;
			const ids = opts.from as RecordId[];
			const keys: string[] = [];
			for (const rid of ids) {
				const key = getUniqueKey("record");
				keys.push(`$${key}`);
				bindings[key] = rid;
			}
			sqlString += ` [${keys.join(", ")}]`;
		} else if (
			opts.from instanceof RecordIdRange ||
			opts.from instanceof StringRecordId
		) {
			// RecordIdRange or StringRecordId from Range/RangeId builders
			isDirectIdQuery = true;
			sqlString += ` ${toSurrealqlString(opts.from)}`;
		} else if (
			opts.from &&
			typeof opts.from === "object" &&
			!Array.isArray(opts.from) &&
			"range" in opts.from &&
			Array.isArray((opts.from as { range: unknown }).range)
		) {
			// { range: [startId, endId] } — record ID range (table:start..end)
			isDirectIdQuery = true;
			const range = (opts.from as { range: [RecordId, RecordId] }).range;
			const startRid = range[0];
			const endRid = range[1];
			const idRange = new RecordIdRange(
				startRid.table,
				new BoundIncluded(startRid.id as RecordIdValue),
				new BoundIncluded(endRid.id as RecordIdValue),
			);
			sqlString += ` ${toSurrealqlString(idRange)}`;
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
			const tableKey = getUniqueKey("table");
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
		const tableKey = getUniqueKey("table");
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
		sqlString += ` ${buildOrderByClause(opts.orderBy, bindings)}`;
	}

	// SurrealDB in-memory has a known issue where LIMIT/START is applied
	// before ORDER BY, so we wrap ORDER BY queries with pagination in a subquery.
	const needsSubquery =
		opts.orderBy &&
		opts.orderBy.length > 0 &&
		(opts.limit !== undefined || opts.start !== undefined) &&
		!opts.value &&
		!opts.only &&
		!opts.explain;

	if (needsSubquery) {
		const innerSql = sqlString;
		let outerSql = `SELECT * FROM (${innerSql})`;

		if (opts.limit !== undefined) {
			const limitKey = getUniqueKey("limit");
			outerSql += ` LIMIT $${limitKey}`;
			bindings[limitKey] = opts.limit;
		}

		if (opts.start !== undefined) {
			const startKey = getUniqueKey("start");
			outerSql += ` START $${startKey}`;
			bindings[startKey] = opts.start;
		}

		if (opts.fetch && opts.fetch.length > 0) {
			outerSql += ` FETCH ${opts.fetch.join(", ")}`;
		}

		if (opts.timeout) {
			outerSql += ` TIMEOUT ${opts.timeout}`;
		}

		if (opts.explain) {
			outerSql += " EXPLAIN";
		}

		return { queryString: outerSql, bindings, isDirectIdQuery };
	}

	// LIMIT clause
	if (opts.limit !== undefined) {
		const limitKey = getUniqueKey("limit");
		sqlString += ` LIMIT $${limitKey}`;
		bindings[limitKey] = opts.limit;
	}

	// START clause
	if (opts.start !== undefined) {
		const startKey = getUniqueKey("start");
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

	// PARALLEL clause (deprecated in SurrealDB 2.2+)
	// if (opts.parallel) {
	// 	sqlString += " PARALLEL";
	// }

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
async function executeAndProcessQuery<
	T,
	ModelInstanceType,
	TTable,
	TFields extends Record<string, FieldDefinition<unknown>> = Record<
		string,
		FieldDefinition<unknown>
	>,
>(
	db: SurrealLike,
	queryString: string,
	bindings: Record<string, unknown>,
	opts: SelectQueryOptions<TTable, TFields>,
	ModelClass: new (data: T) => ModelInstanceType,
): Promise<unknown> {
	const shouldReturnRawData =
		!!opts.groupBy ||
		!!opts.select ||
		!!opts.explain ||
		!!opts.split ||
		!!opts.value ||
		!!opts.omit;

	// DEBUG logging
	if ("DEBUG" in opts && opts.DEBUG) {
		console.log(`[UNREALORM DEBUG] Query: ${queryString}`);
		console.log(
			`[UNREALORM DEBUG] Bindings: ${JSON.stringify(bindings, null, 2)}`,
		);
	}

	// Use string query with bindings, then collect results
	const result = await db.query<unknown[]>(queryString, bindings).collect();

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
// SELECT METHOD OVERLOADED TYPE
// ============================================================================

/**
 * Fully typed overloaded interface for the `select` method.
 * Narrows the return type based on whether `select:` (field projection),
 * `omit:`, or `only: true` are present in the options.
 *
 * The cross product of options gives 8 overloads:
 *   (with-db | no-db) × (select | omit | plain) × (only | array)
 *
 * @internal — cast target for the implementation; exported so model.ts can reference it.
 */
export type SelectMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = {
	// select: + only: true  →  single narrowed result
	<TSelect extends FieldSelect<TFields>>(
		db: SurrealLike,
		opts: Omit<
			SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
			"select" | "only"
		> & {
			select: TSelect;
			only: true;
		},
	): Promise<InferSelectResult<TFields, TSelect> | undefined>;

	// select: (no only)  →  array of narrowed results
	<TSelect extends FieldSelect<TFields>>(
		db: SurrealLike,
		opts: Omit<
			SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
			"select"
		> & {
			select: TSelect;
		},
	): Promise<InferSelectResult<TFields, TSelect>[]>;

	// omit: + only: true  →  single omit result
	<TOmit extends OmitSelect<TFields>>(
		db: SurrealLike,
		opts: Omit<
			SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
			"omit" | "only"
		> & {
			omit: TOmit;
			only: true;
		},
	): Promise<InferOmitResult<TFields, TOmit> | undefined>;

	// omit: (no only)  →  array of omit results
	<TOmit extends OmitSelect<TFields>>(
		db: SurrealLike,
		opts: Omit<
			SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
			"omit"
		> & {
			omit: TOmit;
		},
	): Promise<InferOmitResult<TFields, TOmit>[]>;

	// only: true (no projection)  →  single model instance
	(
		db: SurrealLike,
		opts: Omit<
			SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
			"only"
		> & {
			only: true;
		},
	): Promise<ModelInstance<InferShapeFromFields<TFields>> | undefined>;

	// groupBy without projection  →  raw aggregation results
	(
		db: SurrealLike,
		opts: Omit<
			SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
			"select"
		> & {
			groupBy: string[];
		},
	): Promise<Record<string, unknown>[]>;

	// no only / plain  →  model instance array
	(
		db: SurrealLike,
		opts?: SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
	): Promise<ModelInstance<InferShapeFromFields<TFields>>[]>;
};

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
 * const activeUsers = await User.select(db, { where: surql`isActive = true` });
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
 *
 * // Grouped aggregation
 * const byCity = await User.select(db, {
 *   select: { city: true, total: typed<number>(surql`count()`) },
 *   groupBy: ['city'],
 * });
 * ```
 *
 * @returns The static `select` method implementation.
 * @internal
 */
export function getSelectMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>(): SelectMethod<TFields> {
	const selectImpl = async function select<T extends Record<string, unknown>>(
		this: ModelStatic<
			ModelInstance<InferShapeFromFields<TFields>>,
			TFields,
			TableDefineOptions<TFields>
		>,
		db: SurrealLike,
		options?: SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
	): Promise<unknown> {
		validateDb(db);

		const tableName = this.getTableName();
		let queryOpts: SelectQueryOptions<
			InferShapeFromFields<TFields>,
			TFields
		> = options || {};

		// Convert typed where callback to an expression the query builder can embed.
		if (typeof options?.where === "function") {
			const proxy = createFieldProxy(this._fields);
			const whereExpr = (
				options.where as (fields: FieldProxy<TFields>) => BoundQuery | Expr
			)(proxy as FieldProxy<TFields>);
			queryOpts = { ...options, where: whereExpr };
		}

		// Build the complete query string and bindings
		const { queryString, bindings } = buildQuery(queryOpts, tableName);

		// Execute query and process results
		return executeAndProcessQuery<
			InferShapeFromFields<(typeof this)["_fields"]>,
			InstanceType<typeof this>,
			InferShapeFromFields<(typeof this)["_fields"]>,
			TFields
		>(db, queryString, bindings, queryOpts, this);
	};

	// Cast to the fully-overloaded type. The body returns Promise<unknown>
	// at implementation level; the public signature is precisely typed via
	// SelectMethod<TFields> with 12 overloads.
	return selectImpl as unknown as SelectMethod<TFields>;
}

// ============================================================================
// COUNT METHOD
// ============================================================================

/**
 * A factory function that generates the static `count` method for a model class.
 *
 * Supports unfiltered counts, filtered counts, and grouped counts.
 *
 * @example
 * ```ts
 * const total = await User.count(db);
 * const active = await User.count(db, { where: eq('active', true) });
 * const byCity = await User.count(db, { by: ['city'] });
 * ```
 *
 * @returns The static `count` method implementation.
 * @internal
 */
export function getCountMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	return async function count(
		this: ModelStatic<
			ModelInstance<InferShapeFromFields<TFields>>,
			TFields,
			TableDefineOptions<TFields>
		>,
		db: SurrealLike,
		options?: {
			where?:
				| BoundQuery
				| Expr
				| ((fields: FieldProxy<TFields>) => BoundQuery | Expr);
			by?: (keyof TFields | string)[];
		},
	): Promise<number | Record<string, unknown>[]> {
		validateDb(db);

		const tableName = this.getTableName();
		const by = options?.by;
		const selectClause =
			by && by.length > 0 ? `${by.join(", ")}, count()` : "count()";

		let sqlString = `SELECT ${selectClause} FROM type::table($table)`;
		const bindings: Record<string, unknown> = { table: tableName };

		if (options?.where) {
			let whereQuery: BoundQuery;

			if (typeof options.where === "function") {
				const proxy = createFieldProxy(this._fields);
				whereQuery = surql`${options.where(proxy as FieldProxy<TFields>)}`;
			} else if (
				options.where &&
				typeof options.where === "object" &&
				"query" in options.where &&
				"bindings" in options.where
			) {
				whereQuery = options.where as BoundQuery;
			} else {
				whereQuery = surql`${options.where as Expr}`;
			}

			sqlString += ` WHERE ${whereQuery.query}`;
			Object.assign(bindings, whereQuery.bindings);
		}

		if (by && by.length > 0) {
			sqlString += ` GROUP BY ${by.join(", ")}`;
		} else {
			// Without a GROUP BY, SurrealDB returns count() per row.
			// GROUP ALL collapses the result set into a single total.
			sqlString += " GROUP ALL";
		}

		const result = await db
			.query<[Record<string, unknown>[]]>(sqlString, bindings)
			.collect();

		if (by && by.length > 0) {
			return result[0] || [];
		}

		const row = result[0];
		return (row?.[0]?.count as number) ?? 0;
	};
}
