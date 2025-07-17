import type { RecordId } from "surrealdb";
import type {
	PermissionsClause,
	TablePermissionsOptions,
	FieldPermissionsOptions,
} from "../options";
import type { FieldDefinition, FieldOptions } from "./definitions";
import type {
	AnyModelClass,
	InferFieldType,
	InferShapeFromFields,
} from "../../define/table/types/model";

/**
 * Options for defining an array field.
 */
export interface ArrayFieldOptions<T> extends FieldOptions {
	/** The maximum number of elements allowed in the array. */
	max?: number;
}

/**
 * Options for defining an object field.
 */
export interface ObjectFieldOptions extends FieldOptions {
	/** If true, allows the object to contain fields not defined in the schema. */
	flexible?: boolean;
}

/**
 * Options for defining a custom field type.
 */
export interface CustomFieldOptions extends ObjectFieldOptions {}

/**
 * Options for defining a record link field.
 */
export interface RecordFieldOptions extends FieldOptions {
	/** The action to take when the referenced record is deleted. */
	onDelete?: "cascade" | "set null" | "none";
}

/**
 * A factory object for creating field definitions for table schemas.
 */
export const Field = {
	/**
	 * Defines a `string` field.
	 * @param options Standard field options.
	 * @example Field.string({ assert: '$value.length > 0' })
	 */
	string(options: FieldOptions = {}): FieldDefinition<string> {
		return { ...options, type: "string" };
	},
	/**
	 * Defines a `number` field (integer or float).
	 * @param options Standard field options.
	 * @example Field.number({ default: 0 })
	 */
	number(options: FieldOptions = {}): FieldDefinition<number> {
		return { ...options, type: "number" };
	},
	/**
	 * Defines a `boolean` field.
	 * @param options Standard field options.
	 * @example Field.bool({ default: false })
	 */
	bool(options: FieldOptions = {}): FieldDefinition<boolean> {
		return { ...options, type: "bool" };
	},
	/**
	 * Defines a `datetime` field.
	 * @param options Standard field options.
	 * @example Field.datetime({ default: 'time::now()' })
	 */
	datetime(options: FieldOptions = {}): FieldDefinition<Date> {
		return { ...options, type: "datetime" };
	},
	/**
	 * Defines a custom field type using a specific SurrealDB type string.
	 * This is useful for types not built-in to the ORM, like `duration` or `geometry`.
	 * @param typeString The SurrealQL type string (e.g., 'duration', 'geometry<point>').
	 * @param options Standard field options.
	 * @example Field.custom<number>('duration')
	 */
	custom<T>(
		typeString: string,
		options: CustomFieldOptions = {},
	): FieldDefinition<T> {
		return { ...options, type: typeString, flexible: options.flexible };
	},
	/**
	 * Makes a field optional. In SurrealDB, fields are required by default.
	 * Wrapping a field definition with `option()` makes it optional.
	 * @param fieldDefinition The field definition to make optional.
	 * @example bio: Field.option(Field.string())
	 */
	option<FD extends FieldDefinition<unknown>>(
		fieldDefinition: FD,
	): FieldDefinition<InferFieldType<FD> | undefined> {
		return {
			...fieldDefinition,
			get type() {
				return `option<${fieldDefinition.type}>`;
			},
			isOptional: true,
		};
	},
	/**
	 * Defines an `array` field.
	 * @param element The field definition for the elements within the array.
	 * @param options Options for the array field, such as `max` size.
	 * @example
	 * ```ts
	 * // An array of strings
	 * tags: Field.array(Field.string()),
	 *
	 * // An array of objects
	 * items: Field.array(Field.object({
	 *   name: Field.string(),
	 *   quantity: Field.number(),
	 * }))
	 * ```
	 */
	array<TElementDef extends FieldDefinition<unknown>>(
		element: TElementDef,
		options: ArrayFieldOptions<InferFieldType<TElementDef>> = {},
	): FieldDefinition<Array<InferFieldType<TElementDef>>> {
		return {
			...options,
			get type() {
				return options.max
					? `array<${element.type}, ${options.max}>`
					: `array<${element.type}>`;
			},
			arrayElementType: element,
		};
	},
	/**
	 * Defines an `object` field with a nested schema.
	 * @param schema An object defining the shape of the nested object.
	 * @param options Options for the object field, such as `flexible`.
	 * @example
	 * ```ts
	 * meta: Field.object({
	 *   views: Field.number(),
	 *   lastVisited: Field.datetime(),
	 * })
	 * ```
	 */
	object<TSchema extends Record<string, FieldDefinition<unknown>>>(
		schema: TSchema,
		options: ObjectFieldOptions = {},
	): FieldDefinition<InferShapeFromFields<TSchema>> {
		return {
			...options,
			type: "object",
			objectSchema: schema,
			flexible: options.flexible,
		};
	},
	/**
	 * Defines a `record` field, representing a link to another table.
	 * @param tableClassThunk A thunk returning the model class being referenced to prevent circular dependencies.
	 * @param options Options for the record field, such as `onDelete` behavior.
	 * @example author: Field.record(() => User)
	 */
	record<TModel extends AnyModelClass>(
		tableClassThunk: () => TModel,
		options: RecordFieldOptions = {},
	): FieldDefinition<InstanceType<TModel> | RecordId<TModel["_tableName"]>> {
		return {
			...options,
			get type() {
				const tableClass = tableClassThunk();
				return `record<${tableClass._tableName}>`;
			},
			recordTableThunk: tableClassThunk,
		};
	},
};
