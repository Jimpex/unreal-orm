/**
 * Type tests for the new type-safe select API.
 * These tests verify compile-time type inference without running actual queries.
 *
 * Type assertions use the pattern:
 *   const _check: ExpectedType = value;
 * If this compiles, the type is correct.
 */

import { describe, expect, test } from "bun:test";
import { type Surreal, surql } from "surrealdb";
import { Field, Table, typed } from "../../src";
import type { FieldDefinition } from "../../src/define/field/types";
import type {
	FieldSelect,
	InferOmitResult,
	InferSelectResult,
	TypedExpr,
} from "../../src/define/table/types/select";

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
		status: Field.union([Field.literal("draft"), Field.literal("published")]),
		flexibleValue: Field.union([Field.string(), Field.int()]),
		literalConfig: Field.literal({
			mode: "strict",
			enabled: true,
		}),
		author: Field.record(() => Author),
		metadata: Field.object({
			tags: Field.array(Field.string()),
			category: Field.string(),
			featured: Field.bool(),
			history: Field.array(
				Field.object({
					date: Field.string(),
					action: Field.string(),
				}),
			),
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

	test("should allow custom computed fields with TypedExpr via explicit cast or SelectOption", () => {
		const select = {
			title: true,
			commentCount: typed<number>(surql`count(<-comment)`),
		} as const;

		expect(select.title).toBe(true);
		expect(select.commentCount.expr).toBeDefined();
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

	test("should preserve literal and union field inference on model instances", () => {
		const post = {} as InstanceType<typeof Post>;

		const _status: "draft" | "published" = post.status;
		const _flexibleValue: string | number = post.flexibleValue;
		const _literalConfig: {
			mode: "strict";
			enabled: true;
		} = post.literalConfig;

		// @ts-expect-error - invalid literal value should be rejected
		post.status = "archived";
		// @ts-expect-error - number is not in the union type
		post.flexibleValue = true;
		// @ts-expect-error - invalid literal config value
		post.literalConfig = { mode: "invalid" };

		expect(true).toBe(true);
	});

	test("should infer custom computed fields", () => {
		// With strict FieldSelect, custom computed fields must be cast or passed dynamically
		// since they are not in the schema.
		const selectOpts = {
			title: true as const,
			commentCount: typed<number>(surql`count()`),
		} as const;

		type Result = InferSelectResult<SimpleFields, typeof selectOpts>;

		// The result should have title: string and commentCount: number
		const _check: AssertAssignable<
			{ title: string; commentCount: number },
			Result
		> = {} as Result;

		expect(true).toBe(true);
	});

	test("should offer suggestions for nested record/object/array fields (FieldSelect input type)", () => {
		type PostFields = (typeof Post)["_fields"];

		// 1. Record linkages (author = User)
		const _recordSelect: FieldSelect<PostFields> = {
			author: { name: true, email: true }, // Should compile (valid User fields)
		};

		// 2. Objects (metadata), Arrays of strings (tags), and Arrays of objects (history)
		const _objectSelect: FieldSelect<PostFields> = {
			metadata: {
				category: true,
				tags: true, // Should compile because tags is an array of primitives
				history: {
					date: true,
				}, // Should compile and offer suggestions on history elements
			},
		};

		expect(true).toBe(true);
	});

	test("should reject unknown nested fields in FieldSelect input type", () => {
		type PostFields = (typeof Post)["_fields"];

		// This uses @ts-expect-error to verify compilation fails for invalid fields
		// We expect these to error because invalidField is not on User
		const _recordSelect: FieldSelect<PostFields> = {
			// @ts-expect-error
			author: { invalidField: true },
		};

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

	test("should allow overriding wildcard base properties with sub-selections", () => {
		type PostFields = (typeof Post)["_fields"];

		type Result = InferSelectResult<
			PostFields,
			{
				"*": true;
				author: { name: true };
			}
		>;

		// Result should contain 'title', 'content' (from '*'), and 'author' should only have 'name'
		type ExpectedAuthor = { name: string };
		type ActualAuthor = Result extends { author: infer A } ? A : never;

		const _checkAuthor: AssertAssignable<ExpectedAuthor, ActualAuthor> =
			{} as ActualAuthor;

		// Ensure primary properties from '*' still map
		const _checkTitle: string = "" as Result extends { title: infer T }
			? T
			: never;

		expect(true).toBe(true);
	});

	test("should append extra computed fields alongside wildcard", () => {
		type PostFields = (typeof Post)["_fields"];

		type Result = InferSelectResult<
			PostFields,
			{
				"*": true;
				commentCount: TypedExpr<number>;
				extraData: { someString: TypedExpr<string> };
			}
		>;

		const _checkCommentCount: number = 0 as Result extends {
			commentCount: infer C;
		}
			? C
			: never;
		const _checkExtraData: { someString: string } = {} as Result extends {
			extraData: infer E;
		}
			? E
			: never;

		// Base field
		const _checkTitle: string = "" as Result extends { title: infer T }
			? T
			: never;

		expect(true).toBe(true);
	});

	test("should infer 'id' as RecordId", () => {
		type PostFields = (typeof Post)["_fields"];

		type Result = InferSelectResult<
			PostFields,
			{
				id: true;
			}
		>;

		type IdField = Result extends { id: infer I } ? I : never;

		// Verify id field is compatible with RecordId via bidirectional assignability check.
		// (Direct assignment fails due to RecordId's #private fields; this pattern avoids that.)
		type _checkIdExtendsRecordId = IdField extends import("surrealdb").RecordId
			? true
			: "Error: id field should extend RecordId";
		type _checkRecordIdExtendsId = import("surrealdb").RecordId extends IdField
			? true
			: "Error: RecordId should extend id field type";
		const _assertId: _checkIdExtendsRecordId = true;
		const _assertRecordId: _checkRecordIdExtendsId = true;

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

describe("End-to-End Type Inference using Table Methods", () => {
	test("should properly infer select result types from Table.select() signature", () => {
		// Wrap in a function so it is never executed at runtime, only evaluated by TS compiler
		const getResult = () => {
			const db = {} as unknown as Surreal;
			return Post.select(db, {
				select: {
					title: true,
					author: { name: true, email: true },
					metadata: { category: true, history: { date: true } },
				},
			});
		};

		type ExpectedResultArray = Array<{
			title: string;
			author: { name: string; email: string };
			metadata: { category: string; history: Array<{ date: string }> };
		}>;

		// Verify the inferred return type of the generated promise
		const _check: AssertAssignable<
			ExpectedResultArray,
			Awaited<ReturnType<typeof getResult>>
		> = {} as Awaited<ReturnType<typeof getResult>>;

		expect(true).toBe(true);
	});
});
