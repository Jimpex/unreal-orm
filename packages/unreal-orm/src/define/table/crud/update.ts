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
 * @example
 * ```ts
 * const user = await User.select(db, 'user:123');
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
 * // Full content replacement (UPDATE)
 * const updatedUser = await User.update(db, 'user:123', {
 *   data: { name: 'Jane Doe', age: 31 },
 *   mode: 'content'
 * });
 *
 * // Partial merge (MERGE/PATCH)
 * const updatedUser = await User.update(db, 'user:123', {
 *   data: { age: 32 },
 *   mode: 'merge'
 * });
 *
 * // With additional options
 * const updatedUser = await User.update(db, 'user:123', {
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

	// Create overloaded function signatures
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
		options: {
			data: Partial<TableData>;
			mode: "content" | "merge" | "replace";
		},
	): Promise<InstanceType<T>>;
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
		options: { data: JsonPatchOperation[]; mode: "patch" },
	): Promise<InstanceType<T>>;
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
		if (!db) {
			throw new Error(
				"SurrealDB instance must be provided to update a record.",
			);
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
