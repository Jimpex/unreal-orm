import type {
	ModelStatic,
	TableDefineOptions,
} from "../../define/table/types/model";

/**
 * Defines a SurrealDB permissions clause for a specific field.
 * The value for each property should be a valid SurrealQL `WHERE` clause.
 * @internal This is a low-level type. For user-facing options, see `PermissionsClause` in `src/schema/options.ts`.
 */
export interface FieldPermissionsOptions {
	/** A SurrealQL `WHERE` clause for `SELECT` permissions. */
	select?: string;
	/** A SurrealQL `WHERE` clause for `CREATE` permissions. */
	create?: string;
	/** A SurrealQL `WHERE` clause for `UPDATE` permissions. */
	update?: string;
	/** A SurrealQL `WHERE` clause for `DELETE` permissions. */
	delete?: string;
}

/**
 * Defines the common options available for all field types.
 * These are used by the `Field` builder methods.
 */
export interface FieldOptions {
	/** A SurrealQL `ASSERT` clause to enforce a constraint on the field value. */
	assert?: string;
	/** A default value for the field, specified as a SurrealQL expression string. */
	default?: string;
	/** A SurrealQL `VALUE` clause to compute the field's value upon write. */
	value?: string;
	/** If true, the field cannot be modified after creation. */
	readonly?: boolean;
	/** Field-level permissions, specified as a raw string or a `FieldPermissionsOptions` object. */
	permissions?: string | FieldPermissionsOptions;
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
	/** For `record` fields, the action to take when the referenced record is deleted. */
	recordOnDelete?: "cascade" | "set null" | "none";
}
