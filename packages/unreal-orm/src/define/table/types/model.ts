import type { BoundQuery, Expr, RecordId, Surreal } from "surrealdb";
import type { FieldProxy } from "../../../query/field-proxy";
import type { RangeIdStart } from "../../../query/range";
import type { FieldDefinition } from "../../field/types";
import type { JsonPatchOperation, SelectQueryOptions } from "./query";
import type {
	DeepValidateSelect,
	FieldSelect,
	InferOmitResult,
	InferSelectResult,
	OmitSelect,
	SelectOption,
} from "./select";

/**
 * A type that represents any SurrealDB-compatible object that can perform
 * CRUD operations. This includes Surreal instances, SurrealSession instances,
 * and Transaction objects.
 *
 * This type picks only the core methods that are guaranteed to be available
 * across all SurrealDB object types, ensuring maximum compatibility.
 * `connect` and `close` are optional as they are not present on transaction objects.
 */
export type SurrealLike = Pick<
	Surreal,
	"create" | "select" | "update" | "delete" | "query" | "relate"
> &
	Partial<Pick<Surreal, "connect" | "close">>;

/**
 * Defines the core options for creating a table schema.
 * @template TFields An object defining the fields of the table.
 * @example
 * ```ts
 * const userOptions: TableDefineOptions<{
 *   name: FieldDefinition<string>,
 *   email: FieldDefinition<string>
 * }> = {
 *   name: 'user',
 *   fields: {
 *     name: Field.string(),
 *     email: Field.string()
 *   },
 *   schemafull: true
 * };
 * ```
 */
export type TableDefineOptions<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = {
	/** The name of the database table. */
	name: string;
	/** An object containing the field definitions for the table. Optional for views. */
	fields?: TFields;
	/** The type of table, either a standard 'normal' table, a 'relation' (edge) table, or a 'view'. */
	type?: "normal" | "relation" | "view";
	/** If true, the table will be created with `SCHEMAFULL`, enforcing the defined schema. */
	schemafull?: boolean;
	/** The query that defines the view (only for type: 'view'). */
	as?: string | BoundQuery | Expr;
};

// --- Type Inference Helpers ---

/**
 * A utility type that infers the shape of a model's data from its field definitions.
 * It recursively determines the TypeScript type for each field, converting `FieldDefinition` objects
 * into their corresponding TS types (e.g., `Field.string()` becomes `string`).
 * @template TFields An object defining the fields of the table.
 * @internal
 */
export type InferShapeFromFields<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = {
	-readonly [K in keyof TFields]: InferFieldType<TFields[K]>;
};

/**
 * A utility type that infers the TypeScript type of a single field from its definition.
 * This is the core of the type inference system, handling nested arrays, objects, records, and optional fields.
 * @template T The field definition.
 * @internal
 */
export type InferFieldType<T extends FieldDefinition<unknown>> =
	// Array fields
	T extends { arrayElementType: infer E }
		? E extends FieldDefinition<unknown>
			? Array<InferFieldType<E>>
			: unknown[]
		: // Record fields - check BEFORE object fields because Field.record sets objectSchema: undefined
			// Extract instance type from recordTableThunk to handle cases where FieldDefinition<unknown> loses type info
			T extends { recordTableThunk: () => infer M }
			? M extends ModelStatic<infer I, infer _F, infer _O>
				?
						| I
						| RecordId<
								M extends { _tableName: infer TN } ? TN & string : string
						  >
				: // Fallback to FieldDefinition generic if ModelStatic doesn't match
					T extends FieldDefinition<infer U>
					? U
					: never
			: // Object fields - only match if objectSchema is a Record (not undefined)
				T extends { objectSchema: infer S }
				? S extends Record<string, FieldDefinition<unknown>>
					? {
							[K in keyof S]: S[K] extends FieldDefinition<unknown>
								? InferFieldType<S[K]>
								: unknown;
						}
					: // objectSchema is undefined, fall through
						T extends { isOptional: true }
						? InferFieldType<Omit<T, "isOptional">> | undefined
						: T extends FieldDefinition<infer U>
							? U
							: never
				: // Option fields
					T extends { isOptional: true }
					? InferFieldType<Omit<T, "isOptional">> | undefined
					: // Fallback to the 'type' generic on FieldDefinition
						T extends FieldDefinition<infer U>
						? U
						: never;

/**
 * Infers the shape of the data required to create a new record.
 * It is essentially a partial version of the model's full data shape, as not all fields
 * are required upon creation (e.g., fields with defaults).
 * @template TFields An object defining the fields of the table.
 */
export type CreateData<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = Partial<InferShapeFromFields<TFields>> & {
	/** Optional custom record ID. If omitted, SurrealDB generates an ID. */
	id?: RecordId;
};

// --- Model Class and Instance Types ---

/**
 * A declaration for the base class that all model instances extend.
 * This provides the core instance properties and methods like `id`, `update`, and `delete`.
 * It is not intended to be instantiated directly but is used to build the final `ModelInstance` type.
 * @template TData The inferred shape of the model's data.
 * @internal
 */
export declare class BaseTable<TData extends Record<string, unknown>> {
	/** The unique record ID, assigned by the database. */
	id: RecordId;

	/**
	 * Creates a new model instance with the provided data.
	 * @param data - The initial data for the model instance.
	 */
	constructor(data: TData);

	// ============================================================================
	// UPDATE - instance methods
	// ============================================================================

	/**
	 * Updates the current record instance using content, merge, or replace mode.
	 * @param db - A SurrealDB connection or transaction object.
	 * @param options - Update options including data and mode.
	 * @returns A promise that resolves to the updated model instance.
	 * @example
	 * ```ts
	 * const user = await UserModel.select(db, { from: 'user:123', only: true });
	 * await user.update(db, {
	 *   data: { name: 'Jane' },
	 *   mode: 'merge'
	 * });
	 * ```
	 */
	update(
		db: SurrealLike,
		options: { data: Partial<TData>; mode: "content" | "merge" | "replace" },
	): Promise<this>;

	/**
	 * Updates the current record instance using JSON Patch operations.
	 * @param db - A SurrealDB connection or transaction object.
	 * @param options - Update options including patch operations and mode.
	 * @returns A promise that resolves to the updated model instance.
	 * @example
	 * ```ts
	 * const user = await UserModel.select(db, { from: 'user:123', only: true });
	 * await user.update(db, {
	 *   data: [{ op: 'replace', path: '/name', value: 'Jane' }],
	 *   mode: 'patch'
	 * });
	 * ```
	 */
	update(
		db: SurrealLike,
		options: { data: JsonPatchOperation[]; mode: "patch" },
	): Promise<this>;

	// ============================================================================
	// DELETE - instance methods
	// ============================================================================

	/**
	 * Deletes the current record instance from the database.
	 * @param db - A SurrealDB connection or transaction object.
	 * @returns A promise that resolves when the record is deleted.
	 * @example
	 * ```ts
	 * const user = await UserModel.select(db, { from: 'user:123', only: true });
	 * await user.delete(db);
	 * ```
	 */
	delete(db: SurrealLike): Promise<void>;
}

/**
 * Represents an instance of a model, combining the base table functionality with the specific data shape.
 * This is the type you get back when you call `new User({ ... })` or `User.select(...)`.
 * @template TData The inferred shape of the model's data.
 */
export type ModelInstance<TData extends Record<string, unknown>> =
	BaseTable<TData> & TData;

/**
 * Represents the static side of a model class (the class itself).
 * This includes the constructor, static properties like `_tableName` and `_fields`,
 * and static methods like `create` and the overloaded `select`.
 * @template TInstance The type of a model instance.
 * @template TFields The field definitions for the model.
 * @template TOptions The table definition options.
 */
export type ModelStatic<
	TInstance extends ModelInstance<InferShapeFromFields<TFields>>,
	TFields extends Record<string, FieldDefinition<unknown>>,
	TOptions extends TableDefineOptions<TFields>,
> = {
	/** The constructor signature for the model class. */
	new (data: InferShapeFromFields<TFields>): TInstance;
	/** @internal The name of the database table. */
	_tableName: string;
	/** @internal The field definitions for the table. */
	_fields: TFields;
	/** @internal The original table definition options. */
	_options: TOptions;

	/** Gets the table name for this model. */
	getTableName(): string;

	/**
	 * Creates a new record in the database.
	 * @param db - A SurrealDB connection or transaction object.
	 * @param data - The data to create the record with.
	 * @returns A promise that resolves to the created model instance.
	 * @example
	 * ```ts
	 * const user = await User.create(db, { name: 'John', email: 'john@example.com' });
	 * ```
	 */
	create<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		db: SurrealLike,
		data: CreateData<TFields>,
	): Promise<InstanceType<T>>;

	/**
	 * Creates or updates a record using `UPSERT`.
	 * If a record with the same unique index value exists, it updates that record
	 * instead of creating a new one. This leverages index-based lookup, making it
	 * much more performant than `UPDATE ... WHERE` on unique-indexed fields.
	 * @param db - A SurrealDB connection or transaction object.
	 * @param options - Upsert options including data and optional custom ID.
	 * @returns A promise that resolves to the created or updated model instance.
	 * @example
	 * ```ts
	 * // Create or update by unique email index
	 * const user = await User.upsert(db, {
	 *   data: { email: 'bob@bob.com', name: 'Bob Bobson' },
	 * });
	 *
	 * // With explicit record ID
	 * const user = await User.upsert(db, {
	 *   id: 'user:bob',
	 *   data: { email: 'bob@bob.com', name: 'Bob Bobson' },
	 * });
	 * ```
	 */
	upsert<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		db: SurrealLike,
		options: {
			data: CreateData<TFields>;
			id?: RecordId;
		},
	): Promise<InstanceType<T>>;

	/**
	 * Relates two records for an edge/relation table.
	 * @param db - A SurrealDB connection or transaction object.
	 * @param options - Relation options including `from`, `to`, and optional edge data.
	 * @returns A promise that resolves to the created edge instance.
	 * @example
	 * ```ts
	 * const follow = await Follow.relate(db, {
	 *   from: user.id,
	 *   to: post.id,
	 *   data: { since: new Date() },
	 *   orUpdate: true,
	 * });
	 * ```
	 */
	relate<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		db: SurrealLike,
		options: {
			from: RecordId;
			to: RecordId;
			data?: Record<string, unknown>;
			orUpdate?: boolean;
			id?: RecordId;
		},
	): Promise<InstanceType<T>>;

	// ============================================================================
	// INSERT - overloads
	// ============================================================================

	/**
	 * Inserts a single record using INSERT statement.
	 * @param db - A SurrealDB connection or transaction object.
	 * @param options - Insert options including data to insert.
	 * @returns A promise that resolves to the inserted model instance.
	 * @example
	 * ```ts
	 * const user = await User.insert(db, {
	 *   data: { name: 'John', email: 'john@example.com' },
	 * });
	 * ```
	 */
	insert<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		db: SurrealLike,
		options: import("./query").InsertQueryOptions<
			InferShapeFromFields<TFields>,
			CreateData<TFields>
		>,
	): Promise<InstanceType<T>>;

	/**
	 * Bulk inserts multiple records using INSERT statement.
	 * @param db - A SurrealDB connection or transaction object.
	 * @param options - Insert options including array of data to insert.
	 * @returns A promise that resolves to an array of inserted model instances.
	 * @example
	 * ```ts
	 * const users = await User.insert(db, {
	 *   data: [
	 *     { name: 'John', email: 'john@example.com' },
	 *     { name: 'Jane', email: 'jane@example.com' },
	 *   ],
	 * });
	 * ```
	 */
	insert<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		db: SurrealLike,
		options: import("./query").InsertQueryOptions<
			InferShapeFromFields<TFields>,
			CreateData<TFields>[]
		>,
	): Promise<InstanceType<T>[]>;

	// ============================================================================
	// SELECT - overloads
	// ============================================================================

	/**
	 * Selects all full model instances from the table.
	 * @param db - A SurrealDB connection or transaction object.
	 * @returns A promise that resolves to an array of all model instances.
	 * @example
	 * ```ts
	 * const allUsers = await User.select(db);
	 * ```
	 */
	select(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: SurrealLike,
	): Promise<TInstance[]>;

	/**
	 * Selects records with VALUE clause - returns array of values.
	 */
	select(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: SurrealLike,
		options: SelectQueryOptions<InferShapeFromFields<TFields>, TFields> & {
			value: string;
		},
	): Promise<unknown[]>;

	/**
	 * Selects and omits fields from a single record.
	 * Returns all fields except the omitted ones with proper type inference.
	 * @example
	 * ```ts
	 * const users = await User.select(db, { omit: { password: true } });
	 * // Type: Omit<User, 'password'>[]
	 * ```
	 */
	select<TOmit extends OmitSelect<TFields>>(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: SurrealLike,
		options: Omit<
			SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
			"omit"
		> & {
			omit: TOmit;
			only: true;
		},
	): Promise<InferOmitResult<TFields, TOmit> | undefined>;

	select<TOmit extends OmitSelect<TFields>>(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: SurrealLike,
		options: Omit<
			SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
			"omit"
		> & {
			omit: TOmit;
		},
	): Promise<InferOmitResult<TFields, TOmit>[]>;

	/**
	 * Selects records with OMIT clause using string array.
	 * Less type-safe than object format.
	 */
	select(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: SurrealLike,
		options: SelectQueryOptions<InferShapeFromFields<TFields>, TFields> & {
			omit: string[];
		},
	): Promise<Partial<InferShapeFromFields<TFields>>[]>;

	/**
	 * Selects with type-safe field selection object.
	 * Returns inferred type based on selected fields.
	 * @example
	 * ```ts
	 * // Object select with nested fields - type is inferred!
	 * const posts = await Post.select(db, {
	 *   select: { title: true, author: { name: true } }
	 * });
	 * // Type: { title: string; author: { name: string } }[]
	 *
	 * // With computed field
	 * const posts = await Post.select(db, {
	 *   select: { title: true, commentCount: typed<number>(surql`count(<-comment)`) }
	 * });
	 * // Type: { title: string; commentCount: number }[]
	 * ```
	 */
	select<TSelect extends FieldSelect<TFields>>(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: SurrealLike,
		options: Omit<
			SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
			"select"
		> & {
			select: TSelect extends DeepValidateSelect<TFields, TSelect>
				? TSelect
				: DeepValidateSelect<TFields, TSelect>;
			only: true;
		},
	): Promise<InferSelectResult<TFields, TSelect> | undefined>;

	select<TSelect extends FieldSelect<TFields>>(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: SurrealLike,
		options: Omit<
			SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
			"select"
		> & {
			select: TSelect;
		},
	): Promise<InferSelectResult<TFields, TSelect>[]>;

	/**
	 * Selects a single full model instance.
	 */
	select(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: SurrealLike,
		options: SelectQueryOptions<InferShapeFromFields<TFields>, TFields> & {
			only: true;
		},
	): Promise<TInstance | undefined>;

	/**
	 * Selects multiple full model instances with options.
	 */
	select(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: SurrealLike,
		options: SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
	): Promise<TInstance[]>;

	/**
	 * Groups records without a type-safe projection. Returns raw aggregation rows.
	 * @example
	 * ```ts
	 * const byCity = await User.select(db, { groupBy: ['city'] });
	 * ```
	 */
	select(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: SurrealLike,
		options: Omit<
			SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
			"select"
		> & {
			groupBy: (keyof TFields | string)[];
		},
	): Promise<Record<string, unknown>[]>;

	/**
	 * Counts records matching the optional filter.
	 * @param db - A SurrealDB connection or transaction object.
	 * @param options - Optional where filter and grouping.
	 * @returns A promise that resolves to the count, or grouped count results.
	 * @example
	 * ```ts
	 * const total = await User.count(db);
	 * const byCity = await User.count(db, { by: ['city'] });
	 * ```
	 */
	count(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: SurrealLike,
		options?: {
			where?:
				| BoundQuery
				| Expr
				| ((fields: FieldProxy<TFields>) => BoundQuery | Expr);
			by?: (keyof TFields | string)[];
		},
	): Promise<number | Record<string, unknown>[]>;

	// ============================================================================
	// UPDATE - overloads
	// ============================================================================

	/**
	 * Updates a single record by ID using content, merge, or replace mode.
	 * @param db - A SurrealDB connection or transaction object.
	 * @param id - The record ID to update.
	 * @param options - Update options including data and mode.
	 * @returns A promise that resolves to the updated model instance.
	 * @example
	 * ```ts
	 * // Full content replacement
	 * const user = await User.update(db, 'user:123', {
	 *   data: { name: 'Jane', email: 'jane@example.com' },
	 *   mode: 'content'
	 * });
	 *
	 * // Partial merge
	 * const user = await User.update(db, 'user:123', {
	 *   data: { name: 'Jane' },
	 *   mode: 'merge'
	 * });
	 * ```
	 */
	update<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		db: SurrealLike,
		id: RecordId,
		options: {
			data: Partial<InferShapeFromFields<TFields>>;
			mode: "content" | "merge" | "replace";
		},
	): Promise<InstanceType<T>>;

	/**
	 * Updates a single record by ID using JSON Patch operations.
	 * @param db - A SurrealDB connection or transaction object.
	 * @param id - The record ID to update.
	 * @param options - Update options including patch operations and mode.
	 * @returns A promise that resolves to the updated model instance.
	 * @example
	 * ```ts
	 * const user = await User.update(db, 'user:123', {
	 *   data: [{ op: 'replace', path: '/name', value: 'Jane' }],
	 *   mode: 'patch'
	 * });
	 * ```
	 */
	update<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		db: SurrealLike,
		id: RecordId,
		options: { data: JsonPatchOperation[]; mode: "patch" },
	): Promise<InstanceType<T>>;

	/**
	 * Bulk updates records matching a WHERE clause.
	 * @param db - A SurrealDB connection or transaction object.
	 * @param options - Update options including where filter, data, and mode.
	 * @returns A promise that resolves to an array of updated model instances.
	 * @example
	 * ```ts
	 * await User.updateMany(db, {
	 *   where: eq('active', false),
	 *   data: { active: true },
	 *   mode: 'merge',
	 * });
	 * ```
	 */
	updateMany<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		db: SurrealLike,
		options: {
			where:
				| BoundQuery
				| Expr
				| ((fields: FieldProxy<TFields>) => BoundQuery | Expr);
			data: Partial<InferShapeFromFields<TFields>>;
			mode: "content" | "merge" | "replace";
		},
	): Promise<InstanceType<T>[]>;

	// ============================================================================
	// DELETE - overloads
	// ============================================================================

	/**
	 * Deletes a single record from the database.
	 * @param db - A SurrealDB connection or transaction object.
	 * @param id - The record ID to delete.
	 * @returns A promise that resolves when the record is deleted.
	 * @example
	 * ```ts
	 * await User.delete(db, 'user:123');
	 * ```
	 */
	delete<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		db: SurrealLike,
		id: RecordId,
	): Promise<void>;

	/**
	 * Bulk deletes records matching a WHERE clause.
	 * @param db - A SurrealDB connection or transaction object.
	 * @param options - Delete options including the where filter.
	 * @returns A promise that resolves when the records are deleted.
	 * @example
	 * ```ts
	 * await User.deleteMany(db, { where: eq('active', false) });
	 * ```
	 */
	deleteMany(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: SurrealLike,
		options: {
			where:
				| BoundQuery
				| Expr
				| ((fields: FieldProxy<TFields>) => BoundQuery | Expr);
		},
	): Promise<void>;

	/**
	 * Builds a record ID range for this table.
	 * @example
	 * ```ts
	 * const users = await User.select(db, {
	 *   from: User.RangeId().from(2).toInclusive(4),
	 * });
	 * ```
	 */
	RangeId(): RangeIdStart;
};

// --- Placeholders for Any Model ---

/** A placeholder type representing any model instance, used to break circular dependencies. */
export type AnyModelInstance = ModelInstance<Record<string, unknown>>;

/** A placeholder type representing any model class, used to break circular dependencies. */
// biome-ignore lint/suspicious/noExplicitAny: Placeholder type for any model class
export type AnyModelClass = ModelStatic<any, any, any>;
