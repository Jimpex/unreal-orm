import type { ModelStatic, TableDefineOptions } from "../table/types/model";
import type { BoundQuery, Expr } from "surrealdb";
/**
 * Defines a SurrealDB permissions clause for a specific field.
 * The value for each property should be a valid SurrealQL `WHERE` clause, BoundQuery, or Expr.
 * @internal This is a low-level type. For user-facing options, see `PermissionsClause` in `src/schema/options.ts`.
 */
export interface FieldPermissionsOptions {
	/** A SurrealQL `WHERE` clause for `SELECT` permissions. */
	select?: BoundQuery | Expr;
	/** A SurrealQL `WHERE` clause for `CREATE` permissions. */
	create?: BoundQuery | Expr;
	/** A SurrealQL `WHERE` clause for `UPDATE` permissions. */
	update?: BoundQuery | Expr;
	/** A SurrealQL `WHERE` clause for `DELETE` permissions. */
	delete?: BoundQuery | Expr;
}

/**
 * Options for reference fields.
 *
 * **EXPERIMENTAL**: Requires the `record_references` experimental capability to be enabled.
 * Enable with `--allow-experimental record_references` when starting SurrealDB.
 *
 * @since SurrealDB v2.2.0
 */
export interface ReferenceOptions {
	/**
	 * Specifies the behavior when the referenced record is deleted.
	 */
	onDelete?: "IGNORE" | "UNSET" | "CASCADE" | "REJECT";
}

/**
 * Defines the options for a `record` field, which creates a standard **Record Link**.
 */
export interface RecordFieldOptions extends FieldOptions {
	/**
	 * If true or an object with options, marks this field as a `REFERENCE`.
	 * This allows the linked record to define a `references` field to see incoming links.
	 *
	 * Can be set to `true` or an object with options.
	 *
	 * **EXPERIMENTAL**: Requires the `record_references` experimental capability to be enabled.
	 * Enable with `--allow-experimental record_references` when starting SurrealDB.
	 *
	 * @since SurrealDB v2.2.0
	 */
	reference?: boolean | ReferenceOptions;
}

/**
 * Defines the common options available for all field types.
 * These are used by the `Field` builder methods.
 */
export interface FieldOptions {
	/** A SurrealQL `ASSERT` clause to enforce a constraint on the field value. */
	assert?: BoundQuery | Expr;
	/** A default value for the field, specified as a SurrealQL expression BoundQuery or Expr. */
	default?: BoundQuery | Expr;
	/** A SurrealQL `VALUE` clause to compute the field's value upon write. */
	value?: BoundQuery | Expr;
	/** If true, the field cannot be modified after creation. */
	readonly?: boolean;
	/** Field-level permissions, specified as a BoundQuery/Expr object or a `FieldPermissionsOptions` object. */
	permissions?: BoundQuery | Expr | FieldPermissionsOptions;
	/** A comment to add to the field definition in the database schema. */
	comment?: string;
}

/**
 * The internal representation of a field's complete definition.
 * This interface extends the user-facing `FieldOptions` with internal properties
 * used by the ORM to generate the schema and manage data types.
 *
 * @template T The TypeScript type of the field's value.
 * @internal
 */
export interface FieldDefinition<T = unknown> extends FieldOptions {
	/** For `object` fields, allows the object to contain fields not defined in the schema. */
	flexible?: boolean;
	/** The SurrealQL type string for the field (e.g., 'string', 'array<number>', 'record<user>'). */
	type: string;
	/** If true, the field is wrapped in `option<T>`, making it optional. */
	isOptional?: boolean;
	/** For `array` fields, the definition of the elements within the array. */
	arrayElementType?: FieldDefinition<unknown>;
	/** For `object` fields, a map defining the shape of the nested object. */
	objectSchema?: Record<string, FieldDefinition<unknown>>;
	/** For `record` fields, a thunk that returns the referenced model class to avoid circular dependencies. */
	recordTableThunk?: () => ModelStatic<
		// biome-ignore lint/suspicious/noExplicitAny: Using `any` in the thunk is a temporary workaround to break the circular dependency between models.
		any,
		Record<string, FieldDefinition<unknown>>,
		TableDefineOptions<Record<string, FieldDefinition<unknown>>>
	>;
	/** @deprecated This property is not used and will be removed. */
	recordReference?: boolean;
	/**
	 * If true, marks this field as a `REFERENCE`.
	 * This allows the linked record to define a `references` field to see incoming links.
	 * @since SurrealDB v2.2.0
	 */
	reference?: boolean;
	/** For `record` fields, the action to take when the referenced record is deleted. */
	recordOnDelete?:
		| "cascade"
		| "set null"
		| "none"
		| "IGNORE"
		| "UNSET"
		| "CASCADE"
		| "REJECT";
}
