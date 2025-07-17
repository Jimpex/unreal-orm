import type { RecordId, Surreal } from "surrealdb";
import type { FieldDefinition } from "../../field/types";
import type { SelectQueryOptions } from "./query";

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
	/** An object containing the field definitions for the table. */
	fields: TFields;
	/** The type of table, either a standard 'normal' table or a 'relation' (edge) table. */
	type?: "normal" | "relation";
	/** If true, the table will be created with `SCHEMAFULL`, enforcing the defined schema. */
	schemafull?: boolean;
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
		: // Object fields
			T extends { objectSchema: infer S }
			? { [K in keyof S]: InferFieldType<S[K] & FieldDefinition<unknown>> }
			: // Record fields
				T extends { recordTableThunk: () => infer M }
				? M extends ModelStatic<
						infer I,
						Record<string, FieldDefinition<unknown>>,
						TableDefineOptions<Record<string, FieldDefinition<unknown>>>
					>
					? T extends { recordReference: true }
						? RecordId
						: I
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
	 * Dynamic fields that are not defined in the schema but are present in the data.
	 * This is possible for schemaless tables.
	 *
	 * @type {*}
	 */

	// biome-ignore lint/suspicious/noExplicitAny: $dynamic can contain any data
	$dynamic: any;
	constructor(data: TData);
	update(db: Surreal, data: Partial<TData>): Promise<this>;
	merge(db: Surreal, data: Partial<TData>): Promise<this>;
	delete(db: Surreal): Promise<void>;
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

	// Standard static CRUD methods
	getTableName(): string;
	create<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		db: Surreal,
		data: CreateData<TFields>,
	): Promise<InstanceType<T>>;

	// Select overloads: Order matters - specific to general.

	// 1. GroupBy - result is not a model instance
	select<
		QueryOptions extends SelectQueryOptions<InferShapeFromFields<TFields>>,
	>(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: Surreal,
		options: QueryOptions & { groupBy: string[] },
	): Promise<Record<string, unknown>[]>;

	// 2. Projection (specific fields) AND only one record expected
	select<
		QueryOptions extends SelectQueryOptions<InferShapeFromFields<TFields>>,
	>(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: Surreal,
		options: QueryOptions & { select: string[]; only: true },
	): Promise<Partial<InferShapeFromFields<TFields>> | undefined>;

	// 3. Projection (specific fields) AND array of records expected
	select<
		QueryOptions extends SelectQueryOptions<InferShapeFromFields<TFields>>,
	>(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: Surreal,
		options: QueryOptions & { select: string[] },
	): Promise<Partial<InferShapeFromFields<TFields>>[]>;

	// 4. Full instance AND only one record expected (no projection)
	select<
		QueryOptions extends SelectQueryOptions<InferShapeFromFields<TFields>>,
	>(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: Surreal,
		options: QueryOptions & { only: true; select?: undefined },
	): Promise<TInstance | undefined>;

	// 5. Full instances AND array of records expected (with options, but no projection)
	select<
		QueryOptions extends SelectQueryOptions<InferShapeFromFields<TFields>>,
	>(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: Surreal,
		options: QueryOptions & { select?: undefined },
	): Promise<TInstance[]>;

	// 6. Full instances AND array of records expected (no options provided)
	select(
		this: ModelStatic<TInstance, TFields, TOptions>,
		db: Surreal,
	): Promise<TInstance[]>;

	update<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		db: Surreal,
		id: RecordId,
		data: Partial<InferShapeFromFields<TFields>>,
	): Promise<InstanceType<T>>;

	delete<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		db: Surreal,
		id: RecordId,
	): Promise<void>;

	merge<T extends ModelStatic<TInstance, TFields, TOptions>>(
		this: T,
		db: Surreal,
		id: RecordId,
		data: Partial<InferShapeFromFields<TFields>>,
	): Promise<InstanceType<T>>;
};

// --- Placeholders for Any Model ---

/** A placeholder type representing any model instance, used to break circular dependencies. */
// biome-ignore lint/suspicious/noExplicitAny: Placeholder type for circular dependencies requires 'any'.
export type AnyModelInstance = ModelInstance<any>;

/** A placeholder type representing any model class, used to break circular dependencies. */
export type AnyModelClass =
	// biome-ignore lint/suspicious/noExplicitAny: Placeholder type for circular dependencies requires 'any'.
	ModelStatic<any, any, any>;
