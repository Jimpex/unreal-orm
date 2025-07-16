// Tests for Field.custom (custom SurrealQL types)

import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema, generateFullSchemaQl } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import { GeometryPoint, type Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("custom_test", "custom_test");
});
afterAll(async () => {
	await teardownDb(db);
});

const PointField = Field.custom<GeometryPoint>("point");

describe("Field.custom - basic", () => {
	class CustomModel extends Table.normal({
		name: "custom_model",
		fields: {
			point: PointField,
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for custom field", async () => {
		const ddl = generateFullSchemaQl([CustomModel]);
		expect(ddl).toContain(
			"DEFINE FIELD point ON TABLE custom_model TYPE point",
		);
		await applySchema(db, [CustomModel]);
	});

	test("should create record with custom field", async () => {
		const record = await CustomModel.create(db, {
			point: new GeometryPoint([1, 2]),
		});
		expect(record.point).toEqual(new GeometryPoint([1, 2]));
	});
});

describe("Field.custom - optional", () => {
	class OptionalCustomModel extends Table.normal({
		name: "optional_custom_model",
		fields: {
			maybe: Field.option(PointField),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for optional custom field", async () => {
		const ddl = generateFullSchemaQl([OptionalCustomModel]);
		expect(ddl).toContain(
			"DEFINE FIELD maybe ON TABLE optional_custom_model TYPE option<point>",
		);
		await applySchema(db, [OptionalCustomModel]);
	});

	test("should allow setting optional custom field", async () => {
		const record = await OptionalCustomModel.create(db, {
			maybe: new GeometryPoint([5, 7]),
		});
		expect(record.maybe).toEqual(new GeometryPoint([5, 7]));
	});
});

describe("Field.custom - negative cases", () => {
	class StrictCustomModel extends Table.normal({
		name: "strict_custom_model",
		fields: { val: PointField },
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for strict custom field", async () => {
		const ddl = generateFullSchemaQl([StrictCustomModel]);
		expect(ddl).toContain(
			"DEFINE FIELD val ON TABLE strict_custom_model TYPE point",
		);
		await applySchema(db, [StrictCustomModel]);
	});

	test("should throw when setting wrong type for custom field", async () => {
		expect(
			// @ts-expect-error
			StrictCustomModel.create(db, { val: "notapoint" }),
		).rejects.toThrow();
	});
});
