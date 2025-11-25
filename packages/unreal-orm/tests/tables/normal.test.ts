import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import { surql } from "surrealdb";
import type { Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("normal_table", "normal_table");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Normal Table Creation & Options", () => {
	test("schemafull table: CRUD works", async () => {
		class Product extends Table.normal({
			name: "product",
			fields: {
				name: Field.string(),
				price: Field.number(),
			},
			schemafull: true,
		}) {}
		await applySchema(db, [Product]);
		const prod = await Product.create(db, { name: "Widget", price: 9.99 });
		expect(prod.name).toBe("Widget");
		expect(prod.price).toBe(9.99);
		prod.price = 12.5;
		await prod.update(db, {
			mode: "content",
			data: { name: prod.name, price: 12.5 },
		});
		expect(prod.price).toBe(12.5);
		await prod.delete(db);
		const found = await Product.select(db, { from: prod.id, only: true });
		expect(found).toBeUndefined();
	});

	test("schemaflex table: allows extra fields", async () => {
		class Flex extends Table.normal({
			name: "flex",
			fields: {
				foo: Field.string(),
			},
			schemafull: false,
		}) {}
		await applySchema(db, [Flex]);
		// @ts-ignore
		const flex = await Flex.create(db, { foo: "bar", extra: 42 });
		expect(flex.foo).toBe("bar");
		// Extra fields should be assigned directly to instance
		// @ts-expect-error
		expect(flex.extra).toBe(42);
	});

	test("table permissions: can be set (no runtime check)", async () => {
		class Perm extends Table.normal({
			name: "perm",
			fields: {
				foo: Field.string(),
			},
			permissions: {
				select: surql`where true`,
				create: surql`where true`,
				update: surql`where true`,
				delete: surql`where true`,
			},
			schemafull: true,
		}) {}
		await applySchema(db, [Perm]);
		const perm = await Perm.create(db, { foo: "bar" });
		expect(perm.foo).toBe("bar");
	});
});
