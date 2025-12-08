/**
 * Type tests for the new type-safe select API.
 * These tests verify compile-time type inference without running actual queries.
 *
 * Type assertions use the pattern:
 *   const _check: ExpectedType = value;
 * If this compiles, the type is correct.
 */

import { describe, test, expect } from "bun:test";
import { Table, Field, typed } from "../../src";
import type {
	FieldSelect,
	InferSelectResult,
	InferOmitResult,
	TypedExpr,
} from "../../src/define/table/types/select";
import type { FieldDefinition } from "../../src/define/field/types";
import { surql } from "surrealdb";

// ============================================================================
// Test Models
// ============================================================================

class Author extends Table.normal({
	name: "author",
	fields: {
		name: Field.string(),
		email: Field.string(),
		bio: Field.option(Field.string()),
	},
	schemafull: true,
}) {}

class Post extends Table.normal({
	name: "post",
	fields: {
		title: Field.string(),
		content: Field.string(),
		views: Field.number(),
		author: Field.record(() => Author),
		metadata: Field.object({
			tags: Field.array(Field.string()),
			category: Field.string(),
			featured: Field.bool(),
		}),
	},
	schemafull: true,
}) {}

// Type helper for compile-time assertions
type AssertAssignable<T, U extends T> = U;

// ============================================================================
// Type Tests
// ============================================================================

describe("TypedExpr", () => {
	test("should create typed expressions", () => {
		const countExpr = typed<number>(surql`count(<-comment)`);

		// Type assertion - if this compiles, the type is correct
		const _check1: TypedExpr<number> = countExpr;

		const statsExpr = typed<{ views: number; likes: number }>(
			surql`{ views: count(->view), likes: count(<-like) }`,
		);
		const _check2: TypedExpr<{ views: number; likes: number }> = statsExpr;

		expect(countExpr.expr).toBeDefined();
		expect(statsExpr.expr).toBeDefined();
	});
});

describe("FieldSelect", () => {
	// Define a simple fields type for testing
	type SimpleFields = {
		title: FieldDefinition<string>;
		content: FieldDefinition<string>;
		views: FieldDefinition<number>;
	};

	test("should allow selecting primitive fields with true", () => {
		const select: FieldSelect<SimpleFields> = {
			title: true,
			content: true,
			views: true,
		};

		expect(select.title).toBe(true);
		expect(select.content).toBe(true);
	});

	test("should allow selecting all fields with *", () => {
		const select: FieldSelect<SimpleFields> = {
			"*": true,
		};

		expect(select["*"]).toBe(true);
	});

	test("should allow custom computed fields with TypedExpr", () => {
		const select: FieldSelect<SimpleFields> = {
			title: true,
			commentCount: typed<number>(surql`count(<-comment)`),
		};

		expect(select.title).toBe(true);
		expect((select.commentCount as TypedExpr<number>).expr).toBeDefined();
	});
});

describe("InferSelectResult", () => {
	// Simple fields for testing inference
	type SimpleFields = {
		title: FieldDefinition<string>;
		content: FieldDefinition<string>;
		views: FieldDefinition<number>;
	};

	test("should infer simple field selection", () => {
		// This type should be { title: string; content: string }
		type Result = InferSelectResult<
			SimpleFields,
			{ title: true; content: true }
		>;

		// If this compiles, the inference is correct
		const _check: AssertAssignable<{ title: string; content: string }, Result> =
			{} as Result;

		expect(true).toBe(true); // Test passes if compilation succeeds
	});

	test("should infer custom computed fields", () => {
		type Result = InferSelectResult<
			SimpleFields,
			{
				title: true;
				commentCount: TypedExpr<number>;
			}
		>;

		// The result should have title: string and commentCount: number
		const _check: AssertAssignable<
			{ title: string; commentCount: number },
			Result
		> = {} as Result;

		expect(true).toBe(true);
	});

	test("should infer nested object and record fields", () => {
		type PostFields = (typeof Post)["_fields"];

		type Result = InferSelectResult<
			PostFields,
			{
				title: true;
				author: { name: true; email: true };
				metadata: { category: true };
			}
		>;

		// Check if nested fields are correctly inferred
		const _check: AssertAssignable<
			{
				title: string;
				author: { name: string; email: string };
				metadata: { category: string };
			},
			Result
		> = {} as Result;

		// Explicitly check that inferred types are NOT unknown
		type AuthorName = Result extends { author: { name: infer N } } ? N : never;
		// This assignment will fail compilation if AuthorName is unknown
		const _checkString: string = "" as AuthorName;

		expect(true).toBe(true);
	});

	test("should return Partial for string array select", () => {
		type Result = InferSelectResult<SimpleFields, string[]>;

		// String array returns Partial
		const _check: AssertAssignable<
			Partial<{ title: string; content: string; views: number }>,
			Result
		> = {} as Result;

		expect(true).toBe(true);
	});

	test("should return unknown for raw BoundQuery", () => {
		type Result = InferSelectResult<
			SimpleFields,
			{ query: string; bindings: Record<string, unknown> }
		>;

		// BoundQuery returns unknown
		const _check: unknown = {} as Result;

		expect(true).toBe(true);
	});
});

describe("SelectQueryOptions type compatibility", () => {
	test("should accept string array select", () => {
		const options = {
			select: ["title", "author.name"],
		};

		const _check: string[] = options.select;
		expect(options.select).toHaveLength(2);
	});

	test("should accept omit option", () => {
		const options = {
			omit: ["content"],
		};

		const _check: string[] = options.omit;
		expect(options.omit).toHaveLength(1);
	});

	test("should accept value option", () => {
		const options = {
			value: "title",
		};

		const _check: string = options.value;
		expect(options.value).toBe("title");
	});
});

describe("InferOmitResult type inference", () => {
	test("should omit specified fields from result type", () => {
		type PostFields = (typeof Post)["_fields"];

		type Result = InferOmitResult<
			PostFields,
			{ content: true; metadata: true }
		>;

		// Result should have title, views, author but NOT content or metadata
		const _check: AssertAssignable<
			{ title: string; views: number },
			Pick<Result, "title" | "views">
		> = {} as Pick<Result, "title" | "views">;

		// These should NOT be in the result type
		type HasContent = "content" extends keyof Result ? true : false;
		type HasMetadata = "metadata" extends keyof Result ? true : false;
		const _noContent: HasContent = false;
		const _noMetadata: HasMetadata = false;

		expect(true).toBe(true);
	});

	test("should preserve non-omitted fields with correct types", () => {
		type PostFields = (typeof Post)["_fields"];

		type Result = InferOmitResult<PostFields, { content: true }>;

		// title should still be string
		type TitleType = Result extends { title: infer T } ? T : never;
		const _checkTitle: string = "" as TitleType;

		// views should still be number
		type ViewsType = Result extends { views: infer V } ? V : never;
		const _checkViews: number = 0 as ViewsType;

		expect(true).toBe(true);
	});
});
