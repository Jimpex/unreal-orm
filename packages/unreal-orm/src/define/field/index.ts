import type {
	BoundQuery,
	Decimal,
	Duration,
	Expr,
	FileRef,
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
import { createValueProxy } from "../../query/field-proxy";
import type {
	AnyModelClass,
	InferFieldType,
	InferShapeFromFields,
} from "../table/types/model";
import type {
	AssertCallback,
	FieldDefinition,
	FieldOptions,
	FieldOptionsFor,
	InternalFieldDef,
	ReferenceOptions,
} from "./types";

/**
 * Resolves an assert option that may be a callback into a `BoundQuery | Expr`.
 * If the assert is a function, it is called with a typed `$value` proxy built
 * from the field's type string. Otherwise, the assert is returned as-is.
 */
function resolveAssert<T>(
	assert: BoundQuery | Expr | AssertCallback<T> | undefined,
	typeString: string,
): BoundQuery | Expr | undefined {
	if (typeof assert === "function") {
		const fieldDef: InternalFieldDef = { type: typeString };
		return assert(createValueProxy<T>(fieldDef));
	}
	return assert;
}

type PrimitiveLiteral = string | number | boolean | null | undefined;
type LiteralValue =
	| PrimitiveLiteral
	| { [key: string]: LiteralValue }
	| LiteralValue[];

type SurrealLiteralValue<T> = T extends undefined
	? undefined
	: T extends null
		? null
		: T extends string | number | boolean
			? T
			: T extends readonly (infer U)[]
				? SurrealLiteralValue<U>[]
				: T extends (infer U)[]
					? SurrealLiteralValue<U>[]
					: T extends Record<string, unknown>
						? { [K in keyof T]: SurrealLiteralValue<T[K]> }
						: never;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeSurrealString(value: string): string {
	return JSON.stringify(value);
}

function serializeLiteralValue(value: LiteralValue): string {
	if (value === undefined) {
		return "NONE";
	}

	if (value === null) {
		return "NULL";
	}

	if (typeof value === "string") {
		return escapeSurrealString(value);
	}

	if (typeof value === "number") {
		if (!Number.isFinite(value)) {
			throw new Error("Field.literal only supports finite numbers.");
		}

		return String(value);
	}

	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}

	if (Array.isArray(value)) {
		return `[${value.map((item) => serializeLiteralValue(item)).join(", ")}]`;
	}

	if (isPlainObject(value)) {
		return `{ ${Object.entries(value)
			.map(
				([key, entryValue]) =>
					`${key}: ${serializeLiteralValue(entryValue as LiteralValue)}`,
			)
			.join(", ")} }`;
	}

	throw new Error(
		"Field.literal received a value that cannot be mapped to SurrealQL.",
	);
}

/**
 * Options for defining an array field.
 */
export interface ArrayFieldOptions extends FieldOptions {
	/**
	 * The exact number of elements required in the array.
	 * In SurrealDB v3, `array<T, N>` means exactly N elements.
	 * In SurrealDB v2, it means up to N elements.
	 */
	length?: number;
	/**
	 * @deprecated Use `length` instead. In SurrealDB v3, the size parameter
	 * enforces an exact element count, not a maximum.
	 */
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
export interface RecordFieldOptions extends FieldOptions {
	/**
	 * If true, marks this field as a `REFERENCE`.
	 * This allows the linked record to define a `references` field to see incoming links.
	 *
	 * **EXPERIMENTAL**: Requires the `record_references` experimental capability to be enabled.
	 * Enable with `--allow-experimental record_references` when starting SurrealDB.
	 *
	 * @since SurrealDB v2.2.0
	 */
	reference?: boolean | ReferenceOptions;
}

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
	any(options: FieldOptionsFor<unknown> = {}): FieldDefinition<unknown> {
		const { assert, ...rest } = options;
		return { ...rest, assert: resolveAssert(assert, "any"), type: "any" };
	},
	/**
	 * Defines a `bytes` field for storing binary data.
	 * @param options Options for the bytes field.
	 * @example
	 * ```ts
	 * avatar: Field.bytes()
	 * ```
	 */
	bytes(
		options: FieldOptionsFor<ArrayBuffer> = {},
	): FieldDefinition<ArrayBuffer> {
		const { assert, ...rest } = options;
		return { ...rest, assert: resolveAssert(assert, "bytes"), type: "bytes" };
	},
	/**
	 * Defines a `file` field for storing file pointers to a SurrealDB bucket.
	 * Returns a `FileRef` instance when queried, which provides `.bucket` and `.key` properties.
	 *
	 * **EXPERIMENTAL**: Requires the `files` experimental capability to be enabled.
	 * Enable with `--allow-experimental files` when starting SurrealDB.
	 * A bucket must be defined with `Bucket.define()` before file pointers can be used.
	 *
	 * @param options Options for the file field.
	 *
	 * @since SurrealDB v3.0.0
	 *
	 * @example
	 * ```ts
	 * avatar: Field.file()
	 * // Field accepts file pointers: f"avatars:/user-123.png"
	 * // Returns: FileRef with .bucket = "avatars", .key = "user-123.png"
	 * ```
	 */
	file(options: FieldOptionsFor<FileRef> = {}): FieldDefinition<FileRef> {
		const { assert, ...rest } = options;
		return { ...rest, assert: resolveAssert(assert, "file"), type: "file" };
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
		options: FieldOptionsFor<GeometryTypeMap[T]> = {},
	): FieldDefinition<GeometryTypeMap[T]> {
		const typeString = type === "feature" ? "geometry" : `geometry<${type}>`;
		const { assert, ...rest } = options;
		return {
			...rest,
			assert: resolveAssert(assert, typeString),
			type: typeString,
		};
	},
	/**
	 * Defines a `duration` field for storing time durations.
	 * @param options Options for the duration field.
	 * @example
	 * ```ts
	 * ttl: Field.duration()
	 * ```
	 */
	duration(options: FieldOptionsFor<Duration> = {}): FieldDefinition<Duration> {
		const { assert, ...rest } = options;
		return {
			...rest,
			assert: resolveAssert(assert, "duration"),
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
	uuid(options: FieldOptionsFor<Uuid> = {}): FieldDefinition<Uuid> {
		const { assert, ...rest } = options;
		return { ...rest, assert: resolveAssert(assert, "uuid"), type: "uuid" };
	},

	/**
	 * Defines a `string` field.
	 * @param options Standard field options.
	 * @example Field.string({ assert: surql`$value.length > 0` })
	 */
	string(options: FieldOptionsFor<string> = {}): FieldDefinition<string> {
		const { assert, ...rest } = options;
		return { ...rest, assert: resolveAssert(assert, "string"), type: "string" };
	},
	/**
	 * Defines a `decimal` field for high-precision numbers.
	 * @param options Options for the decimal field.
	 * @example
	 * ```ts
	 * balance: Field.decimal()
	 * ```
	 */
	decimal(options: FieldOptionsFor<Decimal> = {}): FieldDefinition<Decimal> {
		const { assert, ...rest } = options;
		return {
			...rest,
			assert: resolveAssert(assert, "decimal"),
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
	float(options: FieldOptionsFor<number> = {}): FieldDefinition<number> {
		const { assert, ...rest } = options;
		return { ...rest, assert: resolveAssert(assert, "float"), type: "float" };
	},

	/**
	 * Defines an `int` field for integers.
	 * @param options Options for the int field.
	 * @example
	 * ```ts
	 * views: Field.int()
	 * ```
	 */
	int(options: FieldOptionsFor<number> = {}): FieldDefinition<number> {
		const { assert, ...rest } = options;
		return { ...rest, assert: resolveAssert(assert, "int"), type: "int" };
	},
	/**
	 * Defines a `number` field (integer or float).
	 * @param options Standard field options.
	 * @example Field.number({ default: 0 })
	 */
	number(options: FieldOptionsFor<number> = {}): FieldDefinition<number> {
		const { assert, ...rest } = options;
		return { ...rest, assert: resolveAssert(assert, "number"), type: "number" };
	},
	/**
	 * Defines a `boolean` field.
	 * @param options Standard field options.
	 * @example Field.bool({ default: false })
	 */
	bool(options: FieldOptionsFor<boolean> = {}): FieldDefinition<boolean> {
		const { assert, ...rest } = options;
		return { ...rest, assert: resolveAssert(assert, "bool"), type: "bool" };
	},
	/**
	 * Defines a `datetime` field.
	 * @param options Standard field options.
	 * @example Field.datetime({ default: surql`time::now()` })
	 */
	datetime(options: FieldOptionsFor<Date> = {}): FieldDefinition<Date> {
		const { assert, ...rest } = options;
		return {
			...rest,
			assert: resolveAssert(assert, "datetime"),
			type: "datetime",
		};
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
		options: FieldOptionsFor<T, CustomFieldOptions> = {},
	): FieldDefinition<T> {
		const { assert, ...rest } = options;
		return {
			...rest,
			assert: resolveAssert(assert, typeString),
			type: typeString,
			flexible: options.flexible,
		};
	},
	/**
	 * Defines a single literal field type using SurrealQL literal syntax.
	 * @param value A literal value that can be represented in SurrealQL type syntax.
	 * @param options Standard field options.
	 */
	literal<T extends LiteralValue>(
		value: T,
		options: FieldOptionsFor<SurrealLiteralValue<T>> = {},
	): FieldDefinition<SurrealLiteralValue<T>> {
		const typeString = serializeLiteralValue(value);
		const { assert, ...rest } = options;
		return {
			...rest,
			assert: resolveAssert(assert, typeString),
			type: typeString,
		};
	},
	/**
	 * Defines a union of field definitions.
	 * @param fields The member field definitions in the union.
	 * @param options Standard field options.
	 */
	union<const TFields extends readonly FieldDefinition<unknown>[]>(
		fields: TFields,
		options: FieldOptionsFor<InferFieldType<TFields[number]>> = {},
	): FieldDefinition<InferFieldType<TFields[number]>> & {
		unionMembers: TFields;
	} {
		if (fields.length === 0) {
			throw new Error("Field.union requires at least one field definition.");
		}

		const typeString = fields.map((field) => field.type).join(" | ");
		const { assert, ...rest } = options;
		return {
			...rest,
			assert: resolveAssert(assert, typeString),
			type: typeString,
			unionMembers: [...fields] as TFields,
		};
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
		options: FieldOptionsFor<
			Set<InferFieldType<TElementDef>>,
			ArrayFieldOptions
		> = {},
	): FieldDefinition<Set<InferFieldType<TElementDef>>> & {
		arrayElementType: TElementDef;
	} {
		if (options.length !== undefined && options.max !== undefined) {
			throw new Error(
				"Cannot specify both 'length' and 'max' on a set field. Use 'length' instead.",
			);
		}
		const size = options.length ?? options.max;
		const typeString = size
			? `set<${element.type}, ${size}>`
			: `set<${element.type}>`;
		const { assert, ...rest } = options;
		return {
			...rest,
			assert: resolveAssert(assert, typeString),
			type: typeString,
			arrayElementType: element,
		};
	},
	/**
	 * Defines an `array` field.
	 * @param element The field definition for the elements within the array.
	 * @param options Options for the array field, such as `length`.
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
		options: FieldOptionsFor<
			Array<InferFieldType<TElementDef>>,
			ArrayFieldOptions
		> = {},
	): FieldDefinition<Array<InferFieldType<TElementDef>>> & {
		arrayElementType: TElementDef;
	} {
		if (options.length !== undefined && options.max !== undefined) {
			throw new Error(
				"Cannot specify both 'length' and 'max' on an array field. Use 'length' instead.",
			);
		}
		const size = options.length ?? options.max;
		const typeString = size
			? `array<${element.type}, ${size}>`
			: `array<${element.type}>`;
		const { assert, ...rest } = options;
		return {
			...rest,
			assert: resolveAssert(assert, typeString),
			type: typeString,
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
		options: FieldOptionsFor<
			InferShapeFromFields<TSchema>,
			ObjectFieldOptions
		> = {},
	): FieldDefinition<InferShapeFromFields<TSchema>> & {
		objectSchema: TSchema;
	} {
		const { assert, ...rest } = options;
		return {
			...rest,
			assert: resolveAssert(assert, "object"),
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
		options: FieldOptionsFor<
			InstanceType<TModel> | RecordId<TModel["_tableName"]>,
			RecordFieldOptions
		> = {},
	): FieldDefinition<InstanceType<TModel> | RecordId<TModel["_tableName"]>> & {
		recordTableThunk: () => TModel;
	} {
		const isReference = !!options.reference;
		const referenceOptions =
			typeof options.reference === "object" ? options.reference : {};
		const onDelete = referenceOptions.onDelete;
		const typeString = `record<${tableClassThunk()._tableName}>`;
		const { assert, ...rest } = options;

		return {
			...rest,
			assert: resolveAssert(assert, typeString),
			type: typeString,
			recordTableThunk: tableClassThunk,
			reference: isReference,
			recordOnDelete: onDelete,
		};
	},
};
