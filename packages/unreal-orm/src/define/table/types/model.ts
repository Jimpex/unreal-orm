import type { RecordId, Surreal } from "surrealdb";
import type { FieldDefinition } from "../../../schema/field-definitions/definitions";
import type { SelectQueryOptions } from "./query";

export type TableDefineOptions<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = {
	name: string;
	fields: TFields;
	type?: "normal" | "relation";
	schemafull?: boolean;
};

// --- Type Inference Helpers ---

export type InferShapeFromFields<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = {
	-readonly [K in keyof TFields]: InferFieldType<TFields[K]>;
};

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

export type CreateData<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = Partial<InferShapeFromFields<TFields>>;

// --- Model Class and Instance Types ---

export declare class BaseTable<TData extends Record<string, unknown>> {
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
	delete(db: Surreal): Promise<void>;
}

export type ModelInstance<TData extends Record<string, unknown>> =
	BaseTable<TData> & TData;

export type ModelStatic<
	TInstance extends ModelInstance<InferShapeFromFields<TFields>>,
	TFields extends Record<string, FieldDefinition<unknown>>,
	TOptions extends TableDefineOptions<TFields>,
> = {
	new (data: InferShapeFromFields<TFields>): TInstance; // Constructor signature
	_tableName: string;
	_fields: TFields;
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
};

// --- Placeholders for Any Model ---

// biome-ignore lint/suspicious/noExplicitAny: Placeholder type for circular dependencies requires 'any'.
export type AnyModelInstance = ModelInstance<any>;

export type AnyModelClass =
	// biome-ignore lint/suspicious/noExplicitAny: Placeholder type for circular dependencies requires 'any'.
	ModelStatic<any, any, any>;
