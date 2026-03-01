import type { Surreal, BoundQuery, Expr } from "surrealdb";
import { surql, RecordId } from "surrealdb";
import type {
	ModelStatic,
	InferShapeFromFields,
	ModelInstance,
	TableDefineOptions,
	SurrealLike,
	CreateData,
} from "../types/model";
import type { InsertQueryOptions, ReturnType } from "../types/query";
import type { FieldDefinition } from "../../field/types";
import { getDatabase, isSurrealLike } from "../../../config";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
 * Builds the RETURN clause from options.
 * Supports: NONE, BEFORE, AFTER, DIFF, VALUE field, specific fields, or native SurrealQL (BoundQuery/Expr)
 * @internal
 */
function buildReturnClause(returnOption: ReturnType | undefined): {
	clause: string;
	bindings: Record<string, unknown>;
} {
	if (!returnOption) {
		// Default is RETURN AFTER
		return { clause: "", bindings: {} };
	}

	if (typeof returnOption === "string") {
		// Simple return types: NONE, BEFORE, AFTER, DIFF
		const upperReturn = returnOption.toUpperCase();
		if (["NONE", "BEFORE", "AFTER", "DIFF"].includes(upperReturn)) {
			return { clause: ` RETURN ${upperReturn}`, bindings: {} };
		}
		// This shouldn't happen with current types, but handle gracefully
		return { clause: ` RETURN ${returnOption}`, bindings: {} };
	}

	if (Array.isArray(returnOption)) {
		// Multiple specific fields
		return { clause: ` RETURN ${returnOption.join(", ")}`, bindings: {} };
	}

	// Check for BoundQuery
	if (isBoundQuery(returnOption)) {
		return {
			clause: ` RETURN ${returnOption.query}`,
			bindings: returnOption.bindings,
		};
	}

	if (typeof returnOption === "object") {
		if ("value" in returnOption && returnOption.value) {
			// RETURN VALUE field
			return { clause: ` RETURN VALUE ${returnOption.value}`, bindings: {} };
		}
		// Handle Expr by converting to BoundQuery
		const boundExpr = surql`${returnOption as Expr}`;
		return {
			clause: ` RETURN ${boundExpr.query}`,
			bindings: boundExpr.bindings,
		};
	}

	return { clause: "", bindings: {} };
}

/**
 * Builds the ON DUPLICATE KEY UPDATE clause from options.
 * @internal
 */
function buildOnDuplicateClause(
	onDuplicate: Record<string, unknown> | BoundQuery | Expr | undefined,
): { clause: string; bindings: Record<string, unknown> } {
	if (!onDuplicate) {
		return { clause: "", bindings: {} };
	}

	if (isBoundQuery(onDuplicate)) {
		return {
			clause: ` ON DUPLICATE KEY UPDATE ${onDuplicate.query}`,
			bindings: onDuplicate.bindings,
		};
	}

	// Object format: { field: value, field2: value2 }
	if (typeof onDuplicate === "object" && !Array.isArray(onDuplicate)) {
		const updates: string[] = [];
		const bindings: Record<string, unknown> = {};
		let bindIdx = 0;

		for (const [key, value] of Object.entries(onDuplicate)) {
			const bindKey = `dup_${bindIdx++}`;
			updates.push(`${key} = $${bindKey}`);
			bindings[bindKey] = value;
		}

		if (updates.length > 0) {
			return {
				clause: ` ON DUPLICATE KEY UPDATE ${updates.join(", ")}`,
				bindings,
			};
		}
	}

	// Expr - convert to BoundQuery
	const boundExpr = surql`${onDuplicate as Expr}`;
	return {
		clause: ` ON DUPLICATE KEY UPDATE ${boundExpr.query}`,
		bindings: boundExpr.bindings,
	};
}

/**
 * Builds the complete INSERT query string and bindings from options.
 * @internal
 */
function buildInsertQuery(
	opts: Pick<
		InsertQueryOptions<unknown>,
		"relation" | "ignore" | "onDuplicate" | "return"
	>,
	tableName: string,
	data: unknown,
): {
	queryString: string;
	bindings: Record<string, unknown>;
} {
	const bindings: Record<string, unknown> = {};

	// Start building the query
	let sqlString = "INSERT";

	// RELATION clause (for relation tables)
	if (opts.relation) {
		sqlString += " RELATION";
	}

	// IGNORE clause
	if (opts.ignore) {
		sqlString += " IGNORE";
	}

	// INTO clause - use backtick-escaped table name directly
	// (type::table() doesn't work in INSERT statements)
	sqlString += ` INTO \`${tableName}\``;

	// Data - bind as parameter
	const dataKey = `data_${Date.now()}`;
	sqlString += ` $${dataKey}`;
	bindings[dataKey] = data;

	// ON DUPLICATE KEY UPDATE clause
	const { clause: dupClause, bindings: dupBindings } = buildOnDuplicateClause(
		opts.onDuplicate,
	);
	if (dupClause) {
		sqlString += dupClause;
		Object.assign(bindings, dupBindings);
	}

	// RETURN clause
	const { clause: returnClause, bindings: returnBindings } = buildReturnClause(
		opts.return,
	);
	if (returnClause) {
		sqlString += returnClause;
		Object.assign(bindings, returnBindings);
	}

	return { queryString: sqlString, bindings };
}

/**
 * Executes an INSERT query and processes the results.
 * @internal
 */
async function executeInsertQuery<T, ModelInstanceType>(
	db: SurrealLike,
	queryString: string,
	bindings: Record<string, unknown>,
	opts: Pick<InsertQueryOptions<T>, "return">,
	ModelClass: new (data: T) => ModelInstanceType,
	isBulk: boolean,
): Promise<unknown> {
	// Use string query with bindings, then collect results
	const queryBuilder = (db as unknown as Surreal).query(queryString, bindings);
	const result = (await queryBuilder.collect()) as unknown as unknown[];

	// Check if we should return raw data (custom return clause)
	const hasCustomReturn =
		opts.return && opts.return !== "AFTER" && opts.return !== "after";

	// RETURN NONE - return undefined/empty
	if (opts.return === "NONE" || opts.return === "none") {
		return isBulk ? [] : undefined;
	}

	// RETURN DIFF - return raw diff data
	if (opts.return === "DIFF" || opts.return === "diff") {
		const queryResults = result[0] as T[] | undefined;
		return isBulk ? queryResults : queryResults?.[0];
	}

	// Custom field selection or VALUE - return raw
	// Also applies to string arrays specifying specific fields
	if (
		hasCustomReturn &&
		(Array.isArray(opts.return) ||
			(typeof opts.return === "object" &&
				("value" in opts.return || "fields" in opts.return)))
	) {
		const queryResults = result[0] as T[] | undefined;
		return isBulk ? queryResults : queryResults?.[0];
	}

	// Default: hydrate to model instances
	const queryResults = result[0] as T[] | undefined;

	if (!queryResults) {
		return isBulk ? [] : undefined;
	}

	if (isBulk) {
		return queryResults.map((r) => new ModelClass(r));
	}

	return queryResults[0] ? new ModelClass(queryResults[0]) : undefined;
}

// ============================================================================
// MAIN FACTORY FUNCTION
// ============================================================================

/**
 * A factory function that generates the static `insert` method for a model class.
 * This method handles inserting records using the INSERT statement with full support
 * for bulk inserts, IGNORE, ON DUPLICATE KEY UPDATE, and RETURN clauses.
 *
 * Supports two calling patterns:
 * - `User.insert(db, { data, ...options })` - explicit database instance
 * - `User.insert({ data, ...options })` - uses configured default database
 *
 * @example
 * ```ts
 * // Single insert (with configured db)
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
 * // With IGNORE (silently skip duplicates)
 * const users = await User.insert({
 *   data: { name: 'John', email: 'john@example.com' },
 *   ignore: true,
 * });
 *
 * // With ON DUPLICATE KEY UPDATE
 * const users = await User.insert({
 *   data: { name: 'John', email: 'john@example.com' },
 *   onDuplicate: { updatedAt: new Date() },
 * });
 *
 * // With custom RETURN clause
 * const users = await User.insert({
 *   data: { name: 'John', email: 'john@example.com' },
 *   return: 'NONE',
 * });
 * const names = await User.insert({
 *   data: { name: 'John', email: 'john@example.com' },
 *   return: { value: 'name' },
 * });
 * ```
 *
 * @returns The static `insert` method implementation.
 * @internal
 */
export function getInsertMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	type TableData = InferShapeFromFields<TFields>;
	type InsertData = CreateData<TFields>;

	return async function insert(
		this: ModelStatic<
			ModelInstance<InferShapeFromFields<TFields>>,
			TFields,
			TableDefineOptions<TFields>
		>,
		dbOrOptions:
			| SurrealLike
			| InsertQueryOptions<TableData, InsertData | InsertData[]>,
		maybeOptions?: InsertQueryOptions<TableData, InsertData | InsertData[]>,
	): Promise<unknown> {
		// Resolve db and options based on calling pattern
		let db: SurrealLike;
		let opts: InsertQueryOptions<TableData, InsertData | InsertData[]>;

		if (isSurrealLike(dbOrOptions)) {
			// Pattern: insert(db, { data, ...options })
			db = dbOrOptions;
			if (!maybeOptions || !("data" in maybeOptions)) {
				throw new Error(
					"insert(db, options) requires options with 'data' property.",
				);
			}
			opts = maybeOptions;
		} else {
			// Pattern: insert({ data, ...options }) - use configured default
			db = await getDatabase();
			if (!dbOrOptions || !("data" in dbOrOptions)) {
				throw new Error(
					"insert(options) requires options with 'data' property.",
				);
			}
			opts = dbOrOptions;
		}

		const tableName = this.getTableName();
		const data = opts.data;
		const isBulk = Array.isArray(data);

		// Auto-detect relation mode from table type
		const isRelation = this._options.type === "relation";

		// Validate relation table data
		if (isRelation) {
			const validateRelationData = (item: unknown) => {
				const record = item as { in?: unknown; out?: unknown };
				if (!record.in || !record.out) {
					throw new Error(
						"Relation tables require 'in' and 'out' properties in insert data",
					);
				}
				if (!(record.in instanceof RecordId)) {
					throw new Error("'in' property must be a RecordId instance");
				}
				if (!(record.out instanceof RecordId)) {
					throw new Error("'out' property must be a RecordId instance");
				}
			};

			if (isBulk) {
				(data as unknown[]).forEach(validateRelationData);
			} else {
				validateRelationData(data);
			}
		}

		const effectiveOpts = isRelation ? { ...opts, relation: true } : opts;

		// Build the complete query string and bindings
		const { queryString, bindings } = buildInsertQuery(
			effectiveOpts,
			tableName,
			data,
		);

		// Execute query and process results
		return executeInsertQuery<
			InferShapeFromFields<(typeof this)["_fields"]>,
			InstanceType<typeof this>
		>(db, queryString, bindings, effectiveOpts, this, isBulk);
	};
}
