/**
 * Type-safe field selection for SELECT queries.
 * Supports nested object/record selection, custom computed fields, and raw SurrealQL.
 *
 * @module
 */

import type { BoundQuery, Expr, RecordId } from "surrealdb";
import type { FieldDefinition } from "../../field/types";
import type { InferFieldType, InferShapeFromFields } from "./model";

// ============================================================================
// TypedExpr - Typed SurrealQL expression for custom fields
// ============================================================================

/**
 * A SurrealQL expression with an associated TypeScript type.
 * Created using the `typed()` helper function.
 *
 * @template T The TypeScript type of the expression result.
 * @example
 * ```ts
 * import { typed } from "unreal-orm";
 *
 * const posts = await Post.select({
 *   select: {
 *     title: true,
 *     commentCount: typed<number>(surql`count(<-comment)`),
 *   },
 * });
 * // Type: { title: string; commentCount: number }[]
 * ```
 */
export interface TypedExpr<T = unknown> {
	/** The underlying SurrealQL expression */
	expr: BoundQuery | Expr;
	/** Phantom type marker for type inference */
	__type?: T;
}

/**
 * Creates a typed SurrealQL expression for use in select queries.
 * The type parameter specifies the expected return type of the expression.
 *
 * @template T The TypeScript type of the expression result.
 * @param expr A SurrealQL expression (from `surql` template or Expr).
 * @returns A TypedExpr that carries type information.
 *
 * @example
 * ```ts
 * import { typed } from "unreal-orm";
 * import { surql } from "surrealdb";
 *
 * // Simple computed field
 * const commentCount = typed<number>(surql`count(<-comment)`);
 *
 * // Complex object
 * const stats = typed<{ views: number; likes: number }>(
 *   surql`{ views: count(->view), likes: count(<-like) }`
 * );
 *
 * // Graph traversal
 * const friends = typed<string[]>(surql`->follows->user.name`);
 * ```
 */
export function typed<T>(expr: BoundQuery | Expr): TypedExpr<T> {
	return { expr };
}

// ============================================================================
// Field Selection Types
// ============================================================================

/**
 * A nested field selection object.
 * Used for selecting specific fields from nested objects or records.
 * @internal
 */
export type NestedFieldSelect = {
	[key: string]: true | NestedFieldSelect | TypedExpr<unknown> | undefined;
};

/**
 * Prettify helper
 * @internal
 */
export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

/**
 * Extracts the fields from a record field's linked table.
 * Uses pattern matching to preserve specific types from Field.record().
 * @internal
 */
type ExtractRecordFields<TFieldDef> =
	// Use extends pattern matching to extract the specific recordTableThunk type
	// This works with intersection types like FieldDefinition<T> & { recordTableThunk: () => TModel }
	TFieldDef extends { recordTableThunk: () => infer M }
		? M extends { _fields: infer F }
			? F
			: never
		: never;

/**
 * Extracts the fields from an object field's schema.
 * Uses pattern matching to preserve specific schema types from Field.object().
 * @internal
 */
type ExtractObjectFields<TFieldDef> =
	// Use extends pattern matching to extract the specific objectSchema type
	// This works with intersection types like FieldDefinition<T> & { objectSchema: TSchema }
	TFieldDef extends { objectSchema: infer S }
		? S extends Record<string, FieldDefinition<unknown>>
			? S
			: never
		: never;

/**
 * Extracts the inner nested elements from an array of objects/records recursively.
 * @internal
 */
type ExtractArrayFields<TFieldDef> = TFieldDef extends {
	arrayElementType: infer E;
}
	? GetNestedFields<E>
	: never;

/**
 * Gets the nested fields for a field definition (either from record link, object schema, or array mapping).
 * No constraint on TFieldDef to preserve specific intersection types.
 * @internal
 */
type GetNestedFields<TFieldDef> = ExtractRecordFields<TFieldDef> extends never
	? ExtractObjectFields<TFieldDef> extends never
		? ExtractArrayFields<TFieldDef>
		: ExtractObjectFields<TFieldDef>
	: ExtractRecordFields<TFieldDef>;

/**
 * Resolves to the distinct FieldSelect map if the field defines nested schemas, else defaults to generic selection map.
 * @internal
 */
type NestedSelectForField<TFieldDef> = GetNestedFields<TFieldDef> extends never
	? NestedFieldSelect
	: FieldSelect<
			GetNestedFields<TFieldDef> extends Record<
				string,
				FieldDefinition<unknown>
			>
				? GetNestedFields<TFieldDef>
				: never
		>;

/**
 * Recursively validates that top-level AND nested objects strictly conform to the field schema.
 * All properties not found in `TFields` MUST be instance types of `TypedExpr<unknown>`.
 * Used internally as a parameter constraint on `.select(options)` to reject `invalidField: true`.
 * @internal
 */
export type DeepValidateSelect<TFields, TSelect> = {
	[K in keyof TSelect]: K extends keyof TFields
		? TSelect[K] extends true | TypedExpr<unknown>
			? TSelect[K]
			: TSelect[K] extends object // Nested selection mapping
				? GetNestedFields<TFields[K]> extends never
					? TSelect[K]
					: DeepValidateSelect<GetNestedFields<TFields[K]>, TSelect[K]>
				: TSelect[K]
		: K extends "*" | "id"
			? TSelect[K]
			: TypedExpr<unknown>; // Unknown keys MUST explicitly be TypedExpr queries, rejecting raw booleans
};

/**
 * Type-safe field selection object.
 * Maps field names to selection values (true, nested selection, or typed expression).
 *
 * @template TFields The field definitions of the table.
 *
 * @example
 * ```ts
 * // Select specific fields
 * { title: true, content: true }
 *
 * // Select with nested record
 * { title: true, author: { name: true, email: true } }
 *
 * // Select all + expand record
 * { '*': true, author: true }
 *
 * // With custom computed field
 * { title: true, commentCount: typed<number>(surql`count(<-comment)`) }
 * ```
 */
export type FieldSelect<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = {
	// Known fields from schema - can be true, nested selection, or typed expression
	[K in keyof TFields]?:
		| true
		| NestedSelectForField<TFields[K]>
		| TypedExpr<unknown>;
} & {
	// Special '*' key for selecting all fields
	"*"?: true;
	// id is a special surrealdb variable field natively available on all documents
	id?: true;
};

/**
 * All valid forms of the `select` option.
 * - Object: Type-safe field selection
 * - String array: Pass-through field names (less type-safe)
 * - BoundQuery/Expr: Raw SurrealQL (escape hatch)
 *
 * @template TFields The field definitions of the table.
 */
export type SelectOption<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = FieldSelect<TFields> | string[] | BoundQuery | Expr;

/**
 * Type-safe omit selection object.
 * Maps field names to `true` to omit them from the result.
 *
 * @template TFields The field definitions of the table.
 *
 * @example
 * ```ts
 * // Omit password field
 * { password: true }
 *
 * // Omit multiple fields
 * { password: true, secret: true }
 * ```
 */
export type OmitSelect<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = {
	[K in keyof TFields]?: true;
};

/**
 * Infers the result type when using omit.
 * Returns all fields except the omitted ones.
 *
 * @template TFields The field definitions of the table.
 * @template TOmit The omit selection object.
 */
export type InferOmitResult<
	TFields extends Record<string, FieldDefinition<unknown>>,
	TOmit,
> = Prettify<{
	[K in keyof TFields as K extends keyof TOmit
		? TOmit[K] extends true
			? never
			: K
		: K]: InferFieldType<TFields[K]>;
}>;

// ============================================================================
// Result Type Inference
// ============================================================================

/**
 * Infers the raw database shape of a field before relations are expanded using table-mapping references instead of generic instances.
 * Used internally for wildcard evaluations where `*` maps relations to just pure unhydrated IDs.
 * @internal
 */
type InferRawFieldType<T extends FieldDefinition<unknown>> = T extends {
	recordTableThunk: () => infer M;
}
	? M extends import("./model").ModelStatic<
			// biome-ignore lint/suspicious/noExplicitAny: Required to bypass recursive ModelInstance bound checks in mapped iterators
			any,
			// biome-ignore lint/suspicious/noExplicitAny: Required to bypass recursive ModelInstance bound checks in mapped iterators
			any,
			// biome-ignore lint/suspicious/noExplicitAny: Required to bypass recursive ModelInstance bound checks in mapped iterators
			any
		>
		? RecordId<M extends { _tableName: infer TN } ? TN & string : string>
		: RecordId
	: InferFieldType<T>;

/**
 * Translates table fields into raw database output mappings prior to any record expansion.
 * This is the fallback shape when a field is selected natively or because of a `*` wildcard
 * because `SELECT *` does not automatically expand/fetch relations.
 * @internal
 */
type InferRawShapeFromFields<
	TFields extends Record<string, FieldDefinition<unknown>>,
> = {
	-readonly [K in keyof TFields as string extends K
		? never
		: K]: InferRawFieldType<TFields[K]>;
};

/**
 * Infers the result type for a nested selection on a known field.
 * Uses the field's schema (from recordTableThunk or objectSchema) if available.
 * @internal
 */
type InferNestedFieldResult<TFieldDef, TNestedSelect> =
	GetNestedFields<TFieldDef> extends never
		? // No nested schema available - fall back to basic inference
			InferBasicNestedResult<TNestedSelect>
		: // Has nested schema - use it for type inference
			GetNestedFields<TFieldDef> extends Record<
					string,
					FieldDefinition<unknown>
				>
			? TFieldDef extends { arrayElementType: unknown }
				? Array<
						InferSelectResultFromFields<
							GetNestedFields<TFieldDef>,
							TNestedSelect
						>
					>
				: InferSelectResultFromFields<GetNestedFields<TFieldDef>, TNestedSelect>
			: never;

/**
 * Basic nested result inference without schema info.
 * Used as fallback when no schema is available.
 * @internal
 */
type InferBasicNestedResult<TNestedSelect> = {
	[K in keyof TNestedSelect as K extends "*"
		? never
		: string extends K
			? never
			: K]: TNestedSelect[K] extends true
		? unknown
		: TNestedSelect[K] extends TypedExpr<infer T>
			? T
			: TNestedSelect[K] extends object
				? InferBasicNestedResult<TNestedSelect[K]>
				: unknown;
};

/**
 * Infers the result type from a FieldSelect object.
 * Provides type inference for:
 * - Known fields with `true` → field type from schema
 * - TypedExpr → the typed value
 * - Nested objects → recursively inferred from linked table or object schema
 * @internal
 */
type InferSelectResultFromFields<
	TFields extends Record<string, FieldDefinition<unknown>>,
	TSelect,
> = Prettify<
	{
		// For each key in the selection (excluding '*' and generic string index signatures)
		[K in keyof TSelect as K extends "*"
			? never
			: string extends K
				? never
				: K]: K extends keyof TFields
			? // Known field from schema
				TSelect[K] extends true
				? InferFieldType<TFields[K]>
				: TSelect[K] extends TypedExpr<infer T>
					? T
					: TSelect[K] extends object
						? // Nested selection - use field's schema for inference
							InferNestedFieldResult<TFields[K], TSelect[K]>
						: never
			: K extends "id"
				? RecordId
				: // Custom field (not in schema)
					TSelect[K] extends TypedExpr<infer T>
					? T
					: TSelect[K] extends object
						? InferBasicNestedResult<TSelect[K]>
						: unknown;
	} & (TSelect extends { "*": true }
		? // SELECT * returns fields as stored — record links remain as RecordIds (not expanded)
			// Apply Omit against keyof TSelect to prevent the explicit overrides above from interacting and causing Omit combinations into {} unions
			Omit<InferRawShapeFromFields<TFields> & { id: RecordId }, keyof TSelect>
		: // biome-ignore lint/complexity/noBannedTypes: Need empty object for intersection
			{})
>;

/**
 * Infers the complete result type from a select option.
 *
 * @template TFields The field definitions of the table.
 * @template TSelect The select option value.
 *
 * - FieldSelect object → Precise type based on selection
 * - String array → Partial<TableData>
 * - BoundQuery/Expr → unknown (or generic override)
 */
export type InferSelectResult<
	TFields extends Record<string, FieldDefinition<unknown>>,
	TSelect,
> = TSelect extends BoundQuery | Expr // Raw SurrealQL - unknown type
	? unknown
	: // String array - partial type
		TSelect extends string[]
		? Partial<InferShapeFromFields<TFields>>
		: // Object selection - infer from fields
			TSelect extends object
			? InferSelectResultFromFields<TFields, TSelect>
			: // Fallback
				InferShapeFromFields<TFields>;
