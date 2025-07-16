// Tests for Field.option (optional fields)

import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema, generateFullSchemaQl } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("option_test", "option_test");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Field.option - all base types", () => {
	class OptionModel extends Table.normal({
		name: "option_model",
		fields: {
			optString: Field.option(Field.string()),
			optNumber: Field.option(Field.number()),
			optBool: Field.option(Field.bool()),
			optDate: Field.option(Field.datetime()),
			optObj: Field.option(Field.object({ foo: Field.string() })),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for all option fields", async () => {
		const ddl = generateFullSchemaQl([OptionModel]);
		expect(ddl).toContain(
			"DEFINE FIELD optString ON TABLE option_model TYPE option<string>",
		);
		expect(ddl).toContain(
			"DEFINE FIELD optNumber ON TABLE option_model TYPE option<number>",
		);
		expect(ddl).toContain(
			"DEFINE FIELD optBool ON TABLE option_model TYPE option<bool>",
		);
		expect(ddl).toContain(
			"DEFINE FIELD optDate ON TABLE option_model TYPE option<datetime>",
		);
		expect(ddl).toContain(
			"DEFINE FIELD optObj ON TABLE option_model TYPE option<object>",
		);
		await applySchema(db, [OptionModel], "OVERWRITE");
	});

	test("should allow setting each optional field", async () => {
		const now = new Date();
		const record = await OptionModel.create(db, {
			optString: "foo",
			optNumber: 42,
			optBool: true,
			optDate: now,
			optObj: { foo: "bar" },
		});
		expect(record.optString).toBe("foo");
		expect(record.optNumber).toBe(42);
		expect(record.optBool).toBe(true);
		if (record.optDate) {
			expect(new Date(record.optDate).toISOString()).toBe(now.toISOString());
		}
		expect(record.optObj?.foo).toBe("bar");
	});
});

describe("Field.option - negative cases", () => {
	class StrictOptionModel extends Table.normal({
		name: "strict_option_model",
		fields: { val: Field.option(Field.number()) },
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for strict option", async () => {
		const ddl = generateFullSchemaQl([StrictOptionModel]);
		expect(ddl).toContain(
			"DEFINE FIELD val ON TABLE strict_option_model TYPE option<number>",
		);
		await applySchema(db, [StrictOptionModel], "OVERWRITE");
	});

	test("should throw when setting wrong type for option field", async () => {
		expect(
			// @ts-expect-error
			StrictOptionModel.create(db, { val: "notanumber" }),
		).rejects.toThrow();
	});
});
