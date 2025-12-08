/**
 * Type-safe field selection for SELECT queries.
 * Supports nested object/record selection, custom computed fields, and raw SurrealQL.
 *
 * @module
 */

import type { BoundQuery, Expr } from "surrealdb";
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
	[K in keyof TFields]?: true | NestedFieldSelect | TypedExpr<unknown>;
} & {
	// Special '*' key for selecting all fields
	"*"?: true;
} & {
	// Allow arbitrary string keys for custom computed fields
	[key: string]: true | NestedFieldSelect | TypedExpr<unknown> | undefined;
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
> = {
	[K in keyof TFields as K extends keyof TOmit
		? TOmit[K] extends true
			? never
			: K
		: K]: InferFieldType<TFields[K]>;
};

// ============================================================================
// Result Type Inference
// ============================================================================

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
 * Gets the nested fields for a field definition (either from record link or object schema).
 * No constraint on TFieldDef to preserve specific intersection types.
 * @internal
 */
type GetNestedFields<TFieldDef> = ExtractRecordFields<TFieldDef> extends never
	? ExtractObjectFields<TFieldDef>
	: ExtractRecordFields<TFieldDef>;

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
			InferSelectResultFromFields<GetNestedFields<TFieldDef>, TNestedSelect>;

/**
 * Basic nested result inference without schema info.
 * Used as fallback when no schema is available.
 * @internal
 */
type InferBasicNestedResult<TNestedSelect> = {
	[K in keyof TNestedSelect as K extends "*"
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
> = {
	// For each key in the selection (excluding '*')
	[K in keyof TSelect as K extends "*" ? never : K]: K extends keyof TFields
		? // Known field from schema
			TSelect[K] extends true
			? InferFieldType<TFields[K]>
			: TSelect[K] extends TypedExpr<infer T>
				? T
				: TSelect[K] extends object
					? // Nested selection - use field's schema for inference
						InferNestedFieldResult<TFields[K], TSelect[K]>
					: never
		: // Custom field (not in schema)
			TSelect[K] extends TypedExpr<infer T>
			? T
			: TSelect[K] extends object
				? InferBasicNestedResult<TSelect[K]>
				: unknown;
} & (TSelect extends { "*": true }
	? // If '*' is selected, include all fields from the table
		InferShapeFromFields<TFields>
	: // biome-ignore lint/complexity/noBannedTypes: Need empty object for intersection
		{});

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
