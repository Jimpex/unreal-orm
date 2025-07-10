import type { Surreal, RecordId } from "surrealdb";

/** Represents a generic function with unknown arguments and return type */
// // biome-ignore lint/suspicious/noExplicitAny: Generic function type requires 'any'.
// export type AnyFunction = (...args: any[]) => any;

// --- Field Definitions ---

/**
 * Common options accepted by every `Field.*` builder.
 *
 * These map directly to SurrealDB field attributes and let you configure
 * validation, defaults, transformations, permissions, and documentation —
 * all with full type-safety and IntelliSense.
 *
 * @example Add validation and a default value
 * ```ts
 * title: Field.string({
 *   assert: '$value.length > 3',
 *   default: "'Untitled'",
 * })
 * ```
 *
 * @example Make a field readonly and always store lower-cased content
 * ```ts
 * email: Field.string({
 *   readonly: true,
 *   value: 'string::lowercase($value)',
 * })
 * ```
 */
export interface FieldOptions {
	/**
	 * SurrealQL assertion that must evaluate to `true` on INSERT/UPDATE.
	 *
	 * Example: `'$value > 0'` or `$value INSIDE ['draft','published']`.
	 */
	assert?: string;

	/**
	 * Default value expression evaluated server-side when the field is omitted.
	 * Can reference SurrealDB functions like `time::now()`.
	 */
	default?: string;

	/**
	 * Transformation expression that rewrites the stored value.
	 * The special `$value` placeholder refers to the incoming data.
	 */
	value?: string;

	/**
	 * Mark the field as read-only after creation (SurrealDB `READONLY`).
	 */
	readonly?: boolean;

	/**
	 * Table/field-level permissions clause or shorthand object.
	 *
	 * @example Shorthand string syntax
	 * ```ts
	 * Field.string({
	 *   permissions: 'FOR select FULL, FOR update WHERE $auth.id = user, FOR delete NONE',
	 * })
	 * ```
	 *
	 * @example Object syntax
	 * ```ts
	 * Field.string({
	 *   permissions: {
	 *     select: 'FULL',
	 *     update: 'WHERE $auth.id = user',
	 *     delete: 'NONE',
	 *   },
	 * })
	 * ```
	 */
	permissions?: string | FieldPermissionsOptions;

	/**
	 * Free-text comment stored alongside the field definition.
	 */
	comment?: string;
}

/**
 * Represents the definition of a single field in a table schema.
 * @template T The TypeScript type this field maps to.
 */
export interface FieldDefinition<T = unknown> extends FieldOptions {
	/**
	 * If true, generates SurrealQL 'FLEXIBLE' for object/custom fields. Only set by Field.object/custom builders.
	 */
	flexible?: boolean;

	type: string; // Internal representation of the SurrealDB type (e.g., 'string', 'number', 'record<user>')
	// T (the generic parameter) represents the TypeScript type. No explicit 'tsType' property is needed at runtime.
	isOptional?: boolean; // True if the field is optional (e.g. Field.option())
	// Add other specific properties for different field types as needed (e.g., for array, object, record)
	arrayElementType?: FieldDefinition<unknown>; // For Field.array()
	objectSchema?: Record<string, FieldDefinition<unknown>>; // For Field.object()
	// biome-ignore lint/suspicious/noExplicitAny: 'any' is used as a placeholder for generic args of ModelStatic in this context.
	recordTableThunk?: () => ModelStatic<any, any>; // For Field.record(), stores a thunk to resolve the model class lazily.
	recordReference?: boolean; // For Field.record()
	recordOnDelete?: "cascade" | "set null" | "none"; // For Field.record()
}

// --- Table Schema and Configuration ---

/**
 * Fine-grained access control expressions for SurrealDB **PERMISSIONS** clauses.
 * Each property corresponds to a CRUD action and accepts either:
 *   • `FULL`, `NONE`, etc. (Surreal shorthand)
 *   • A raw SurrealQL expression starting with `WHERE`.
 *
 * If you prefer the raw string syntax you can skip this object entirely and pass
 * a pre-formatted string to `permissions` instead.
 *
 * @example Restrict updates and deletes
 * ```ts
 * permissions: {
 *   select: 'FULL',
 *   update: 'WHERE $auth.id = user',
 *   delete: 'NONE',
 * }
 * ```
 */
export interface PermissionsClause {
	/** Conditions for `SELECT` statements */
	select?: string;
	/** Conditions for `CREATE` / `INSERT` operations */
	create?: string;
	/** Conditions for `UPDATE` operations */
	update?: string;
	/** Conditions for `DELETE` operations */
	delete?: string;
}

export type FieldPermissionsOptions = PermissionsClause;
export type TablePermissionsOptions = PermissionsClause;

/**
 * Declarative definition of a SurrealDB `DEFINE INDEX` statement.
 * Supply these inside `Table.normal({... indexes: [...] })`.
 *
 * @example Unique index on `email`
 * ```ts
 * indexes: [
 *   { name: 'idx_user_email', fields: ['email'], unique: true },
 * ]
 * ```
 */
export interface IndexDefinition {
	/** Index identifier (must be unique within the namespace) */
	name: string;
	/** One or more field names to index */
	fields: string[];
	/** Mark index as UNIQUE to prevent duplicates */
	unique?: boolean;
	/** Full-text analyzer name (only for `SEARCH` indexes) */
	analyzer?: string;
	/** Optional description stored with the index */
	comment?: string;
}

/**
 * Configuration for SurrealDB **CHANGEFEED** – real-time change streams.
 */
export interface ChangefeedConfig {
	/** Retention period, e.g. `'30d'`, `'24h'`, `'1w'` */
	duration: string;
	/** Include full *before* document in each change event */
	includeOriginal?: boolean;
}

/** Core options for defining a table */
// --- Table API Option Types ---

// For normal tables
/**
 * Options passed to `Table.normal()` – the workhorse for typical record tables.
 *
 * @typeParam TFields Field definitions built with `Field.*` helpers.
 */
export interface NormalTableOptions<
	TFields extends Record<string, FieldDefinition<unknown>>,
> {
	/** Table name (lower-case, no spaces) */
	name: string;
	/** Map of column names to `FieldDefinition` objects */
	fields: TFields;
	/** Enable SurrealDB `SCHEMAFULL` mode (strict columns) */
	schemafull?: boolean;
	/** Top-level permissions applied to the table itself */
	permissions?: TablePermissionsOptions;
	/** Indexes created alongside the table */
	indexes?: IndexDefinition[];
	/** Real-time changefeed configuration */
	changefeed?: ChangefeedConfig;
	/** Comment stored with the table definition */
	comment?: string;
	// No 'type' field; Table.normal always sets type: 'normal'
}

// For relation tables: must have 'in' and 'out', but allow others
export type RelationTableFields<
	TIn extends FieldDefinition<unknown>,
	TOut extends FieldDefinition<unknown>,
	TOther extends Record<string, FieldDefinition<unknown>> = Record<
		string,
		never
	>,
> = TOther & { in: TIn; out: TOut };

/**
 * Options for `Table.relation()` – creates an *edge table* with mandatory
 * `in` and `out` record references plus any additional fields you supply.
 */
export interface RelationTableOptions<
	TIn extends FieldDefinition<unknown>,
	TOut extends FieldDefinition<unknown>,
	TOther extends Record<string, FieldDefinition<unknown>> = Record<
		string,
		never
	>,
> {
	/** Edge table name */
	name: string;
	/** Must include `in` and `out` record fields plus any extras */
	fields: RelationTableFields<TIn, TOut, TOther>;
	/** Strict schema enforcement */
	schemafull?: boolean;
	/** Permissions inherited by all fields */
	permissions?: TablePermissionsOptions;
	/** Optional indexes */
	indexes?: IndexDefinition[];
	/** Changefeed retention */
	changefeed?: ChangefeedConfig;
	/** Comment stored with the table definition */
	comment?: string;
	// No 'type' field; Table.relation always sets type: 'relation'
}

// --- End Table API Option Types ---

export interface TableDefineOptions<
	TFields extends Record<string, FieldDefinition<unknown>>,
> {
	name: string; // Table name in SurrealDB
	fields: TFields;
	schemafull?: boolean;
	permissions?: TablePermissionsOptions;
	indexes?: IndexDefinition[];
	changefeed?: ChangefeedConfig;
	type?: "normal" | "relation" | string; // SurrealDB table type
	comment?: string;
}

/** Represents any table definition (used for circular dependencies in Field.record) */
export interface AnyTableDefinition
	extends TableDefineOptions<Record<string, FieldDefinition<unknown>>> {}

// --- Querying ---

export interface OrderByClause {
	field: string;
	order?: "ASC" | "DESC" | "asc" | "desc";
	collate?: boolean; // For string collation
	numeric?: boolean; // For numeric collation of strings
}

/** Options for select queries */
export interface SelectQueryOptions<TTable> {
	// TTable will be the model type
	from?: string | RecordId<string>; // The table or record to select from
	select?: (keyof TTable | string)[]; // Array of field names to select, or raw SurrealQL select statements
	where?: string; // SurrealQL WHERE clause (e.g., 'age > $minAge')
	orderBy?: OrderByClause[];
	limit?: number;
	start?: number;
	fetch?: string[]; // Array of relationship field names to fetch
	groupBy?: (keyof TTable | string)[];
	parallel?: boolean;
	timeout?: string | number; // Query timeout (e.g., '5s' or 5000ms)
	with?: string[]; // Index hints (e.g., ['idx_user_email'])
	explain?: boolean; // If true, returns query execution plan
	only?: boolean; // If true, expects a single record and returns it directly
	vars?: Record<string, unknown>; // Bind parameters for the query
}

/** Options for count queries (subset of SelectQueryOptions) */
export interface CountQueryOptions<TTable> {
	where?: string;
	groupBy?: (keyof TTable | string)[];
	parallel?: boolean;
	timeout?: string | number;
}

// --- Utility Types for Inference (Placeholders - to be refined) ---

/** Infers the basic key-value shape from field definitions, without special top-level properties like 'id' */
export type InferShapeFromFields<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = {
	[K in keyof TFields]: TFields[K]["isOptional"] extends true
		? InferFieldType<TFields[K]> | undefined
		: InferFieldType<TFields[K]>;
};

/** Infers the data shape for a table record, including the mandatory 'id' field */
export type InferTableDataFromFields<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = InferShapeFromFields<TFields> & { id: RecordId<string> };

/** Infers the TypeScript type from a single FieldDefinition */
// This will become more sophisticated, especially for records and objects
export type InferFieldType<F extends FieldDefinition<unknown>> =
	F extends FieldDefinition<infer T> ? T : never;

/** Helper to get keys of fields that are optional on creation
 * (either marked as optional or have a default value).
 */
type OptionalOnCreate<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = {
	[K in keyof TFields]: TFields[K]["isOptional"] extends true
		? K
		: TFields[K]["default"] extends undefined
			? never
			: K;
}[keyof TFields];

/** Helper to get keys of fields that are required on creation. */
type RequiredOnCreate<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = Exclude<keyof TFields, OptionalOnCreate<TFields>>;

/**
 * Represents the shape of data for creating a new record.
 * Fields with default values or marked as optional are not required.
 * The 'id' field is also optional.
 */
export type CreateData<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = {
	[K in RequiredOnCreate<TFields>]: InferFieldType<TFields[K]>;
} & {
	[K in OptionalOnCreate<TFields>]?: InferFieldType<TFields[K]>;
} & {
	id?: RecordId<string>;
};

/** Represents the shape of data for updating a record (all fields are optional) */
export type UpdateData<TTableData extends { id: RecordId }> = Partial<
	Omit<TTableData, "id">
>;

/** Represents a fully instantiated model instance, including methods */
export abstract class BaseTable<TData extends Record<string, unknown>> {
	id: RecordId;

	constructor(data: TData & { id?: RecordId }) {
		// data should conform to TData, id is part of TData via InferTableDataFromFields
		// biome-ignore lint/suspicious/noExplicitAny: Dynamic assignment from DB data.
		Object.assign(this as any, data);
		// Ensure 'id' is set. The concrete class (e.g., via its static create method)
		// is responsible for generating and providing the ID.
		if (data.id === undefined) {
			// This should ideally not happen if concrete classes fulfill the contract
			// of providing an ID, e.g., through their static create method.
			throw new Error(
				"BaseTable constructor requires an 'id' in the data argument.",
			);
		}
		this.id = data.id;
	}

	async update(
		db: Surreal,
		data: UpdateData<TData & { id: RecordId }>,
	): Promise<void> {
		if (!this.id) throw new Error("Instance must have an ID to be updated.");
		// biome-ignore lint/suspicious/noExplicitAny: Surreal's update method can take partial data.
		await db.update(this.id, data as any);
		// biome-ignore lint/suspicious/noExplicitAny: Dynamic assignment from DB data.
		Object.assign(this as any, data);
	}

	async delete(db: Surreal): Promise<void> {
		if (!this.id) throw new Error("Instance must have an ID to be deleted.");
		await db.delete(this.id);
	}

	// Allow direct property access for fields
	// biome-ignore lint/suspicious/noExplicitAny: Index signature for dynamic properties.
	[key: string]: any;
}

/**
 * Base type for an instance of a model (a single record).
 * @template TData The shape of the record's data (fields).
 */
export type ModelInstance<TData extends Record<string, unknown>> =
	BaseTable<TData> & TData;

/**
 * Represents the static side of a model class (the class itself).
 * @template TInstance The type of an instance of this model.
 * @template TFields The field definitions for this model.
 */
export type ModelStatic<
	// biome-ignore lint/suspicious/noExplicitAny: 'any' is used as a placeholder for generic args of ModelInstance in this context.
	TInstance extends ModelInstance<any>,
	TFields extends Record<string, FieldDefinition<unknown>>,
> = {
	new (data: InferTableDataFromFields<TFields>): TInstance; // Constructor signature
	_tableName: string;
	_fields: TFields;
	_options: TableDefineOptions<TFields>;

	// Standard static CRUD methods
	getTableName(): string;
	create(
		this: ModelStatic<TInstance, TFields>,
		db: Surreal,
		data: CreateData<TFields>,
	): Promise<TInstance>;

	// Select overloads: Order matters - specific to general.

	// 1. Projection (specific fields) AND only one record expected
	select<
		QueryOptions extends SelectQueryOptions<InferTableDataFromFields<TFields>>,
	>(
		this: ModelStatic<TInstance, TFields>,
		db: Surreal,
		options: QueryOptions & { select: string[]; only: true },
	): Promise<Record<string, unknown> | undefined>;

	// 2. Projection (specific fields) AND array of records expected
	select<
		QueryOptions extends SelectQueryOptions<InferTableDataFromFields<TFields>>,
	>(
		this: ModelStatic<TInstance, TFields>,
		db: Surreal,
		options: QueryOptions & { select: string[] },
	): Promise<Record<string, unknown>[]>;

	// 3. Full instance AND only one record expected (no projection)
	select<
		QueryOptions extends SelectQueryOptions<InferTableDataFromFields<TFields>>,
	>(
		this: ModelStatic<TInstance, TFields>,
		db: Surreal,
		options: QueryOptions & { only: true; select?: undefined },
	): Promise<TInstance | undefined>;

	// 4. Full instances AND array of records expected (with options, but no projection)
	select<
		QueryOptions extends SelectQueryOptions<InferTableDataFromFields<TFields>>,
	>(
		this: ModelStatic<TInstance, TFields>,
		db: Surreal,
		options: QueryOptions & { select?: undefined },
	): Promise<TInstance[]>;

	// 5. Full instances AND array of records expected (no options provided)
	select(
		this: ModelStatic<TInstance, TFields>,
		db: Surreal,
	): Promise<TInstance[]>;
};

// Placeholder for the type of class returned by defineTable
// This is what Field.record() will expect as an argument for table linking.

// biome-ignore lint/suspicious/noExplicitAny: Placeholder type for circular dependencies requires 'any'.
export type AnyModelInstance = ModelInstance<any>;

export type AnyModelClass = {
	// biome-ignore lint/suspicious/noExplicitAny: Constructor for a generic model class accepts 'any' data.
	new (data: any): AnyModelInstance;
	_tableName: string;
	_fields: Record<string, FieldDefinition<unknown>>; // Needs to be Record<string, FieldDefinition<unknown>> not <any>
	// biome-ignore lint/suspicious/noExplicitAny: Options for a generic model class use 'any' for field/method shapes.
	_options: TableDefineOptions<any>;
	getTableName(): string;
	// biome-ignore lint/suspicious/noExplicitAny: Create for a generic model class accepts 'any' data and returns 'any' promise.
	create(db: Surreal, data: any): Promise<any>;
	// biome-ignore lint/suspicious/noExplicitAny: Select for a generic model class accepts 'any' options and returns 'any' promise.
	select(db: Surreal, options?: any): Promise<any>;
};
