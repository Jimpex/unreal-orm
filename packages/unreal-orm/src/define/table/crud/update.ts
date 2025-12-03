import type { RecordId, Surreal } from "surrealdb";
import type {
	InferShapeFromFields,
	ModelInstance,
	ModelStatic,
	TableDefineOptions,
} from "../types/model";
import type { SurrealLike } from "../types/model";
import type { FieldDefinition } from "../../field/types";
import type {
	UpdateOptions,
	UpdateMode,
	JsonPatchOperation,
} from "../types/query";
import { getDatabase, isSurrealLike } from "../../../config";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validates that UpdateOptions has the required mode property.
 */
function validateUpdateOptions<T>(options: UpdateOptions<T>): void {
	if (!options.mode) {
		throw new Error(
			"UpdateOptions.mode is required. Use 'content' for full replacement, 'merge' for partial updates, 'replace' for full replacement, or 'patch' for partial updates.",
		);
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
		// Patch mode expects JSON Patch operations
		const builder = db
			.update<T>(id)
			// @ts-ignore SurrealDB types are incorrect
			.patch(options.data);
		return builder as unknown as T;
	}

	// Content, merge, replace modes expect Partial<T>
	const builder = db.update<T>(id)[options.mode](options.data as Partial<T>);
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
 * Supports two calling patterns:
 * - `user.update(db, options)` - explicit database instance
 * - `user.update(options)` - uses configured default database
 *
 * @example
 * ```ts
 * const user = await User.select({ from: 'user:123', only: true });
 *
 * // Full content replacement (with configured db)
 * const updatedUser = await user.update({
 *   data: { name: 'Jane Doe', age: 31 },
 *   mode: 'content'
 * });
 *
 * // Partial merge (with explicit db)
 * const updatedUser = await user.update(db, {
 *   data: { age: 32 },
 *   mode: 'merge'
 * });
 *
 * // JSON Patch operations
 * const updatedUser = await user.update({
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
		dbOrOptions: SurrealLike | UpdateOptions<TableData>,
		maybeOptions?: UpdateOptions<TableData>,
	): Promise<ModelInstance<TableData>> {
		// Resolve db and options based on calling pattern
		let db: SurrealLike;
		let options: UpdateOptions<TableData>;

		if (isSurrealLike(dbOrOptions)) {
			// Pattern: update(db, options)
			db = dbOrOptions;
			if (maybeOptions === undefined) {
				throw new Error(
					"update(db, options) requires options as second argument. " +
						"Did you mean to use update(options) with a configured database?",
				);
			}
			options = maybeOptions;
		} else {
			// Pattern: update(options) - use configured default
			db = await getDatabase();
			if (dbOrOptions === undefined || dbOrOptions === null) {
				throw new Error("update(options) requires options object");
			}
			options = dbOrOptions;
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
 * Supports two calling patterns:
 * - `User.update(db, id, options)` - explicit database instance
 * - `User.update(id, options)` - uses configured default database
 *
 * @example
 * ```ts
 * // Full content replacement (with configured db)
 * const updatedUser = await User.update(recordId, {
 *   data: { name: 'Jane Doe', age: 31 },
 *   mode: 'content'
 * });
 *
 * // Partial merge (with explicit db)
 * const updatedUser = await User.update(db, recordId, {
 *   data: { age: 32 },
 *   mode: 'merge'
 * });
 *
 * // With additional options
 * const updatedUser = await User.update(recordId, {
 *   data: { status: 'active' },
 *   mode: 'merge',
 *   output: 'diff',
 *   timeout: '5s'
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
		dbOrId: SurrealLike | RecordId,
		idOrOptions: RecordId | UpdateOptions<TableData>,
		maybeOptions?: UpdateOptions<TableData>,
	): Promise<InstanceType<T>> {
		// Resolve db, id, and options based on calling pattern
		let db: SurrealLike;
		let id: RecordId;
		let options: UpdateOptions<TableData>;

		if (isSurrealLike(dbOrId)) {
			// Pattern: update(db, id, options)
			db = dbOrId;
			if (!(idOrOptions instanceof Object && "tb" in idOrOptions)) {
				throw new Error(
					"update(db, id, options) requires RecordId as second argument",
				);
			}
			id = idOrOptions as RecordId;
			if (maybeOptions === undefined) {
				throw new Error(
					"update(db, id, options) requires options as third argument",
				);
			}
			options = maybeOptions;
		} else {
			// Pattern: update(id, options) - use configured default
			db = await getDatabase();
			id = dbOrId;
			if (idOrOptions === undefined || idOrOptions === null) {
				throw new Error(
					"update(id, options) requires options as second argument",
				);
			}
			if (!("mode" in idOrOptions)) {
				throw new Error(
					"update(id, options) second argument must be UpdateOptions with 'mode' property",
				);
			}
			options = idOrOptions as UpdateOptions<TableData>;
		}

		// Execute the update using the builder pattern
		const updatedRecord = await executeUpdate<TableData>(db, id, options);

		if (!updatedRecord) {
			throw new Error(`Failed to update record ${id}.`);
		}

		// Return hydrated model instance
		return new this(
			updatedRecord as TableData & { id: RecordId },
		) as InstanceType<T>;
	}

	return update;
}
