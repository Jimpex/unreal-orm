import type {
	Decimal,
	Duration,
	Geometry,
	GeometryCollection,
	GeometryLine,
	GeometryMultiLine,
	GeometryMultiPoint,
	GeometryMultiPolygon,
	GeometryPoint,
	GeometryPolygon,
	RecordId,
	Uuid,
} from "surrealdb";
import type { FieldDefinition, FieldOptions } from "./types";
import type {
	AnyModelClass,
	InferFieldType,
	InferShapeFromFields,
} from "../table/types/model";

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
 * Defines the options for a `record` field, which creates a standard **Record Link**.
 */
export interface RecordFieldOptions extends FieldOptions {}

/**
 * Defines the specific geometric type for a `geometry` field.
 * `feature` can be used as a wildcard to allow any geometry type.
 */
export type GeometryType =
	| "point"
	| "linestring"
	| "polygon"
	| "multipoint"
	| "multilinestring"
	| "multipolygon"
	| "collection"
	| "feature";

/**
 * Maps a `GeometryType` string to its corresponding SurrealDB `Geometry*` type.
 * @internal
 */
export type GeometryTypeMap = {
	point: GeometryPoint;
	linestring: GeometryLine;
	polygon: GeometryPolygon;
	multipoint: GeometryMultiPoint;
	multilinestring: GeometryMultiLine;
	multipolygon: GeometryMultiPolygon;
	collection: GeometryCollection;
	feature: Geometry; // The generic fallback type
};

/**
 * A factory object for creating field definitions for table schemas.
 */
export const Field = {
	/**
	 * Defines an `any` field, which can store any data type.
	 * @param options Options for the any field.
	 * @example
	 * ```ts
	 * flexibleData: Field.any()
	 * ```
	 */
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	any(options: FieldOptions = {}): FieldDefinition<any> {
		return {
			...options,
			type: "any",
		};
	},
	/**
	 * Defines a `bytes` field for storing binary data.
	 * @param options Options for the bytes field.
	 * @example
	 * ```ts
	 * avatar: Field.bytes()
	 * ```
	 */
	bytes(options: FieldOptions = {}): FieldDefinition<ArrayBuffer> {
		return {
			...options,
			type: "bytes",
		};
	},
	/**
	 * Defines a `geometry` field for storing GeoJSON data.
	 * @param type The specific geometry type.
	 * @param options Options for the geometry field.
	 * @example
	 * ```ts
	 * // A single point
	 * location: Field.geometry('point'),
	 * ```
	 */
	geometry<T extends GeometryType>(
		type: T,
		options: FieldOptions = {},
	): FieldDefinition<GeometryTypeMap[T]> {
		return {
			...options,
			get type() {
				if (type === "feature") {
					return "geometry";
				}
				return `geometry<${type}>`;
			},
		} as FieldDefinition<GeometryTypeMap[T]>;
	},
	/**
	 * Defines a `duration` field for storing time durations.
	 * @param options Options for the duration field.
	 * @example
	 * ```ts
	 * ttl: Field.duration()
	 * ```
	 */
	duration(options: FieldOptions = {}): FieldDefinition<Duration> {
		return {
			...options,
			type: "duration",
		};
	},

	/**
	 * Defines a `uuid` field.
	 * @param options Options for the uuid field.
	 * @example
	 * ```ts
	 * uniqueId: Field.uuid()
	 * ```
	 */
	uuid(options: FieldOptions = {}): FieldDefinition<Uuid> {
		return {
			...options,
			type: "uuid",
		};
	},

	/**
	 * Defines a `string` field.
	 * @param options Standard field options.
	 * @example Field.string({ assert: '$value.length > 0' })
	 */
	string(options: FieldOptions = {}): FieldDefinition<string> {
		return { ...options, type: "string" };
	},
	/**
	 * Defines a `decimal` field for high-precision numbers.
	 * @param options Options for the decimal field.
	 * @example
	 * ```ts
	 * balance: Field.decimal()
	 * ```
	 */
	decimal(options: FieldOptions = {}): FieldDefinition<Decimal> {
		return {
			...options,
			type: "decimal",
		};
	},

	/**
	 * Defines a `float` field for floating-point numbers.
	 * @param options Options for the float field.
	 * @example
	 * ```ts
	 * rating: Field.float()
	 * ```
	 */
	float(options: FieldOptions = {}): FieldDefinition<number> {
		return {
			...options,
			type: "float",
		};
	},

	/**
	 * Defines an `int` field for integers.
	 * @param options Options for the int field.
	 * @example
	 * ```ts
	 * views: Field.int()
	 * ```
	 */
	int(options: FieldOptions = {}): FieldDefinition<number> {
		return {
			...options,
			type: "int",
		};
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
	 * Defines a `set` field, which is a collection of unique values.
	 * @param element The field definition for the elements within the set.
	 * @param options Options for the set field.
	 * @example
	 * ```ts
	 * // A set of unique tags
	 * tags: Field.set(Field.string())
	 * ```
	 */
	set<TElementDef extends FieldDefinition<unknown>>(
		element: TElementDef,
		options: ArrayFieldOptions<InferFieldType<TElementDef>> = {},
	): FieldDefinition<Set<InferFieldType<TElementDef>>> {
		return {
			...options,
			get type() {
				return options.max
					? `set<${element.type}, ${options.max}>`
					: `set<${element.type}>`;
			},
			arrayElementType: element, // Note: Using arrayElementType for sets as well
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
	 * Defines a `record` field, which creates a standard **Record Link** to a record in another table.
	 * This stores a `RecordId` (a pointer). It does NOT use the experimental `REFERENCE` feature and does not provide automatic referential integrity.
	 * If the linked record is deleted, this field will hold a dangling reference.
	 *
	 * @param tableClassThunk A thunk `() => ModelClass` returning the model being referenced. This is required to prevent circular dependencies.
	 * @param options Options for the record field.
	 * @example
	 * ```ts
	 * // Creates a link to a User record.
	 * author: Field.record(() => User)
	 * ```
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
