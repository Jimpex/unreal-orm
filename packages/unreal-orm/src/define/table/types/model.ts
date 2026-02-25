import type { RecordId, Surreal, BoundQuery, Expr } from "surrealdb";
import type { FieldDefinition } from "../../field/types";
import type { SelectQueryOptions, JsonPatchOperation } from "./query";
import type {
	FieldSelect,
	InferSelectResult,
	SelectOption,
	OmitSelect,
	InferOmitResult,
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
	| "create"
	| "select"
	| "update"
	| "delete"
	| "query"
	| "relate"
> & Partial<Pick<Surreal, "connect" | "close">>;

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
		? Array<InferFieldType<E & FieldDefinition<unknown>>>
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
					? { [K in keyof S]: InferFieldType<S[K] & FieldDefinition<unknown>> }
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
> = Partial<InferShapeFromFields<TFields>>;

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
	// UPDATE - Implicit DB overloads (instance methods)
	// ============================================================================

	/**
	 * Updates the current record instance using content, merge, or replace mode (implicit db).
	 * @param options - Update options including data and mode.
	 * @returns A promise that resolves to the updated model instance.
	 * @example
	 * ```ts
	 * await user.update({ data: { name: 'Jane' }, mode: 'merge' });
	 * ```
	 */
	update(options: {
		data: Partial<TData>;
		mode: "content" | "merge" | "replace";
	}): Promise<this>;

	/**
	 * Updates the current record instance using JSON Patch operations (implicit db).
	 * @param options - Update options including patch operations and mode.
	 * @returns A promise that resolves to the updated model instance.
	 */
	update(options: { data: JsonPatchOperation[]; mode: "patch" }): Promise<this>;

	// ============================================================================
	// UPDATE - Explicit DB overloads (instance methods)
	// ============================================================================

	/**
	 * Updates the current record instance using content, merge, or replace mode (explicit db).
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
	 * Updates the current record instance using JSON Patch operations (explicit db).
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
	// DELETE - Implicit and Explicit DB overloads (instance methods)
	// ============================================================================

	/**
	 * Deletes the current record instance from the database (implicit db).
	 * @returns A promise that resolves when the record is deleted.
	 * @example
	 * ```ts
	 * await user.delete();
	 * ```
	 */
	delete(): Promise<void>;

	/**
	 * Deletes the current record instance from the database (explicit db).
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
	 * Creates a new record in the database (implicit db).
	 * Uses the globally configured database connection.
	 * @param data - The data to create the record with.
	 * @returns A promise that resolves to the created model instance.
	 * @example
	 * ```ts
	 * const user = await User.create({ name: 'John', email: 'john@example.com' });
	 * ```
	 */
	create<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		data: CreateData<TFields>,
	): Promise<InstanceType<T>>;

	/**
	 * Creates a new record in the database (explicit db).
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

	// ============================================================================
	// INSERT - Implicit DB overloads (uses configured default database)
	// ============================================================================

	/**
	 * Inserts a single record using INSERT statement (implicit db).
	 * @param options - Insert options including data to insert.
	 * @returns A promise that resolves to the inserted model instance.
	 * @example
	 * ```ts
	 * const user = await User.insert({
	 *   data: { name: 'John', email: 'john@example.com' },
	 * });
	 * ```
	 */
	insert<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		options: import("./query").InsertQueryOptions<
			InferShapeFromFields<TFields>,
			CreateData<TFields>
		>,
	): Promise<InstanceType<T>>;

	/**
	 * Bulk inserts multiple records using INSERT statement (implicit db).
	 * @param options - Insert options including array of data to insert.
	 * @returns A promise that resolves to an array of inserted model instances.
	 * @example
	 * ```ts
	 * const users = await User.insert({
	 *   data: [
	 *     { name: 'John', email: 'john@example.com' },
	 *     { name: 'Jane', email: 'jane@example.com' },
	 *   ],
	 * });
	 * ```
	 */
	insert<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		options: import("./query").InsertQueryOptions<
			InferShapeFromFields<TFields>,
			CreateData<TFields>[]
		>,
	): Promise<InstanceType<T>[]>;

	// ============================================================================
	// INSERT - Explicit DB overloads
	// ============================================================================

	/**
	 * Inserts a single record using INSERT statement (explicit db).
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
	 * Bulk inserts multiple records using INSERT statement (explicit db).
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
	// SELECT - Implicit DB overloads (uses configured default database)
	// ============================================================================

	/**
	 * Selects all full model instances from the table (implicit db).
	 * @returns A promise that resolves to an array of all model instances.
	 * @example
	 * ```ts
	 * const allUsers = await User.select();
	 * ```
	 */
	select(this: ModelStatic<TInstance, TFields, TOptions>): Promise<TInstance[]>;

	/**
	 * Selects records with GROUP BY aggregation (implicit db).
	 */
	select(
		this: ModelStatic<TInstance, TFields, TOptions>,
		options: SelectQueryOptions<InferShapeFromFields<TFields>, TFields> & {
			groupBy: string[];
		},
	): Promise<Record<string, unknown>[]>;

	/**
	 * Selects records with VALUE clause - returns array of values (implicit db).
	 */
	select(
		this: ModelStatic<TInstance, TFields, TOptions>,
		options: SelectQueryOptions<InferShapeFromFields<TFields>, TFields> & {
			value: string;
		},
	): Promise<unknown[]>;

	/**
	 * Selects records with OMIT clause (implicit db).
	 */
	select(
		this: ModelStatic<TInstance, TFields, TOptions>,
		options: SelectQueryOptions<InferShapeFromFields<TFields>, TFields> & {
			omit: string[];
		},
	): Promise<Partial<InferShapeFromFields<TFields>>[]>;

	/**
	 * Selects with type-safe field selection object (implicit db).
	 * Returns inferred type based on selected fields.
	 */
	select<TSelect extends FieldSelect<TFields>>(
		this: ModelStatic<TInstance, TFields, TOptions>,
		options: Omit<
			SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
			"select"
		> & {
			select: TSelect;
		},
	): Promise<InferSelectResult<TFields, TSelect>[]>;

	/**
	 * Selects a single full model instance (implicit db).
	 */
	select(
		this: ModelStatic<TInstance, TFields, TOptions>,
		options: SelectQueryOptions<InferShapeFromFields<TFields>, TFields> & {
			only: true;
		},
	): Promise<TInstance | undefined>;

	/**
	 * Selects multiple full model instances with options (implicit db).
	 */
	select(
		this: ModelStatic<TInstance, TFields, TOptions>,
		options: SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
	): Promise<TInstance[]>;

	// ============================================================================
	// SELECT - Explicit DB overloads
	// ============================================================================

	/**
	 * Selects all full model instances from the table (explicit db).
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
	 * Selects records with GROUP BY aggregation (explicit db).
	 */
	select(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: SurrealLike,
		options: SelectQueryOptions<InferShapeFromFields<TFields>, TFields> & {
			groupBy: string[];
		},
	): Promise<Record<string, unknown>[]>;

	/**
	 * Selects records with VALUE clause - returns array of values (explicit db).
	 */
	select(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: SurrealLike,
		options: SelectQueryOptions<InferShapeFromFields<TFields>, TFields> & {
			value: string;
		},
	): Promise<unknown[]>;

	/**
	 * Selects records with type-safe OMIT clause (explicit db).
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
		},
	): Promise<InferOmitResult<TFields, TOmit>[]>;

	/**
	 * Selects records with OMIT clause using string array (explicit db).
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
	 * Selects with type-safe field selection object (explicit db).
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
			select: TSelect;
		},
	): Promise<InferSelectResult<TFields, TSelect>[]>;

	/**
	 * Selects a single full model instance (explicit db).
	 */
	select(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: SurrealLike,
		options: SelectQueryOptions<InferShapeFromFields<TFields>, TFields> & {
			only: true;
		},
	): Promise<TInstance | undefined>;

	/**
	 * Selects multiple full model instances with options (explicit db).
	 */
	select(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: SurrealLike,
		options: SelectQueryOptions<InferShapeFromFields<TFields>, TFields>,
	): Promise<TInstance[]>;

	// ============================================================================
	// UPDATE - Implicit DB overloads
	// ============================================================================

	/**
	 * Updates a record using content, merge, or replace mode (implicit db).
	 * @param id - The record ID to update.
	 * @param options - Update options including data and mode.
	 * @returns A promise that resolves to the updated model instance.
	 */
	update<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		id: RecordId,
		options: {
			data: Partial<InferShapeFromFields<TFields>>;
			mode: "content" | "merge" | "replace";
		},
	): Promise<InstanceType<T>>;

	/**
	 * Updates a record using JSON Patch operations (implicit db).
	 * @param id - The record ID to update.
	 * @param options - Update options including patch operations and mode.
	 * @returns A promise that resolves to the updated model instance.
	 */
	update<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		id: RecordId,
		options: { data: JsonPatchOperation[]; mode: "patch" },
	): Promise<InstanceType<T>>;

	// ============================================================================
	// UPDATE - Explicit DB overloads
	// ============================================================================

	/**
	 * Updates a record using content, merge, or replace mode (explicit db).
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
	 * Updates a record using JSON Patch operations (explicit db).
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

	// ============================================================================
	// DELETE - Implicit DB overload
	// ============================================================================

	/**
	 * Deletes a record from the database (implicit db).
	 * @param id - The record ID to delete.
	 * @returns A promise that resolves when the record is deleted.
	 * @example
	 * ```ts
	 * await User.delete('user:123');
	 * ```
	 */
	delete<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		id: RecordId,
	): Promise<void>;

	// ============================================================================
	// DELETE - Explicit DB overload
	// ============================================================================

	/**
	 * Deletes a record from the database (explicit db).
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
};

// --- Placeholders for Any Model ---

/** A placeholder type representing any model instance, used to break circular dependencies. */
export type AnyModelInstance = ModelInstance<Record<string, unknown>>;

/** A placeholder type representing any model class, used to break circular dependencies. */
// biome-ignore lint/suspicious/noExplicitAny: Placeholder type for any model class
export type AnyModelClass = ModelStatic<any, any, any>;
