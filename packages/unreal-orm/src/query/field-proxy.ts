import type { BoundQuery, Expr, ExprCtx } from "surrealdb";
import { surql } from "surrealdb";
import type { FieldDefinition, InternalFieldDef } from "../define/field/types";
import type { InferFieldType } from "../define/table/types/model";
import type { TypedExpr } from "../define/table/types/select";
import { typed } from "../define/table/types/select";

/**
 * Symbol used to store the SurrealQL path/identifier on a column reference.
 * Using a symbol avoids collisions with user-defined field names.
 */
const PATH = Symbol("unreal.column.path");

// ============================================================================
// Public types
// ============================================================================

/**
 * A type-safe reference to a SurrealDB field or expression.
 *
 * Implements the SDK's {@link Expr} interface, so it can be interpolated into
 * `surql` templates and used directly in `where`, `select`, and other CRUD
 * options.
 *
 * @template T The TypeScript type of the value/expression.
 */
/**
 * A generic namespace object for calling SurrealDB built-in functions in their native
 * namespace style, e.g. `f.title.string.lowercase()` → `string::lowercase(title)`.
 *
 * Every property returns a function. When called, it produces a `ColumnRef` for the
 * expression `namespace::functionName(field, ...args)`. Nested functions that contain
 * `::` (such as `string::similarity::jaro`) can be called via bracket notation:
 * `f.title.string['similarity::jaro']()`.
 */
export type FunctionNamespace = {
	// biome-ignore lint/suspicious/noExplicitAny: Required for proxy variance — typed overloads narrow this
	[fn: string]: (...args: any[]) => ColumnRef<any> | BoundQuery;
};

// ============================================================================
// Typed function namespace interfaces
// ============================================================================

/**
 * Typed `string::*` namespace. Known functions return typed `ColumnRef` results;
 * unknown functions fall back to `ColumnRef<unknown>` via the index signature.
 */
export interface StringNamespace extends FunctionNamespace {
	/** `string::lowercase(field)` → `StringColumn` */
	lowercase(): StringColumn;
	/** `string::uppercase(field)` → `StringColumn` */
	uppercase(): StringColumn;
	/** `string::trim(field)` → `StringColumn` */
	trim(): StringColumn;
	/** `string::len(field)` → `NumberColumn` */
	len(): NumberColumn;
	/** `string::contains(field, substr)` → `BoundQuery` */
	contains(value: string | ColumnRef<string>): BoundQuery;
	/** `string::starts_with(field, prefix)` → `BoundQuery` */
	starts_with(value: string | ColumnRef<string>): BoundQuery;
	/** `string::ends_with(field, suffix)` → `BoundQuery` */
	ends_with(value: string | ColumnRef<string>): BoundQuery;
	/** `string::replace(field, old, new)` → `StringColumn` */
	replace(
		oldVal: string | ColumnRef<string>,
		newVal: string | ColumnRef<string>,
	): StringColumn;
	/** `string::slice(field, start, end?)` → `StringColumn` */
	slice(
		start: number | ColumnRef<number>,
		end?: number | ColumnRef<number>,
	): StringColumn;
	/** `string::reverse(field)` → `StringColumn` */
	reverse(): StringColumn;
	/** `string::concat(field, ...parts)` → `StringColumn` */
	concat(...parts: (string | ColumnRef<string>)[]): StringColumn;
	/** `string::similarity(field, other)` → `NumberColumn` */
	similarity(other: string | ColumnRef<string>): NumberColumn;
}

/**
 * Typed `math::*` namespace.
 */
export interface MathNamespace extends FunctionNamespace {
	/** `math::abs(field)` → `NumberColumn` */
	abs(): NumberColumn;
	/** `math::ceil(field)` → `NumberColumn` */
	ceil(): NumberColumn;
	/** `math::floor(field)` → `NumberColumn` */
	floor(): NumberColumn;
	/** `math::round(field)` → `NumberColumn` */
	round(): NumberColumn;
	/** `math::round(field, precision)` → `NumberColumn` */
	round(precision: number | ColumnRef<number>): NumberColumn;
	/** `math::sqrt(field)` → `NumberColumn` */
	sqrt(): NumberColumn;
	/** `math::max(field)` → `NumberColumn` */
	max(): NumberColumn;
	/** `math::min(field)` → `NumberColumn` */
	min(): NumberColumn;
	/** `math::sum(field)` → `NumberColumn` */
	sum(): NumberColumn;
	/** `math::mean(field)` → `NumberColumn` */
	mean(): NumberColumn;
	/** `math::clamp(field, min, max)` → `NumberColumn` */
	clamp(
		min: number | ColumnRef<number>,
		max: number | ColumnRef<number>,
	): NumberColumn;
	/** `math::pow(field, exp)` → `NumberColumn` */
	pow(exp: number | ColumnRef<number>): NumberColumn;
}

/**
 * Typed `array::*` namespace.
 */
export interface ArrayNamespace extends FunctionNamespace {
	/** `array::len(field)` → `NumberColumn` */
	len(): NumberColumn;
	/** `array::distinct(field)` → `ColumnRef<unknown[]>` */
	distinct(): ColumnRef<unknown>;
	/** `array::flatten(field)` → `ColumnRef<unknown[]>` */
	flatten(): ColumnRef<unknown>;
	/** `array::join(field, sep)` → `StringColumn` */
	join(sep: string | ColumnRef<string>): StringColumn;
	/** `array::sort(field)` → `ColumnRef<unknown[]>` */
	sort(): ColumnRef<unknown>;
	/** `array::sort(field, order)` → `ColumnRef<unknown[]>` */
	sort(order: "asc" | "desc"): ColumnRef<unknown>;
	/** `array::union(field, other)` → `ColumnRef<unknown[]>` */
	union(other: unknown[] | ColumnRef<unknown[]>): ColumnRef<unknown>;
	/** `array::intersect(field, other)` → `ColumnRef<unknown[]>` */
	intersect(other: unknown[] | ColumnRef<unknown[]>): ColumnRef<unknown>;
	/** `array::difference(field, other)` → `ColumnRef<unknown[]>` */
	difference(other: unknown[] | ColumnRef<unknown[]>): ColumnRef<unknown>;
	/** `array::add(field, value)` → `ColumnRef<unknown[]>` — adds value if not present */
	add(value: unknown): ColumnRef<unknown>;
	/** `array::remove(field, value)` → `ColumnRef<unknown[]>` */
	remove(value: unknown): ColumnRef<unknown>;
	/** `array::at(field, index)` → `ColumnRef<unknown>` */
	at(index: number | ColumnRef<number>): ColumnRef<unknown>;
	/** `array::first(field)` → `ColumnRef<unknown>` */
	first(): ColumnRef<unknown>;
	/** `array::last(field)` → `ColumnRef<unknown>` */
	last(): ColumnRef<unknown>;
}

/**
 * Typed `time::*` namespace.
 */
export interface TimeNamespace extends FunctionNamespace {
	/** `time::now()` → `DateTimeColumn` */
	now(): DateTimeColumn;
	/** `time::year(field)` → `NumberColumn` */
	year(): NumberColumn;
	/** `time::month(field)` → `NumberColumn` */
	month(): NumberColumn;
	/** `time::day(field)` → `NumberColumn` */
	day(): NumberColumn;
	/** `time::hour(field)` → `NumberColumn` */
	hour(): NumberColumn;
	/** `time::minute(field)` → `NumberColumn` */
	minute(): NumberColumn;
	/** `time::second(field)` → `NumberColumn` */
	second(): NumberColumn;
	/** `time::unix(field)` → `NumberColumn` */
	unix(): NumberColumn;
	/** `time::from_unix(ts)` → `DateTimeColumn` */
	from_unix(ts: number | ColumnRef<number>): DateTimeColumn;
	/** `time::format(field, fmt)` → `StringColumn` */
	format(fmt: string | ColumnRef<string>): StringColumn;
	/** `time::dayofyear(field)` → `NumberColumn` */
	dayofyear(): NumberColumn;
	/** `time::dayofweek(field)` → `NumberColumn` */
	dayofweek(): NumberColumn;
}

/**
 * Typed `meta::*` namespace.
 */
export interface MetaNamespace extends FunctionNamespace {
	/** `meta::id(field)` → `ColumnRef<unknown>` */
	id(): ColumnRef<unknown>;
	/** `meta::table(field)` → `StringColumn` */
	table(): StringColumn;
	/** `meta::tb(field)` → `StringColumn` */
	tb(): StringColumn;
}

/**
 * Typed `record::*` namespace.
 */
export interface RecordNamespace extends FunctionNamespace {
	/** `record::id(field)` → `ColumnRef<unknown>` */
	id(): ColumnRef<unknown>;
	/** `record::table(field)` → `StringColumn` */
	table(): StringColumn;
	/** `record::tb(field)` → `StringColumn` */
	tb(): StringColumn;
}

/**
 * Typed `type::*` namespace.
 */
export interface TypeNamespace extends FunctionNamespace {
	/** `type::int(field)` → `NumberColumn` */
	int(): NumberColumn;
	/** `type::float(field)` → `NumberColumn` */
	float(): NumberColumn;
	/** `type::decimal(field)` → `NumberColumn` */
	decimal(): NumberColumn;
	/** `type::string(field)` → `StringColumn` */
	string(): StringColumn;
	/** `type::bool(field)` → `ColumnRef<boolean>` */
	bool(): ColumnRef<boolean>;
	/** `type::datetime(field)` → `DateTimeColumn` */
	datetime(): DateTimeColumn;
}

/**
 * Typed `is::*` namespace. These return `BoundQuery` (boolean predicates).
 */
export interface IsNamespace extends FunctionNamespace {
	/** `is::email(field)` → `BoundQuery` */
	email(): BoundQuery;
	/** `is::uuid(field)` → `BoundQuery` */
	uuid(): BoundQuery;
	/** `is::number(field)` → `BoundQuery` */
	number(): BoundQuery;
	/** `is::string(field)` → `BoundQuery` */
	string(): BoundQuery;
	/** `is::array(field)` → `BoundQuery` */
	array(): BoundQuery;
	/** `is::bool(field)` → `BoundQuery` */
	bool(): BoundQuery;
	/** `is::datetime(field)` → `BoundQuery` */
	datetime(): BoundQuery;
	/** `is::record(field)` → `BoundQuery` */
	record(): BoundQuery;
	/** `is::table(field)` → `BoundQuery` */
	table(): BoundQuery;
}

/**
 * Internal mutable helper used while assembling a {@link ColumnRef}. Namespace
 * properties are optional during construction and attached afterwards, allowing
 * the proxy to be built without unsafe `as unknown as` casts.
 */
type ColumnRefBuilder<T = unknown> = Omit<
	ColumnRef<T>,
	| "__type"
	| "string"
	| "math"
	| "array"
	| "time"
	| "is"
	| "meta"
	| "parse"
	| "bytes"
	| "crypto"
	| "duration"
	| "encoding"
	| "geo"
	| "http"
	| "object"
	| "rand"
	| "record"
	| "search"
	| "session"
	| "type"
	| "vector"
> & {
	string?: StringNamespace;
	math?: MathNamespace;
	array?: ArrayNamespace;
	time?: TimeNamespace;
	is?: FunctionNamespace;
	meta?: MetaNamespace;
	parse?: FunctionNamespace;
	bytes?: FunctionNamespace;
	crypto?: FunctionNamespace;
	duration?: FunctionNamespace;
	encoding?: FunctionNamespace;
	geo?: FunctionNamespace;
	http?: FunctionNamespace;
	object?: FunctionNamespace;
	rand?: FunctionNamespace;
	record?: RecordNamespace;
	search?: FunctionNamespace;
	session?: FunctionNamespace;
	type?: TypeNamespace;
	vector?: FunctionNamespace;
};

export interface ColumnRef<T = unknown> {
	/** @internal Symbol-stored SurrealQL path/identifier. */
	readonly [PATH]: string;
	/** Phantom type marker for type inference. */
	readonly __type: T;

	/** Renders this reference to a SurrealQL fragment. */
	toSQL(ctx: ExprCtx): string;

	/** Equality comparison (`=`). */
	eq(value: T | ColumnRef<T>): BoundQuery;
	/** Not-equal comparison (`!=`). */
	ne(value: T | ColumnRef<T>): BoundQuery;
	/** Greater-than comparison (`>`). */
	gt(value: T | ColumnRef<T>): BoundQuery;
	/** Greater-than-or-equal comparison (`>=`). */
	gte(value: T | ColumnRef<T>): BoundQuery;
	/** Less-than comparison (`<`). */
	lt(value: T | ColumnRef<T>): BoundQuery;
	/** Less-than-or-equal comparison (`<=`). */
	lte(value: T | ColumnRef<T>): BoundQuery;

	/**
	 * Exact equality comparison (`==`).
	 * Does not perform type coercion; `10 == "10"` is false.
	 */
	exact(value: T | ColumnRef<T>): BoundQuery;

	/**
	 * Check if the value is `NONE`.
	 * SurrealDB distinguishes `NONE` (absent/missing) from `NULL`.
	 */
	isNone(): BoundQuery;
	/** Check if the value is not `NONE`. */
	isNotNone(): BoundQuery;
	/** Check if the value is `NULL`. */
	isNull(): BoundQuery;
	/** Check if the value is not `NULL`. */
	isNotNull(): BoundQuery;
	/**
	 * Check if the value is truthy.
	 * A value is falsy if it is `NONE`, `NULL`, `false`, or an empty string.
	 */
	isTrue(): BoundQuery;
	/** Check if the value is falsy. */
	isFalse(): BoundQuery;

	/**
	 * Check if the value is inside another value (`INSIDE`).
	 * Commonly used for geometry containment.
	 */
	inside(value: unknown): BoundQuery;
	/**
	 * Check if the value is outside another value (`OUTSIDE`).
	 * Commonly used for geometry containment.
	 */
	outside(value: unknown): BoundQuery;
	/**
	 * Check if the value intersects another geometry (`INTERSECTS`).
	 * Commonly used for geometry containment.
	 */
	intersects(value: unknown): BoundQuery;

	/**
	 * Full-text search against the field (`@@`).
	 * @param value The search term. Regular expressions are not supported here.
	 * @param ref Optional relevance reference number (`@ref@`).
	 *
	 * Requires a `SEARCH` index. Regex operators (`~`, `!~`, `?~`, `*~`) were
	 * removed in SurrealDB 3.x; use `matches()` instead.
	 */
	matches(value: unknown, ref?: number): BoundQuery;

	/** Check if the value is in a set (`IN`). */
	isIn(values: unknown[]): BoundQuery;
	/** Check if the value is not in a set (`NOT IN`). */
	isNotIn(values: unknown[]): BoundQuery;

	/**
	 * Check if the field (array or string) contains any of the values (`CONTAINSANY`).
	 * For single-value membership, use `contains()` on arrays or strings.
	 */
	containsAny(values: unknown[]): BoundQuery;
	/**
	 * Check if the field (array or string) contains all of the values (`CONTAINSALL`).
	 */
	containsAll(values: unknown[]): BoundQuery;
	/**
	 * Check if the field (array or string) contains none of the values (`CONTAINSNONE`).
	 */
	containsNone(values: unknown[]): BoundQuery;

	// ----------------------------------------------------------------
	// Arithmetic operators (return ColumnRef for chaining)
	// ----------------------------------------------------------------

	/**
	 * Addition (`field + value`). Also used for string/array concatenation in SurrealDB.
	 */
	add(value: T | ColumnRef<T>): ColumnRef<T>;
	/** Subtraction (`field - value`). */
	subtract(value: T | ColumnRef<T>): ColumnRef<T>;
	/** Multiplication (`field * value`). */
	multiply(value: T | ColumnRef<T>): ColumnRef<T>;
	/** Division (`field / value`). */
	divide(value: T | ColumnRef<T>): ColumnRef<T>;
	/** Modulo (`field % value`). */
	modulo(value: T | ColumnRef<T>): ColumnRef<T>;

	// ----------------------------------------------------------------
	// Graph traversal operators
	// ----------------------------------------------------------------

	/**
	 * Traverse outgoing graph edges (`field->edge`).
	 * The returned ref can access the target table's fields if the edge model is provided.
	 * @param edge The edge table name, or omit for any edge type.
	 * @param edgeModel Optional model class for the edge table, enabling typed field access on the result.
	 */
	out(
		edge?: string,
		edgeModel?: {
			_fields: Record<string, InternalFieldDef>;
			_tableName: string;
		},
	): ColumnRef<unknown>;
	/**
	 * Traverse incoming graph edges (`field<-edge`).
	 * The returned ref can access the source table's fields if the edge model is provided.
	 * @param edge The edge table name, or omit for any edge type.
	 * @param edgeModel Optional model class for the edge table, enabling typed field access on the result.
	 */
	in(
		edge?: string,
		edgeModel?: {
			_fields: Record<string, InternalFieldDef>;
			_tableName: string;
		},
	): ColumnRef<unknown>;
	/**
	 * Traverse graph edges in both directions (`field<->edge`).
	 * @param edge The edge table name, or omit for any edge type.
	 * @param edgeModel Optional model class for the edge table, enabling typed field access on the result.
	 */
	both(
		edge?: string,
		edgeModel?: {
			_fields: Record<string, InternalFieldDef>;
			_tableName: string;
		},
	): ColumnRef<unknown>;

	/**
	 * Fetch (expand) this record link into a full record object.
	 * Generates a `FETCH`-style expression for use in SELECT projections.
	 * For SELECT queries, prefer the `fetch` option on the query instead.
	 */
	fetch(): ColumnRef<unknown>;

	// ----------------------------------------------------------------
	// Native SurrealDB function namespaces
	// ----------------------------------------------------------------

	/** Native `string::*` function namespace with typed overloads, e.g. `f.title.string.lowercase()`. */
	readonly string: StringNamespace;
	/** Native `math::*` function namespace with typed overloads, e.g. `f.views.math.round()`. */
	readonly math: MathNamespace;
	/** Native `array::*` function namespace with typed overloads, e.g. `f.tags.array.distinct()`. */
	readonly array: ArrayNamespace;
	/** Native `time::*` function namespace with typed overloads, e.g. `f.createdAt.time.year()`. */
	readonly time: TimeNamespace;
	/**
	 * Native `is::*` type-check function namespace, e.g. `f.email.is.email()`.
	 * Functions such as `is::record` require a database value, not just a path.
	 */
	readonly is: FunctionNamespace;
	/** Native `meta::*` function namespace with typed overloads, e.g. `f.record.meta.id()`. */
	readonly meta: MetaNamespace;
	/** Native `parse::*` function namespace, e.g. `f.url.parse.url()`. */
	readonly parse: FunctionNamespace;
	/** Native `bytes::*` function namespace, e.g. `f.data.bytes.len()`. */
	readonly bytes: FunctionNamespace;
	/** Native `crypto::*` function namespace, e.g. `f.password.crypto.sha256()`. */
	readonly crypto: FunctionNamespace;
	/** Native `duration::*` function namespace, e.g. `f.expires.duration.from_secs(3600)`. */
	readonly duration: FunctionNamespace;
	/** Native `encoding::*` function namespace, e.g. `f.data.encoding.base64_encode()`. */
	readonly encoding: FunctionNamespace;
	/** Native `geo::*` function namespace, e.g. `f.location.geo.distance(other)`. */
	readonly geo: FunctionNamespace;
	/** Native `http::*` function namespace, e.g. `f.url.http.head()`. */
	readonly http: FunctionNamespace;
	/** Native `object::*` function namespace, e.g. `f.meta.object.keys()`. */
	readonly object: FunctionNamespace;
	/** Native `rand::*` function namespace, e.g. `f.id.rand.uuid()`. */
	readonly rand: FunctionNamespace;
	/** Native `record::*` function namespace with typed overloads, e.g. `f.author.record.id()`. */
	readonly record: RecordNamespace;
	/**
	 * Native `search::*` function namespace.
	 * Available in SurrealDB 2.x+ with the `SEARCH` index feature.
	 */
	readonly search: FunctionNamespace;
	/** Native `session::*` function namespace, e.g. `f.token.session.db()`. */
	readonly session: FunctionNamespace;
	/** Native `type::*` function namespace with typed overloads, e.g. `f.value.type.int()`. */
	readonly type: TypeNamespace;
	/**
	 * Native `vector::*` function namespace.
	 * Available in SurrealDB 2.x+ for vector similarity search.
	 */
	readonly vector: FunctionNamespace;

	/**
	 * Casts this expression to a typed select projection.
	 * @template R The TypeScript type of the computed expression.
	 */
	as<R>(): TypedExpr<R>;
}

/**
 * Column reference with number-specific methods.
 */
export interface NumberColumn extends ColumnRef<number> {
	/** Absolute value. */
	abs(): NumberColumn;
	/** Round up to the nearest integer. */
	ceil(): NumberColumn;
	/** Round down to the nearest integer. */
	floor(): NumberColumn;
	/** Round to the nearest integer. */
	round(): NumberColumn;
	/** Square root. */
	sqrt(): NumberColumn;
	/** Clamp the value between min and max. */
	clamp(
		min: number | ColumnRef<number>,
		max: number | ColumnRef<number>,
	): NumberColumn;
}

/**
 * Column reference with datetime-specific methods.
 */
export interface DateTimeColumn extends ColumnRef<Date> {
	/** Extract the year component. */
	year(): NumberColumn;
	/** Extract the month component. */
	month(): NumberColumn;
	/** Extract the day component. */
	day(): NumberColumn;
	/** Extract the hour component. */
	hour(): NumberColumn;
	/** Convert to a Unix timestamp. */
	unix(): NumberColumn;
}

/**
 * Column reference with string-specific methods.
 */
export interface StringColumn extends ColumnRef<string> {
	/** Convert to lowercase. */
	toLowerCase(): StringColumn;
	/** Convert to uppercase. */
	toUpperCase(): StringColumn;
	/** Remove leading and trailing whitespace. */
	trim(): StringColumn;
	/** Check if the string contains a substring. */
	contains(value: string | ColumnRef<string>): BoundQuery;
	/** Check if the string starts with a substring. */
	startsWith(value: string | ColumnRef<string>): BoundQuery;
	/** Check if the string ends with a substring. */
	endsWith(value: string | ColumnRef<string>): BoundQuery;
	/** Return the string length. */
	length(): NumberColumn;
	/** Replace occurrences of a substring. */
	replace(
		oldValue: string | ColumnRef<string>,
		newValue: string | ColumnRef<string>,
	): StringColumn;
	/** Extract a section of the string. */
	slice(
		start: number | ColumnRef<number>,
		end?: number | ColumnRef<number>,
	): StringColumn;
}

/**
 * Column reference with array-specific methods.
 *
 * @template E The element type of the array.
 */
export interface ArrayColumn<E> extends ColumnRef<E[]> {
	/** Check if the array contains a value (uses the `CONTAINS` operator). */
	contains(value: E | ColumnRef<E>): BoundQuery;
	/** Return the number of items in the array. */
	length(): NumberColumn;
	/** Return the distinct values in the array. */
	distinct(): ArrayColumn<E>;
	/** Join array elements into a string. */
	join(separator: string | ColumnRef<string>): StringColumn;
	/** Flatten a nested array. */
	flatten(): ArrayColumn<unknown>;
}

// ============================================================================
// Field proxy types
// ============================================================================

/**
 * Extract the nested object schema from a field definition.
 */
type ExtractObjectSchema<F extends FieldDefinition<unknown>> = F extends {
	objectSchema: infer S;
}
	? S extends Record<string, FieldDefinition<unknown>>
		? S
		: never
	: never;

/**
 * Extract the fields from a record-link field's linked model.
 */
type ExtractRecordFields<F extends FieldDefinition<unknown>> = F extends {
	recordTableThunk: () => infer M;
}
	? M extends { _fields: infer Fs }
		? Fs extends Record<string, FieldDefinition<unknown>>
			? Fs
			: never
		: never
	: never;

/**
 * The nested field definitions accessible through a field, if any.
 */
type NestedFieldDefinitions<F extends FieldDefinition<unknown>> =
	ExtractObjectSchema<F> extends never
		? ExtractRecordFields<F> extends never
			? never
			: ExtractRecordFields<F>
		: ExtractObjectSchema<F>;

/**
 * Type-specific methods for a given TypeScript type.
 */
type MethodsFor<T> = T extends number
	? NumberColumn
	: T extends string
		? StringColumn
		: T extends Date
			? DateTimeColumn
			: T extends Array<infer E>
				? ArrayColumn<E>
				: unknown;

/**
 * A typed reference to `$value` for use in `ASSERT` callbacks.
 * Provides the same type-specific methods as a field proxy column reference.
 */
export type ValueRef<T> = ColumnRef<T> & MethodsFor<NonNullable<T>>;

/**
 * A proxy object for a field definition.
 */
type ProxyFor<F extends FieldDefinition<unknown>> = ColumnRef<
	InferFieldType<F>
> &
	MethodsFor<NonNullable<InferFieldType<F>>> &
	(NestedFieldDefinitions<F> extends never
		? unknown
		: FieldProxy<NestedFieldDefinitions<F>>);

/**
 * Maps a table's field definitions to typed column references.
 */
export type FieldProxy<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = {
	[K in keyof TFields]: ProxyFor<TFields[K]>;
};

// ============================================================================
// Runtime helpers
// ============================================================================

function isColumnRef(value: unknown): value is ColumnRef<unknown> {
	return (
		value !== null &&
		typeof value === "object" &&
		PATH in value &&
		typeof (value as { toSQL?: unknown }).toSQL === "function"
	);
}

function makeTemplateStringsArray(strings: string[]): TemplateStringsArray {
	const raw = [...strings];
	return Object.assign([...strings], { raw }) as TemplateStringsArray;
}

function renderValue(ctx: ExprCtx, value: unknown): string {
	if (isColumnRef(value)) return value.toSQL(ctx);
	return ctx.def(value);
}

function simpleGenericDef(): InternalFieldDef {
	return { type: "any" };
}

function createFunctionNamespace(
	prefix: string,
	col: { toSQL(ctx: ExprCtx): string },
): FunctionNamespace {
	return new Proxy({} as FunctionNamespace, {
		get(_, fn) {
			if (typeof fn !== "string") return undefined;
			return (...args: unknown[]) =>
				makeFunctionRef<unknown>((ctx) => {
					const renderedArgs = args
						.map((arg) => renderValue(ctx, arg))
						.join(", ");
					return renderedArgs
						? `${prefix}::${fn}(${col.toSQL(ctx)}, ${renderedArgs})`
						: `${prefix}::${fn}(${col.toSQL(ctx)})`;
				}, simpleGenericDef());
		},
	});
}

/**
 * Field type presets for typed namespace functions.
 * Each preset maps a function name to the InternalFieldDef that controls
 * which type-specific methods (string, number, datetime, array) are attached
 * to the returned ColumnRef.
 */
function simpleBoolDef(): InternalFieldDef {
	return { type: "bool" };
}
function simpleStringDef(): InternalFieldDef {
	return { type: "string" };
}
function simpleNumberDef(): InternalFieldDef {
	return { type: "number" };
}

/**
 * Map of known function return types per namespace prefix.
 * Functions not listed here fall back to `ColumnRef<unknown>`.
 */
const NAMESPACE_RETURN_TYPES: Record<
	string,
	Record<string, InternalFieldDef>
> = {
	string: {
		lowercase: simpleStringDef(),
		uppercase: simpleStringDef(),
		trim: simpleStringDef(),
		len: simpleNumberDef(),
		replace: simpleStringDef(),
		slice: simpleStringDef(),
		reverse: simpleStringDef(),
		concat: simpleStringDef(),
		similarity: simpleNumberDef(),
	},
	math: {
		abs: simpleNumberDef(),
		ceil: simpleNumberDef(),
		floor: simpleNumberDef(),
		round: simpleNumberDef(),
		sqrt: simpleNumberDef(),
		max: simpleNumberDef(),
		min: simpleNumberDef(),
		sum: simpleNumberDef(),
		mean: simpleNumberDef(),
		clamp: simpleNumberDef(),
		pow: simpleNumberDef(),
	},
	array: {
		len: simpleNumberDef(),
		join: simpleStringDef(),
	},
	time: {
		now: simpleDateDef(),
		year: simpleNumberDef(),
		month: simpleNumberDef(),
		day: simpleNumberDef(),
		hour: simpleNumberDef(),
		minute: simpleNumberDef(),
		second: simpleNumberDef(),
		unix: simpleNumberDef(),
		from_unix: simpleDateDef(),
		format: simpleStringDef(),
		dayofyear: simpleNumberDef(),
		dayofweek: simpleNumberDef(),
	},
	meta: {
		table: simpleStringDef(),
		tb: simpleStringDef(),
	},
	record: {
		table: simpleStringDef(),
		tb: simpleStringDef(),
	},
	type: {
		int: simpleNumberDef(),
		float: simpleNumberDef(),
		decimal: simpleNumberDef(),
		string: simpleStringDef(),
		bool: simpleBoolDef(),
		datetime: simpleDateDef(),
	},
};

/**
 * Creates a function namespace proxy that returns typed ColumnRef results
 * for known functions, falling back to ColumnRef<unknown> for unknown ones.
 */
function createTypedNamespace(
	prefix: string,
	col: { toSQL(ctx: ExprCtx): string },
): FunctionNamespace {
	const knownTypes = NAMESPACE_RETURN_TYPES[prefix];
	return new Proxy({} as FunctionNamespace, {
		get(_, fn) {
			if (typeof fn !== "string") return undefined;
			return (...args: unknown[]) => {
				const fieldDef = knownTypes?.[fn] ?? simpleGenericDef();
				return makeFunctionRef<unknown>((ctx) => {
					const renderedArgs = args
						.map((arg) => renderValue(ctx, arg))
						.join(", ");
					return renderedArgs
						? `${prefix}::${fn}(${col.toSQL(ctx)}, ${renderedArgs})`
						: `${prefix}::${fn}(${col.toSQL(ctx)})`;
				}, fieldDef);
			};
		},
	});
}

function makeCompare(op: string) {
	return function <T>(this: ColumnRef<T>, value: T | ColumnRef<T>): BoundQuery {
		const strings = ["", ` ${op} `, ""];
		return surql(makeTemplateStringsArray(strings), this, value);
	};
}

function makePredicate(op: string) {
	return function (this: ColumnRef<unknown>): BoundQuery {
		const strings = ["", ` ${op}`];
		return surql(makeTemplateStringsArray(strings), this);
	};
}

function makeMatches() {
	return function (
		this: ColumnRef<unknown>,
		value: unknown,
		ref?: number,
	): BoundQuery {
		if (ref === undefined) return surql`${this} @@ ${value}`;
		const strings = ["", ` @${ref}@ `, ""];
		return surql(makeTemplateStringsArray(strings), this, value);
	};
}

function makeArithmetic(op: string) {
	return function <T>(
		this: ColumnRef<T>,
		value: T | ColumnRef<T>,
	): ColumnRef<T> {
		return makeFunctionRef<T>(
			(ctx) => `${this.toSQL(ctx)} ${op} ${renderValue(ctx, value)}`,
			simpleGenericDef(),
		);
	};
}

/**
 * Resolves the target table's field definitions from an edge model.
 * For `->` (out), the target is the edge's `out` field's record table.
 * For `<-` (in), the target is the edge's `in` field's record table.
 * For `<->` (both), we prefer `out` then `in` as fallback.
 */
function resolveEdgeTargetFields(
	edgeModel: { _fields: Record<string, InternalFieldDef> } | undefined,
	direction: "out" | "in" | "both",
): InternalFieldDef | undefined {
	if (!edgeModel?._fields) return undefined;
	const fields = edgeModel._fields;
	if (direction === "in") {
		return fields.in;
	}
	// 'out' and 'both' both prefer the 'out' field
	return fields.out;
}

function makeGraphTraverse(op: string, direction: "out" | "in" | "both") {
	return function (
		this: ColumnRef<unknown>,
		edge?: string,
		edgeModel?: {
			_fields: Record<string, InternalFieldDef>;
			_tableName: string;
		},
	): ColumnRef<unknown> {
		const edgePart = edge ?? "";
		const targetField = resolveEdgeTargetFields(edgeModel, direction);
		return makeFunctionRef<unknown>(
			(ctx) => `${this.toSQL(ctx)}${op}${edgePart}`,
			targetField ?? simpleGenericDef(),
		);
	};
}

function createOperatorMethods() {
	return {
		eq: makeCompare("="),
		ne: makeCompare("!="),
		gt: makeCompare(">"),
		gte: makeCompare(">="),
		lt: makeCompare("<"),
		lte: makeCompare("<="),
		exact: makeCompare("=="),
		isNone: makePredicate("IS NONE"),
		isNotNone: makePredicate("IS NOT NONE"),
		isNull: makePredicate("IS NULL"),
		isNotNull: makePredicate("IS NOT NULL"),
		isTrue: makePredicate("IS TRUE"),
		isFalse: makePredicate("IS FALSE"),
		inside: makeCompare("INSIDE"),
		outside: makeCompare("OUTSIDE"),
		intersects: makeCompare("INTERSECTS"),
		matches: makeMatches(),
		isIn: makeCompare("IN"),
		isNotIn: makeCompare("NOT IN"),
		containsAny: makeCompare("CONTAINSANY"),
		containsAll: makeCompare("CONTAINSALL"),
		containsNone: makeCompare("CONTAINSNONE"),
		add: makeArithmetic("+"),
		subtract: makeArithmetic("-"),
		multiply: makeArithmetic("*"),
		divide: makeArithmetic("/"),
		modulo: makeArithmetic("%"),
		out: makeGraphTraverse("->", "out"),
		in: makeGraphTraverse("<-", "in"),
		both: makeGraphTraverse("<->", "both"),
		fetch: function (this: ColumnRef<unknown>): ColumnRef<unknown> {
			return makeFunctionRef<unknown>(
				(ctx) => this.toSQL(ctx),
				simpleGenericDef(),
			);
		},
	};
}

function attachNamespaces(ref: ColumnRefBuilder): void {
	ref.string = createTypedNamespace("string", ref) as StringNamespace;
	ref.math = createTypedNamespace("math", ref) as MathNamespace;
	ref.array = createTypedNamespace("array", ref) as ArrayNamespace;
	ref.time = createTypedNamespace("time", ref) as TimeNamespace;
	ref.is = createFunctionNamespace("is", ref);
	ref.meta = createTypedNamespace("meta", ref) as MetaNamespace;
	ref.parse = createFunctionNamespace("parse", ref);
	ref.bytes = createFunctionNamespace("bytes", ref);
	ref.crypto = createFunctionNamespace("crypto", ref);
	ref.duration = createFunctionNamespace("duration", ref);
	ref.encoding = createFunctionNamespace("encoding", ref);
	ref.geo = createFunctionNamespace("geo", ref);
	ref.http = createFunctionNamespace("http", ref);
	ref.object = createFunctionNamespace("object", ref);
	ref.rand = createFunctionNamespace("rand", ref);
	ref.record = createTypedNamespace("record", ref) as RecordNamespace;
	ref.search = createFunctionNamespace("search", ref);
	ref.session = createFunctionNamespace("session", ref);
	ref.type = createTypedNamespace("type", ref) as TypeNamespace;
	ref.vector = createFunctionNamespace("vector", ref);
}

function makeFunctionRef<TReturn>(
	toSQL: (ctx: ExprCtx) => string,
	field: InternalFieldDef,
): ColumnRef<TReturn> & MethodsFor<NonNullable<TReturn>> {
	const ref: ColumnRefBuilder<TReturn> = {
		[PATH]: "",
		toSQL,
		...createOperatorMethods(),
		as: function <R>(this: ColumnRef<TReturn>): TypedExpr<R> {
			return typed<R>(this);
		},
	};

	addMethods(ref, field);
	attachNamespaces(ref);

	return new Proxy(ref, {
		get(target, prop) {
			if (typeof prop === "symbol") {
				return prop === PATH ? target[PATH] : undefined;
			}
			if (prop in target) {
				return Reflect.get(target, prop);
			}
			const nested = getNestedFields(field);
			if (nested && prop in nested) {
				const child = nested[prop];
				if (!child) return undefined;
				return createColumnRef<unknown>(
					`${toSQL({ def: () => "" })}.${prop}`,
					child,
				);
			}
			return undefined;
		},
	}) as ColumnRef<TReturn> & MethodsFor<NonNullable<TReturn>>;
}

/**
 * Creates a typed ColumnRef from a BoundQuery produced by `surql` template literals.
 * Ensures consistent use of `surql` for value binding throughout the codebase.
 */
function makeFunctionRefFromBound<TReturn>(
	bound: BoundQuery,
	field: InternalFieldDef,
): ColumnRef<TReturn> & MethodsFor<NonNullable<TReturn>> {
	return makeFunctionRef<TReturn>((ctx) => {
		return bound.query.replace(/\$([a-zA-Z0-9_]+)/g, (_, key) => {
			const val = bound.bindings[key];
			if (val === undefined) return `$${key}`;
			return renderValue(ctx, val);
		});
	}, field);
}

function unwrapOptionalType(type: string): string {
	if (type.startsWith("option<") && type.endsWith(">")) {
		return type.slice(7, -1);
	}
	return type;
}

function baseTypeOf(field: InternalFieldDef): string {
	return unwrapOptionalType(field.type);
}

function isStringField(field: InternalFieldDef): boolean {
	const type = baseTypeOf(field);
	return type === "string" || type.startsWith("string");
}

function isNumberField(field: InternalFieldDef): boolean {
	const type = baseTypeOf(field);
	return (
		type === "number" ||
		type === "int" ||
		type === "float" ||
		type === "decimal" ||
		type.startsWith("int") ||
		type.startsWith("float") ||
		type.startsWith("decimal") ||
		type.startsWith("number")
	);
}

function isDateTimeField(field: InternalFieldDef): boolean {
	return baseTypeOf(field) === "datetime";
}

function isArrayField(field: InternalFieldDef): boolean {
	return baseTypeOf(field).startsWith("array");
}

function getNestedFields(
	field: InternalFieldDef,
): Record<string, InternalFieldDef> | undefined {
	if (field.objectSchema) return field.objectSchema;
	if (field.recordTableThunk) {
		const model = field.recordTableThunk();
		if (
			model &&
			(typeof model === "function" || typeof model === "object") &&
			"_fields" in model
		) {
			return (model as { _fields: Record<string, InternalFieldDef> })._fields;
		}
	}
	if (field.arrayElementType) {
		// Arrays themselves don't expose element fields directly, but an array of
		// objects/records could be accessed via future `array::map`. For now,
		// element access is not surfaced through the proxy.
		return undefined;
	}
	return undefined;
}

function getElementField(
	field: InternalFieldDef,
): InternalFieldDef | undefined {
	return field.arrayElementType;
}

function addMethods(ref: ColumnRefBuilder, field: InternalFieldDef): void {
	if (isStringField(field)) addStringMethods(ref as StringColumn);
	if (isNumberField(field)) addNumberMethods(ref as NumberColumn);
	if (isDateTimeField(field)) addDateTimeMethods(ref as DateTimeColumn);
	if (isArrayField(field)) addArrayMethods(ref as ArrayColumn<unknown>, field);
}

function simpleDateDef(): InternalFieldDef {
	return { type: "datetime" };
}

function simpleArrayDef(element?: InternalFieldDef): InternalFieldDef {
	return {
		type: "array<any>",
		arrayElementType: element,
	};
}

function addStringMethods(target: StringColumn): void {
	target.toLowerCase = () =>
		makeFunctionRefFromBound<string>(
			surql`string::lowercase(${target})`,
			simpleStringDef(),
		);
	target.toUpperCase = () =>
		makeFunctionRefFromBound<string>(
			surql`string::uppercase(${target})`,
			simpleStringDef(),
		);
	target.trim = () =>
		makeFunctionRefFromBound<string>(
			surql`string::trim(${target})`,
			simpleStringDef(),
		);
	target.contains = (value: string | ColumnRef<string>) =>
		surql`string::contains(${target}, ${value})`;
	target.startsWith = (value: string | ColumnRef<string>) =>
		surql`string::starts_with(${target}, ${value})`;
	target.endsWith = (value: string | ColumnRef<string>) =>
		surql`string::ends_with(${target}, ${value})`;
	target.length = () =>
		makeFunctionRefFromBound<number>(
			surql`string::len(${target})`,
			simpleNumberDef(),
		);
	target.replace = (
		oldValue: string | ColumnRef<string>,
		newValue: string | ColumnRef<string>,
	) =>
		makeFunctionRefFromBound<string>(
			surql`string::replace(${target}, ${oldValue}, ${newValue})`,
			simpleStringDef(),
		);
	target.slice = (
		start: number | ColumnRef<number>,
		end?: number | ColumnRef<number>,
	) =>
		end === undefined
			? makeFunctionRefFromBound<string>(
					surql`string::slice(${target}, ${start})`,
					simpleStringDef(),
				)
			: makeFunctionRefFromBound<string>(
					surql`string::slice(${target}, ${start}, ${end})`,
					simpleStringDef(),
				);
}

function addNumberMethods(target: NumberColumn): void {
	target.abs = () =>
		makeFunctionRefFromBound<number>(
			surql`math::abs(${target})`,
			simpleNumberDef(),
		);
	target.ceil = () =>
		makeFunctionRefFromBound<number>(
			surql`math::ceil(${target})`,
			simpleNumberDef(),
		);
	target.floor = () =>
		makeFunctionRefFromBound<number>(
			surql`math::floor(${target})`,
			simpleNumberDef(),
		);
	target.round = () =>
		makeFunctionRefFromBound<number>(
			surql`math::round(${target})`,
			simpleNumberDef(),
		);
	target.sqrt = () =>
		makeFunctionRefFromBound<number>(
			surql`math::sqrt(${target})`,
			simpleNumberDef(),
		);
	target.clamp = (
		min: number | ColumnRef<number>,
		max: number | ColumnRef<number>,
	) =>
		makeFunctionRefFromBound<number>(
			surql`math::clamp(${target}, ${min}, ${max})`,
			simpleNumberDef(),
		);
}

function addDateTimeMethods(target: DateTimeColumn): void {
	target.year = () =>
		makeFunctionRefFromBound<number>(
			surql`time::year(${target})`,
			simpleNumberDef(),
		);
	target.month = () =>
		makeFunctionRefFromBound<number>(
			surql`time::month(${target})`,
			simpleNumberDef(),
		);
	target.day = () =>
		makeFunctionRefFromBound<number>(
			surql`time::day(${target})`,
			simpleNumberDef(),
		);
	target.hour = () =>
		makeFunctionRefFromBound<number>(
			surql`time::hour(${target})`,
			simpleNumberDef(),
		);
	target.unix = () =>
		makeFunctionRefFromBound<number>(
			surql`time::unix(${target})`,
			simpleNumberDef(),
		);
}

function addArrayMethods(
	target: ArrayColumn<unknown>,
	field: InternalFieldDef,
): void {
	const elementField = getElementField(field);

	target.contains = (value: unknown) => surql`${target} CONTAINS ${value}`;
	target.length = () =>
		makeFunctionRefFromBound<number>(
			surql`array::len(${target})`,
			simpleNumberDef(),
		);
	target.distinct = () =>
		makeFunctionRefFromBound<unknown[]>(
			surql`array::distinct(${target})`,
			simpleArrayDef(elementField),
		);
	target.join = (separator: string | ColumnRef<string>) =>
		makeFunctionRefFromBound<string>(
			surql`array::join(${target}, ${separator})`,
			simpleStringDef(),
		);
	target.flatten = () =>
		makeFunctionRefFromBound<unknown[]>(
			surql`array::flatten(${target})`,
			simpleArrayDef(),
		);
}

// ============================================================================
// Field proxy factory
// ============================================================================

/**
 * Creates a typed field proxy from a table's field definitions.
 *
 * @param fields The internal field definitions for the table.
 * @returns A proxy object where each property is a typed {@link ColumnRef}.
 * @internal
 */
export function createFieldProxy<
	TFields extends Record<string, FieldDefinition<unknown>>,
>(fields: TFields): FieldProxy<TFields> {
	return new Proxy({} as FieldProxy<TFields>, {
		get(_target, prop) {
			if (typeof prop !== "string") return undefined;
			if (prop in fields) {
				return createColumnRef(prop, fields[prop] as InternalFieldDef);
			}
			return undefined;
		},
	});
}

/**
 * Creates a typed column reference for a specific field path.
 *
 * @param path The SurrealQL path for the column.
 * @param field The internal field definition.
 * @returns A typed column reference with field-specific methods.
 */
function createColumnRef<T = unknown>(
	path: string,
	field: InternalFieldDef,
): ColumnRef<T> & MethodsFor<NonNullable<T>> {
	const ref: ColumnRefBuilder<T> & { __field?: InternalFieldDef } = {
		[PATH]: path,
		__field: field,
		toSQL: () => path,
		...createOperatorMethods(),
		as: function <R>(this: ColumnRef<T>): TypedExpr<R> {
			return typed<R>(this);
		},
	};

	addMethods(ref, field);
	attachNamespaces(ref);

	return new Proxy(ref, {
		get(target, prop) {
			if (typeof prop === "symbol") {
				return prop === PATH ? target[PATH] : undefined;
			}
			if (prop in target) {
				return Reflect.get(target, prop);
			}
			const nested = getNestedFields(field);
			if (nested && prop in nested) {
				const child = nested[prop];
				if (!child) return undefined;
				return createColumnRef<unknown>(`${path}.${prop}`, child);
			}
			return undefined;
		},
	}) as ColumnRef<T> & MethodsFor<NonNullable<T>>;
}

function combineExpressions(
	operator: string,
	exprs: (Expr | BoundQuery)[],
): BoundQuery {
	if (exprs.length === 0) return surql`true`;
	if (exprs.length === 1) return surql`(${exprs[0]})`;
	const strings: string[] = ["("];
	for (let i = 0; i < exprs.length - 1; i++) strings.push(`) ${operator} (`);
	strings.push(")");
	return surql(makeTemplateStringsArray(strings), ...exprs);
}

/**
 * Combines multiple expressions with `AND`.
 * Accepts both `Expr` and `BoundQuery` values.
 */
export function and(...exprs: (Expr | BoundQuery)[]): BoundQuery {
	return combineExpressions("AND", exprs);
}

/**
 * Combines multiple expressions with `OR`.
 * Accepts both `Expr` and `BoundQuery` values.
 */
export function or(...exprs: (Expr | BoundQuery)[]): BoundQuery {
	return combineExpressions("OR", exprs);
}

/**
 * Negates an expression with `NOT`.
 * Accepts both `Expr` and `BoundQuery` values.
 */
export function not(expr: Expr | BoundQuery): BoundQuery {
	return surql`NOT (${expr})`;
}

/**
 * Standalone equality comparison.
 * Same as `field.eq(value)`.
 */
export function eq<T>(
	field: ColumnRef<T>,
	value: T | ColumnRef<T>,
): BoundQuery {
	return field.eq(value);
}

/**
 * Standalone not-equal comparison.
 * Same as `field.ne(value)`.
 */
export function ne<T>(
	field: ColumnRef<T>,
	value: T | ColumnRef<T>,
): BoundQuery {
	return field.ne(value);
}

/**
 * Standalone greater-than comparison.
 * Same as `field.gt(value)`.
 */
export function gt<T>(
	field: ColumnRef<T>,
	value: T | ColumnRef<T>,
): BoundQuery {
	return field.gt(value);
}

/**
 * Standalone greater-than-or-equal comparison.
 * Same as `field.gte(value)`.
 */
export function gte<T>(
	field: ColumnRef<T>,
	value: T | ColumnRef<T>,
): BoundQuery {
	return field.gte(value);
}

/**
 * Standalone less-than comparison.
 * Same as `field.lt(value)`.
 */
export function lt<T>(
	field: ColumnRef<T>,
	value: T | ColumnRef<T>,
): BoundQuery {
	return field.lt(value);
}

/**
 * Standalone less-than-or-equal comparison.
 * Same as `field.lte(value)`.
 */
export function lte<T>(
	field: ColumnRef<T>,
	value: T | ColumnRef<T>,
): BoundQuery {
	return field.lte(value);
}

// ============================================================================
// Additional SurrealQL operators
// ============================================================================

/**
 * Exact equality comparison (`==`).
 * Unlike `=`, `==` does not coerce types (e.g. `10 == "10"` is false).
 */
export function exact<T>(
	field: ColumnRef<T>,
	value: T | ColumnRef<T>,
): BoundQuery {
	return field.exact(value);
}

/**
 * Check that the field is `NONE`.
 * SurrealDB distinguishes `NONE` (absent/missing) from `NULL` (present with no value).
 */
export function isNone(field: ColumnRef<unknown>): BoundQuery {
	return field.isNone();
}

/**
 * Check that the field is not `NONE`.
 */
export function isNotNone(field: ColumnRef<unknown>): BoundQuery {
	return field.isNotNone();
}

/**
 * Check that the field is `NULL`.
 */
export function isNull(field: ColumnRef<unknown>): BoundQuery {
	return field.isNull();
}

/**
 * Check that the field is not `NULL`.
 */
export function isNotNull(field: ColumnRef<unknown>): BoundQuery {
	return field.isNotNull();
}

/**
 * Check that the field is truthy (not `NONE`, `NULL`, `false`, or an empty string).
 */
export function isTrue(field: ColumnRef<unknown>): BoundQuery {
	return field.isTrue();
}

/**
 * Check that the field is falsy (`NONE`, `NULL`, `false`, or an empty string).
 */
export function isFalse(field: ColumnRef<unknown>): BoundQuery {
	return field.isFalse();
}

/**
 * Check that the field is inside a geometry or value (`INSIDE`).
 * Useful for geometry containment checks.
 */
export function inside(field: ColumnRef<unknown>, value: unknown): BoundQuery {
	return field.inside(value);
}

/**
 * Check that the field is outside a geometry or value (`OUTSIDE`).
 */
export function outside(field: ColumnRef<unknown>, value: unknown): BoundQuery {
	return field.outside(value);
}

/**
 * Check that the field intersects a geometry (`INTERSECTS`).
 */
export function intersects(
	field: ColumnRef<unknown>,
	value: unknown,
): BoundQuery {
	return field.intersects(value);
}

/**
 * Full-text search against the field (`@@`).
 * @param ref Optional search reference number for relevance-ranked queries (`@ref@`).
 *
 * Requires a full-text `SEARCH` index on SurrealDB 2.x/3.x. Regex-style operators
 * such as `~` and `!~` were removed in SurrealDB 3.x; use `matches()` instead.
 */
export function matches(
	field: ColumnRef<unknown>,
	value: unknown,
	ref?: number,
): BoundQuery {
	return field.matches(value, ref);
}

/**
 * Check that the field is one of the values (`IN`).
 */
export function isIn(field: ColumnRef<unknown>, values: unknown[]): BoundQuery {
	return field.isIn(values);
}

/**
 * Check that the field is not one of the values (`NOT IN`).
 */
export function isNotIn(
	field: ColumnRef<unknown>,
	values: unknown[],
): BoundQuery {
	return field.isNotIn(values);
}

/**
 * Check that the field (array or string) contains any of the values (`CONTAINSANY`).
 */
export function containsAny(
	field: ColumnRef<unknown>,
	values: unknown[],
): BoundQuery {
	return field.containsAny(values);
}

/**
 * Check that the field (array or string) contains all of the values (`CONTAINSALL`).
 */
export function containsAll(
	field: ColumnRef<unknown>,
	values: unknown[],
): BoundQuery {
	return field.containsAll(values);
}

/**
 * Check that the field (array or string) contains none of the values (`CONTAINSNONE`).
 */
export function containsNone(
	field: ColumnRef<unknown>,
	values: unknown[],
): BoundQuery {
	return field.containsNone(values);
}

// ============================================================================
// Arithmetic helpers
// ============================================================================

/** Addition (`field + value`). Also used for string/array concatenation. */
export function add<T>(
	field: ColumnRef<T>,
	value: T | ColumnRef<T>,
): ColumnRef<T> {
	return field.add(value);
}

/** Subtraction (`field - value`). */
export function subtract<T>(
	field: ColumnRef<T>,
	value: T | ColumnRef<T>,
): ColumnRef<T> {
	return field.subtract(value);
}

/** Multiplication (`field * value`). */
export function multiply<T>(
	field: ColumnRef<T>,
	value: T | ColumnRef<T>,
): ColumnRef<T> {
	return field.multiply(value);
}

/** Division (`field / value`). */
export function divide<T>(
	field: ColumnRef<T>,
	value: T | ColumnRef<T>,
): ColumnRef<T> {
	return field.divide(value);
}

/** Modulo (`field % value`). */
export function modulo<T>(
	field: ColumnRef<T>,
	value: T | ColumnRef<T>,
): ColumnRef<T> {
	return field.modulo(value);
}

// ============================================================================
// Graph traversal helpers
// ============================================================================

/**
 * Traverse outgoing graph edges (`field->edge`).
 * @param edge The edge table name, or omit for any edge type.
 * @param edgeModel Optional model class for the edge table, enabling typed field access.
 */
export function out(
	field: ColumnRef<unknown>,
	edge?: string,
	edgeModel?: { _fields: Record<string, InternalFieldDef>; _tableName: string },
): ColumnRef<unknown> {
	return field.out(edge, edgeModel);
}

/**
 * Traverse incoming graph edges (`field<-edge`).
 * @param edge The edge table name, or omit for any edge type.
 * @param edgeModel Optional model class for the edge table, enabling typed field access.
 */
export function in_(
	field: ColumnRef<unknown>,
	edge?: string,
	edgeModel?: { _fields: Record<string, InternalFieldDef>; _tableName: string },
): ColumnRef<unknown> {
	return field.in(edge, edgeModel);
}

/**
 * Traverse graph edges in both directions (`field<->edge`).
 * @param edge The edge table name, or omit for any edge type.
 * @param edgeModel Optional model class for the edge table, enabling typed field access.
 */
export function both(
	field: ColumnRef<unknown>,
	edge?: string,
	edgeModel?: { _fields: Record<string, InternalFieldDef>; _tableName: string },
): ColumnRef<unknown> {
	return field.both(edge, edgeModel);
}

// ============================================================================
// Aggregate helpers
// ============================================================================

/**
 * Count records or field values. With no argument, produces `count()` (counts all records).
 * With a field, produces `count(field)` (counts non-null values).
 * Use in `select` projections with `typed()`, e.g. `typed<number>(count())`.
 */
export function count(field?: ColumnRef<unknown>): NumberColumn {
	if (field) {
		return makeFunctionRef<number>(
			(ctx) => `count(${field.toSQL(ctx)})`,
			simpleNumberDef(),
		);
	}
	return makeFunctionRef<number>(() => "count()", simpleNumberDef());
}

/**
 * Sum all values of a field (`math::sum(field)`).
 * Use with `GROUP BY` and `typed()` in select projections.
 */
export function sum(field: ColumnRef<unknown>): NumberColumn {
	return makeFunctionRef<number>(
		(ctx) => `math::sum(${field.toSQL(ctx)})`,
		simpleNumberDef(),
	);
}

/**
 * Average (mean) of all values of a field (`math::mean(field)`).
 */
export function avg(field: ColumnRef<unknown>): NumberColumn {
	return makeFunctionRef<number>(
		(ctx) => `math::mean(${field.toSQL(ctx)})`,
		simpleNumberDef(),
	);
}

/**
 * Minimum value of a field (`math::min(field)`).
 */
export function min(field: ColumnRef<unknown>): NumberColumn {
	return makeFunctionRef<number>(
		(ctx) => `math::min(${field.toSQL(ctx)})`,
		simpleNumberDef(),
	);
}

/**
 * Maximum value of a field (`math::max(field)`).
 */
export function max(field: ColumnRef<unknown>): NumberColumn {
	return makeFunctionRef<number>(
		(ctx) => `math::max(${field.toSQL(ctx)})`,
		simpleNumberDef(),
	);
}

/**
 * Count incoming graph edges (`count(field<-edge)`).
 * @param field The field to traverse from.
 * @param edge The edge table name.
 */
export function countIn(field: ColumnRef<unknown>, edge: string): NumberColumn {
	return makeFunctionRef<number>(
		(ctx) => `count(${field.toSQL(ctx)}<-${edge})`,
		simpleNumberDef(),
	);
}

/**
 * Count outgoing graph edges (`count(field->edge)`).
 * @param field The field to traverse from.
 * @param edge The edge table name.
 */
export function countOut(
	field: ColumnRef<unknown>,
	edge: string,
): NumberColumn {
	return makeFunctionRef<number>(
		(ctx) => `count(${field.toSQL(ctx)}->${edge})`,
		simpleNumberDef(),
	);
}

/**
 * Creates a typed `$value` proxy for use in `ASSERT` callbacks.
 * The proxy references the SurrealDB `$value` special variable and provides
 * type-specific methods based on the field's inferred type.
 *
 * @param fieldDef The field definition to create a value proxy for.
 * @returns A typed {@link ValueRef} referencing `$value`.
 * @internal
 */
export function createValueProxy<T>(fieldDef: InternalFieldDef): ValueRef<T> {
	return createColumnRef<T>("$value", fieldDef);
}
