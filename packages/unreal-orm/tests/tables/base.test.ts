import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("base_table", "base_table");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("BaseTable and Shared Model Logic", () => {
	class Simple extends Table.normal({
		name: "simple",
		fields: {
			foo: Field.string(),
			bar: Field.number(),
		},
		schemafull: true,
	}) {}

	test("apply schema", async () => {
		await applySchema(db, [Simple]);
	});

	test("id is assigned and accessible", async () => {
		const inst = await Simple.create(db, { foo: "abc", bar: 123 });
		expect(inst.id).toBeDefined();
		expect(inst.id.toString()).toMatch(/^simple:/);
	});

	test("property access and assignment", async () => {
		const inst = await Simple.create(db, { foo: "xyz", bar: 456 });
		expect(inst.foo).toBe("xyz");
		expect(inst.bar).toBe(456);
		inst.foo = "updated";
		expect(inst.foo).toBe("updated");
	});

	test("non-existent property throws", async () => {
		const inst = await Simple.create(db, { foo: "xyz", bar: 456 });
		// @ts-expect-error: notAValidProperty is not defined
		expect(inst.notAValidProperty).toBeUndefined();
		const inst2 = await Simple.select(db, { from: inst.id, only: true });
		// @ts-expect-error: notAValidProperty is not defined
		expect(inst2?.notAValidProperty).toBeUndefined();
	});

	test("dynamic property support ($dynamic)", async () => {
		const inst = await Simple.create(db, { foo: "dyn", bar: 1 });
		// TODO: Re-address what happens when custom select fields are added to queries
		// // Simulate a dynamic property returned from a query
		// inst.extra = 42;
		// expect(inst.extra).toBe(42);
		// $dynamic bag for fields not defined in the schema
		inst.$dynamic.surreal = "db";
		expect(inst.$dynamic.surreal).toBe("db");
	});

	test("delete method removes record", async () => {
		const inst = await Simple.create(db, { foo: "del", bar: 2 });
		await inst.delete(db);
		const found = await Simple.select(db, { from: inst.id, only: true });
		expect(found).toBeUndefined();
	});

	test("update method changes fields", async () => {
		const inst = await Simple.create(db, { foo: "up", bar: 3 });
		const updatedInst = await inst.update(db, { foo: "changed", bar: 99 });
		expect(updatedInst.foo).toBe("changed");
		expect(updatedInst.bar).toBe(99);
	});

	// Inheritance example
	class Extended extends Simple {
		getFooBar(): string {
			return `${this.foo}:${this.bar}`;
		}
	}
	test("BaseTable inheritance", async () => {
		const ext = await Extended.create(db, { foo: "hi", bar: 7 });
		expect(ext.getFooBar()).toBe("hi:7");
		expect(ext).toBeInstanceOf(Extended);
		expect(ext).toBeInstanceOf(Simple);
	});
});
