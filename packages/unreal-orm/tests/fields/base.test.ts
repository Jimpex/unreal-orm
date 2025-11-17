import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema, generateFullSchemaQl } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import { surql } from "surrealdb";
import type { Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("fields_base", "fields_base");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("FieldOptions (base) - generic field option behaviors", () => {
	class BaseTable extends Table.normal({
		name: "fieldopt_user",
		fields: {
			asserted: Field.string({ assert: surql`$value.len() > 3` }),
			withDefault: Field.number({ default: surql`42` }),
			withValue: Field.option(
				Field.string({ value: surql`$value && string::lowercase($value)` }),
			),
			readonlyField: Field.option(Field.string({ readonly: true })),
			withPermissions: Field.option(
				Field.string({
					permissions: { select: surql`WHERE $auth.id = id` },
				}),
			),
			withComment: Field.option(Field.string({ comment: "A comment" })),
			withSurqlAssert: Field.option(
				Field.string({
					assert: surql`$value.len() > 3`,
				}),
			),
			withSurqlDefault: Field.option(
				Field.number({
					default: surql`42`,
				}),
			),
		},
		schemafull: true,
	}) {}

	test("generate and apply SurrealQL for fields", async () => {
		const ddl = generateFullSchemaQl([BaseTable]);
		expect(ddl).toContain(
			"DEFINE FIELD asserted ON TABLE fieldopt_user TYPE string",
		);
		expect(ddl).toContain(
			"DEFINE FIELD withDefault ON TABLE fieldopt_user TYPE number",
		);
		expect(ddl).toContain(
			"DEFINE FIELD withValue ON TABLE fieldopt_user TYPE option<string>",
		);
		expect(ddl).toContain(
			"DEFINE FIELD readonlyField ON TABLE fieldopt_user TYPE option<string>",
		);
		expect(ddl).toContain(
			"DEFINE FIELD withPermissions ON TABLE fieldopt_user TYPE option<string>",
		);
		expect(ddl).toContain(
			"DEFINE FIELD withComment ON TABLE fieldopt_user TYPE option<string>",
		);
		await applySchema(db, [BaseTable], "OVERWRITE");
	});

	test("assert: rejects invalid, accepts valid", async () => {
		expect(BaseTable.create(db, { asserted: "ab" })).rejects.toThrow();
		const rec = await BaseTable.create(db, { asserted: "abcd" });
		expect(rec.asserted).toBe("abcd");
	});

	test("default: applies if not provided", async () => {
		const rec = await BaseTable.create(db, { asserted: "abcd" });
		expect(rec.withDefault).toBe(42);
	});

	test("value: applies SurrealQL value expr", async () => {
		const rec = await BaseTable.create(db, {
			asserted: "abcd",
			withValue: "FOO",
		});
		// SurrealDB should lowercase via value expr
		expect(rec.withValue).toBe("foo");
	});

	test("readonly: cannot update after creation", async () => {
		const rec = await BaseTable.create(db, {
			asserted: "abcd",
			readonlyField: "init",
		});
		expect(
			rec.update(db, { mode: "merge", data: { readonlyField: "changed" } }),
		).rejects.toThrow();
		// Should still be original value
		const fetched = await BaseTable.select(db, { from: rec.id, only: true });
		expect(fetched?.readonlyField).toBe("init");
	});

	test("permissions: SurrealDB enforces field-level permissions", async () => {
		// This test assumes SurrealDB permissions are enforced; may need to run as different auth context for full check
		// Here, just check that field can be created and selected without error for now
		const rec = await BaseTable.create(db, {
			asserted: "abcd",
			withPermissions: "test",
		});
		expect(rec.withPermissions).toBe("test");
	});

	test("comment: DDL includes comment", () => {
		const ddl = generateFullSchemaQl([BaseTable]);
		expect(ddl).toContain("COMMENT 'A comment'");
	});

	test("BoundQuery: surql templates work for assert and default", () => {
		const ddl = generateFullSchemaQl([BaseTable]);
		// Should include the surql assert clause
		expect(ddl).toContain("ASSERT $value.len() > 3");
		// Should include the surql default clause
		expect(ddl).toContain("DEFAULT 42");
	});

	test("BoundQuery: runtime behavior works with surql", async () => {
		// Test assert with surql
		expect(
			BaseTable.create(db, { asserted: "valid", withSurqlAssert: "ab" }),
		).rejects.toThrow();
		const validRec = await BaseTable.create(db, {
			asserted: "valid",
			withSurqlAssert: "valid",
		});
		expect(validRec.withSurqlAssert).toBe("valid");

		// Test default with surql
		const defaultRec = await BaseTable.create(db, {
			asserted: "valid",
			withSurqlAssert: "test",
		});
		expect(defaultRec.withSurqlDefault).toBe(42);
	});
});
