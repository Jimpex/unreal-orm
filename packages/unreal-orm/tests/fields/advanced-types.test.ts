import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Table, Field, applySchema } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";
import { Decimal, Duration, GeometryPoint, Uuid } from "surrealdb";

describe("Advanced Field Types", () => {
	let db: Surreal;

	const AdvancedTypesModel = Table.normal({
		name: "advanced_types",
		fields: {
			anyField: Field.any(),
			decimalField: Field.decimal(),
			floatField: Field.float(),
			intField: Field.int(),
			bytesField: Field.bytes(),
			durationField: Field.duration(),
			uuidField: Field.uuid(),
			pointField: Field.geometry("point"),
			// tagsSet: Field.set(Field.string()),
		},
	});

	beforeAll(async () => {
		db = await setupInMemoryDb();
		await applySchema(db, [AdvancedTypesModel]);
	});

	afterAll(() => teardownDb(db));

	it("should correctly create and retrieve advanced data types", async () => {
		const decimalValue = new Decimal("123.456");

		const created = await AdvancedTypesModel.create(db, {
			anyField: { a: 1, b: "hello" },
			decimalField: decimalValue,
			floatField: 99.9,
			intField: 123,
			bytesField: new Uint8Array([1, 2, 3]).buffer,
			durationField: new Duration("3w"), // 3 weeks
			uuidField: new Uuid("a1b2c3d4-e5f6-7890-1234-567890abcdef"),
			pointField: new GeometryPoint([-0.118092, 51.509865]),
			// tagsSet: new Set(["a", "b", "c"]),
		});

		expect(created).toBeInstanceOf(AdvancedTypesModel);
		expect(created.anyField).toEqual({ a: 1, b: "hello" });
		expect(created.decimalField).toEqual(decimalValue);
		expect(created.floatField).toBe(99.9);
		expect(created.intField).toBe(123);
		expect(created.bytesField).toBeInstanceOf(ArrayBuffer);
		expect(created.durationField.toString()).toBe("3w");
		expect(created.uuidField.toString()).toBe(
			"a1b2c3d4-e5f6-7890-1234-567890abcdef",
		);
		expect(created.pointField).toBeInstanceOf(GeometryPoint);
		// expect(created.tagsSet).toBeInstanceOf(Set);
		// expect(Array.from(created.tagsSet)).toEqual(["a", "b", "c"]);
	});
});
