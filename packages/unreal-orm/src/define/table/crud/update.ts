import type { BoundQuery, Expr, RecordId } from "surrealdb";
import { BoundQuery as BoundQueryCtor, Table, surql } from "surrealdb";
import type { ColumnRef, FieldProxy } from "../../../query/field-proxy";
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
import type {
	JsonPatchOperation,
	SetUpdateOptions,
	UpdateMode,
	UpdateOptions,
} from "../types/query";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validates that UpdateOptions has the required mode property.
 */
function validateUpdateOptions<T>(options: UpdateOptions<T>): void {
	if (!options.mode) {
		throw new Error(
			"UpdateOptions.mode is required. Use 'content' for full replacement, 'merge' for partial updates, 'replace' for full replacement, 'patch' for JSON Patch, or 'set' for computed field expressions.",
		);
	}
}

/**
 * Renders a value for use in a SET clause. Plain values are bound as parameters;
 * Expr/BoundQuery/ColumnRef values are rendered as SurrealQL expressions.
 */
function renderSetValue(
	value: unknown,
	bindings: Record<string, unknown>,
): string {
	const ctx: { def: (v: unknown) => string } = {
		def: (v) => JSON.stringify(v),
	};

	// BoundQuery — use query string, merge bindings
	if (
		value !== null &&
		typeof value === "object" &&
		"query" in value &&
		"bindings" in value
	) {
		const bq = value as BoundQuery;
		Object.assign(bindings, bq.bindings);
		return bq.query;
	}

	// ColumnRef — has toSQL method
	if (
		value !== null &&
		typeof value === "object" &&
		"toSQL" in value &&
		typeof (value as { toSQL: unknown }).toSQL === "function"
	) {
		return (value as ColumnRef<unknown>).toSQL(ctx);
	}

	// Expr — convert via surql
	if (
		value !== null &&
		typeof value === "object" &&
		!Array.isArray(value) &&
		!("query" in value) &&
		!("toSQL" in value)
	) {
		const bound = surql`${value as Expr}`;
		Object.assign(bindings, bound.bindings);
		return bound.query;
	}

	// Plain value — bind as parameter
	const key = `set_val_${Object.keys(bindings).length}`;
	bindings[key] = value;
	return `$${key}`;
}

/**
 * Builds a `SET field1 = expr1, field2 = expr2, ...` clause from a data object.
 * Supports plain values, Expr, BoundQuery, and ColumnRef as values.
 * @returns Object with `clause` string and `bindings` record.
 */
function buildSetClause(data: Readonly<Record<string, unknown>>): {
	clause: string;
	bindings: Record<string, unknown>;
} {
	const bindings: Record<string, unknown> = {};
	const assignments: string[] = [];

	for (const [field, value] of Object.entries(data)) {
		if (value === undefined) continue;
		const rendered = renderSetValue(value, bindings);
		assignments.push(`${field} = ${rendered}`);
	}

	if (assignments.length === 0) {
		throw new Error("set mode requires at least one field to update");
	}

	return { clause: `SET ${assignments.join(", ")}`, bindings };
}

/**
 * Applies a minimal set of JSON Patch operations to a plain object.
 * This is used for `patch` mode because SurrealDB's native `PATCH` does not
 * handle array element updates reliably in all versions.
 */
function applyJsonPatch(
	record: Record<string, unknown>,
	operations: JsonPatchOperation[],
): void {
	for (const op of operations) {
		const parts = op.path.split("/").filter((p: string) => p !== "");

		if (op.op === "add" || op.op === "replace") {
			setValueAtPath(record, parts, op.value);
		} else if (op.op === "remove") {
			removeValueAtPath(record, parts);
		} else if (op.op === "move" && "from" in op) {
			const value = getValueAtPath(
				record,
				String(op.from)
					.split("/")
					.filter((p) => p !== ""),
			);
			removeValueAtPath(
				record,
				String(op.from)
					.split("/")
					.filter((p) => p !== ""),
			);
			setValueAtPath(record, parts, value);
		} else if (op.op === "copy" && "from" in op) {
			setValueAtPath(
				record,
				parts,
				getValueAtPath(
					record,
					String(op.from)
						.split("/")
						.filter((p) => p !== ""),
				),
			);
		} else if (op.op === "test" && "value" in op) {
			const current = getValueAtPath(record, parts);
			if (JSON.stringify(current) !== JSON.stringify(op.value)) {
				throw new Error(`JSON Patch test failed at path ${op.path}`);
			}
		}
	}
}

function getValueAtPath(
	obj: Record<string, unknown>,
	parts: string[],
): unknown {
	let current: unknown = obj;
	for (const part of parts) {
		if (!part) return undefined;
		if (Array.isArray(current) && /^\d+$/.test(part)) {
			current = current[Number(part)];
		} else if (current && typeof current === "object") {
			current = (current as Record<string, unknown>)[part];
		} else {
			return undefined;
		}
	}
	return current;
}

function setValueAtPath(
	obj: Record<string, unknown>,
	parts: string[],
	value: unknown,
): void {
	let current: unknown = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		if (!part) return;
		if (Array.isArray(current) && /^\d+$/.test(part)) {
			current = current[Number(part)];
		} else if (current && typeof current === "object") {
			current = (current as Record<string, unknown>)[part];
		} else {
			return;
		}
	}
	const last = parts[parts.length - 1];
	if (!last) return;
	if (Array.isArray(current) && /^\d+$/.test(last)) {
		current[Number(last)] = value;
	} else if (current && typeof current === "object") {
		(current as Record<string, unknown>)[last] = value;
	}
}

function removeValueAtPath(
	obj: Record<string, unknown>,
	parts: string[],
): void {
	let current: unknown = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		if (!part) return;
		if (Array.isArray(current) && /^\d+$/.test(part)) {
			current = current[Number(part)];
		} else if (current && typeof current === "object") {
			current = (current as Record<string, unknown>)[part];
		} else {
			return;
		}
	}
	const last = parts[parts.length - 1];
	if (!last) return;
	if (Array.isArray(current) && /^\d+$/.test(last)) {
		current.splice(Number(last), 1);
	} else if (current && typeof current === "object") {
		delete (current as Record<string, unknown>)[last];
	}
}

/**
 * Executes an update using the SurrealDB 2.0 builder pattern.
 */
async function executeUpdate<T>(
	db: SurrealLike,
	id: RecordId,
	options: UpdateOptions<T>,
): Promise<T> {
	validateUpdateOptions(options);

	// Handle different modes with proper type narrowing
	if (options.mode === "patch") {
		// Patch mode applies JSON Patch locally and then writes the full
		// record back with CONTENT. This avoids SurrealDB's native PATCH
		// limitations with array element updates.
		const current = await db.select<Record<string, unknown>>(id);
		if (!current) {
			throw new Error(`Record ${String(id)} not found for patch operation.`);
		}
		applyJsonPatch(current, options.data);
		const { id: _recordId, ...dataWithoutId } = current;
		const builder = db
			.update<Record<string, unknown>>(id)
			.content(dataWithoutId);
		return builder as unknown as T;
	}

	// Handle set mode — build SET clause with computed expressions
	if (options.mode === "set") {
		const setData = options.data;
		const { clause: setClause, bindings: setBindings } =
			buildSetClause(setData);
		const sqlString = `UPDATE type::table($table) ${setClause} WHERE id = $id`;
		const allBindings = {
			table: id.table.name,
			id,
			...setBindings,
		};
		const result = await db.query<[T[]]>(sqlString, allBindings).collect();
		return result[0]?.[0] as T;
	}

	// Content, merge, replace modes expect Partial<T>
	const builder = db.update<T>(id)[options.mode](options.data);
	return builder as unknown as T;
}

// ============================================================================
// INSTANCE METHOD
// ============================================================================

/**
 * A factory function that generates the instance `update` method for a model.
 * This method performs updates using the SurrealDB 2.0 builder pattern with
 * a required mode property. All update operations must specify whether they
 * are doing a full replacement or partial merge.
 *
 * @example
 * ```ts
 * const user = await User.select(db, { from: 'user:123', only: true });
 *
 * // Full content replacement
 * const updatedUser = await user.update(db, {
 *   data: { name: 'Jane Doe', age: 31 },
 *   mode: 'content'
 * });
 *
 * // Partial merge
 * const updatedUser = await user.update(db, {
 *   data: { age: 32 },
 *   mode: 'merge'
 * });
 *
 * // JSON Patch operations
 * const updatedUser = await user.update(db, {
 *   data: [{ op: 'replace', path: '/age', value: 32 }],
 *   mode: 'patch'
 * });
 * ```
 *
 * @returns The instance `update` method implementation.
 * @internal
 */
export function getUpdateMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	type TableData = InferShapeFromFields<TFields>;

	return async function update(
		this: ModelInstance<TableData>,
		db: SurrealLike,
		options: UpdateOptions<TableData>,
	): Promise<ModelInstance<TableData>> {
		validateDb(db);

		if (options === undefined || options === null) {
			throw new Error("update(db, options) requires options object");
		}

		const ModelClass = this.constructor as ModelStatic<
			ModelInstance<TableData>,
			TFields,
			TableDefineOptions<TFields>
		>;

		const updatedRecord = await executeUpdate<TableData>(db, this.id, options);

		if (!updatedRecord) {
			throw new Error(`Failed to update record ${String(this.id)}.`);
		}

		return new ModelClass(updatedRecord as TableData & { id: RecordId });
	};
}

// ============================================================================
// STATIC METHOD
// ============================================================================

/**
 * A factory function that generates the static `update` method for a model.
 * This method performs updates using the SurrealDB 2.0 builder pattern with
 * a required mode property. All update operations must specify whether they
 * are doing a full replacement or partial merge.
 *
 * @example
 * ```ts
 * // Full content replacement
 * const updatedUser = await User.update(db, recordId, {
 *   data: { name: 'Jane Doe', age: 31 },
 *   mode: 'content'
 * });
 *
 * // Partial merge
 * const updatedUser = await User.update(db, recordId, {
 *   data: { age: 32 },
 *   mode: 'merge'
 * });
 * ```
 *
 * @returns The static `update` method implementation.
 * @internal
 */
export function getStaticUpdateMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	type TableData = InferShapeFromFields<TFields>;

	async function update<
		T extends ModelStatic<
			ModelInstance<InferShapeFromFields<TFields>>,
			TFields,
			TableDefineOptions<TFields>
		>,
	>(
		this: T,
		db: SurrealLike,
		id: RecordId,
		options: UpdateOptions<TableData>,
	): Promise<InstanceType<T>> {
		validateDb(db);

		if (!options || !("mode" in options)) {
			throw new Error(
				"update(db, id, options) requires UpdateOptions with 'mode' property as third argument",
			);
		}

		const updatedRecord = await executeUpdate<TableData>(db, id, options);

		if (!updatedRecord) {
			throw new Error(`Failed to update record ${id}.`);
		}

		return new this(
			updatedRecord as TableData & { id: RecordId },
		) as InstanceType<T>;
	}

	return update;
}

// ============================================================================
// BULK UPDATE METHOD
// ============================================================================

/**
 * A factory function that generates the static `updateMany` method for a model.
 * Updates every record matching the given WHERE clause.
 *
 * @example
 * ```ts
 * await User.updateMany(db, {
 *   where: eq('active', false),
 *   data: { active: true },
 *   mode: 'merge',
 * });
 * ```
 *
 * @returns The static `updateMany` method implementation.
 * @internal
 */
export function getUpdateManyMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	type TableData = InferShapeFromFields<TFields>;

	return async function updateMany<
		T extends ModelStatic<
			ModelInstance<InferShapeFromFields<TFields>>,
			TFields,
			TableDefineOptions<TFields>
		>,
	>(
		this: T,
		db: SurrealLike,
		options: {
			where:
				| BoundQuery
				| Expr
				| ((fields: FieldProxy<TFields>) => BoundQuery | Expr);
			data:
				| Partial<TableData>
				| Record<string, unknown>
				| ((fields: FieldProxy<TFields>) => Record<string, unknown>);
			mode: UpdateMode;
		},
	): Promise<InstanceType<T>[]> {
		validateDb(db);

		const tableName = this.getTableName();
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

		// Handle set mode — build SET clause with computed expressions
		if (options.mode === "set") {
			let setData: Record<string, unknown>;
			if (typeof options.data === "function") {
				const proxy = createFieldProxy(this._fields);
				setData = options.data(proxy);
			} else {
				setData = options.data;
			}
			const { clause: setClause, bindings: setBindings } =
				buildSetClause(setData);
			const sqlString = `UPDATE type::table($table) ${setClause} WHERE ${whereQuery.query}`;
			const query = new BoundQueryCtor<TableData[]>(sqlString, {
				table: tableName,
				...setBindings,
				...whereQuery.bindings,
			});

			const result = await db
				.query<[TableData[]]>(query.query, query.bindings)
				.collect();

			return (result[0] || []).map(
				(record) => new this(record as TableData & { id: RecordId }),
			) as InstanceType<T>[];
		}

		// Build the UPDATE query manually so the mode keyword is embedded as
		// raw SurrealQL rather than bound as a string parameter.
		const mode = options.mode.toUpperCase();
		const sqlString = `UPDATE type::table($table) ${mode} $data WHERE ${whereQuery.query}`;
		const query = new BoundQueryCtor<TableData[]>(sqlString, {
			table: tableName,
			data: options.data,
			...whereQuery.bindings,
		});

		const result = await db
			.query<[TableData[]]>(query.query, query.bindings)
			.collect();

		return (result[0] || []).map(
			(record) => new this(record as TableData & { id: RecordId }),
		) as InstanceType<T>[];
	};
}
