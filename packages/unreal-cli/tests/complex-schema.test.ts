import { describe, expect, test } from "bun:test";
import { parseSurqlFile } from "../src/introspection/parseSurql";
import { generateCode } from "../src/codegen/generator";
import path from "node:path";

const FIXTURE_PATH = path.join(__dirname, "fixtures/complex-schema.surql");

describe("Complex Schema Parsing", () => {
	test("parses all tables from schema", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);

		const tableNames = schema.tables.map((t) => t.name).sort();
		expect(tableNames).toEqual([
			"category",
			"conversation",
			"inventory",
			"message",
			"offer",
			"post",
			"product",
			"review",
			"user",
		]);
	});

	test("parses relation tables correctly", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);

		const conversation = schema.tables.find((t) => t.name === "conversation");
		expect(conversation?.type).toBe("RELATION");

		const post = schema.tables.find((t) => t.name === "post");
		expect(post?.type).toBe("RELATION");

		const user = schema.tables.find((t) => t.name === "user");
		expect(user?.type).toBe("NORMAL");
	});

	test("parses fields with backtick-escaped names", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);

		const product = schema.tables.find((t) => t.name === "product");
		const valueField = product?.fields.find((f) => f.name === "value");
		expect(valueField).toBeDefined();
		expect(valueField?.type).toBe("option<int>");
	});

	test("parses array fields with [*] notation", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);

		const conversation = schema.tables.find((t) => t.name === "conversation");
		const participants = conversation?.fields.find(
			(f) => f.name === "participants",
		);
		expect(participants?.type).toBe("array<record<user>>");

		// Should also have the [*] constraint field
		const participantsStar = conversation?.fields.find(
			(f) => f.name === "participants[*]",
		);
		expect(participantsStar?.type).toBe("record<user>");
	});

	test("parses nested object fields with dot notation", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);

		const post = schema.tables.find((t) => t.name === "post");

		// Top-level object
		const provided = post?.fields.find((f) => f.name === "provided");
		expect(provided?.type).toBe("object");

		// Nested array
		const providedItems = post?.fields.find((f) => f.name === "provided.items");
		expect(providedItems?.type).toBe("array<object>");

		// Deeply nested field
		const providedItemsProduct = post?.fields.find(
			(f) => f.name === "provided.items[*].product",
		);
		expect(providedItemsProduct?.type).toBe("record<product>");
	});

	test("parses string literal union types (enums)", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);

		const post = schema.tables.find((t) => t.name === "post");
		const status = post?.fields.find((f) => f.name === "status");

		// Should capture the full union type
		expect(status?.type).toBe(
			"'ACTIVE' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'",
		);
		expect(status?.default).toBe("ACTIVE");
	});

	test("parses computed VALUE fields", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);

		const category = schema.tables.find((t) => t.name === "category");
		const activePostCount = category?.fields.find(
			(f) => f.name === "activePostCount",
		);

		expect(activePostCount?.type).toBe("any");
		expect(activePostCount?.value).toContain("count((SELECT id FROM post");
	});

	test("parses future VALUE fields", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);

		const post = schema.tables.find((t) => t.name === "post");
		const totalOffers = post?.fields.find((f) => f.name === "totalOffers");

		expect(totalOffers?.type).toBe("any");
		expect(totalOffers?.value).toContain("<future>");
	});

	test("parses search indexes", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);

		const category = schema.tables.find((t) => t.name === "category");
		const nameIndex = category?.indexes.find((i) => i.name === "category_name");

		expect(nameIndex).toBeDefined();
		expect(nameIndex?.columns).toEqual(["name"]);
		expect(nameIndex?.search).toBe(true);
	});

	test("parses composite indexes", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);

		const post = schema.tables.find((t) => t.name === "post");
		const compositeIndex = post?.indexes.find(
			(i) => i.name === "idx_post_out_status",
		);

		expect(compositeIndex).toBeDefined();
		expect(compositeIndex?.columns).toEqual(["out", "status"]);
	});
});

describe("Complex Schema Code Generation", () => {
	test("generates code for all tables", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);
		const files = generateCode(schema);

		expect(files.has("Conversation.ts")).toBe(true);
		expect(files.has("Message.ts")).toBe(true);
		expect(files.has("Category.ts")).toBe(true);
		expect(files.has("Product.ts")).toBe(true);
		expect(files.has("Post.ts")).toBe(true);
		expect(files.has("Offer.ts")).toBe(true);
		expect(files.has("User.ts")).toBe(true);
		expect(files.has("Inventory.ts")).toBe(true);
		expect(files.has("Review.ts")).toBe(true);
	});

	test("generates relation table with Table.relation()", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);
		const files = generateCode(schema);

		const conversationCode = files.get("Conversation.ts");
		expect(conversationCode).toContain("Table.relation(");
	});

	test("generates normal table with Table.normal()", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);
		const files = generateCode(schema);

		const userCode = files.get("User.ts");
		expect(userCode).toContain("Table.normal(");
	});

	test("generates imports for record references", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);
		const files = generateCode(schema);

		const postCode = files.get("Post.ts");
		expect(postCode).toContain("import { User } from './User'");
		expect(postCode).toContain("import { Category } from './Category'");
		expect(postCode).toContain("import { Product } from './Product'");
		expect(postCode).toContain("import { Offer } from './Offer'");
	});

	test("generates nested object fields correctly", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);
		const files = generateCode(schema);

		const postCode = files.get("Post.ts");
		// Should have nested Field.object for provided
		expect(postCode).toContain("provided: Field.object({");
		// Should have array with defined object schema from [*] fields
		expect(postCode).toContain("items: Field.array(Field.object({");
	});

	test("generates array element schemas from [*] fields", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);
		const files = generateCode(schema);

		const productCode = files.get("Product.ts");
		// variants[*] defines the array element schema
		expect(productCode).toContain("variants: Field.array(Field.object({");
		// variants[*].name should be inside the object
		expect(productCode).toContain("name: Field.string()");
		// variants[*].description should be option<string>
		expect(productCode).toContain("description: Field.option(Field.string())");
	});

	test("generates record references correctly", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);
		const files = generateCode(schema);

		const postCode = files.get("Post.ts");
		expect(postCode).toContain("() => User");
		expect(postCode).toContain("() => Category");
	});

	test("generates option types correctly", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);
		const files = generateCode(schema);

		const productCode = files.get("Product.ts");
		expect(productCode).toContain("Field.option(");
	});

	test("generates index definitions", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);
		const files = generateCode(schema);

		const productCode = files.get("Product.ts");
		expect(productCode).toContain("Index.define(");
		expect(productCode).toContain('"idx_product_category"');
	});

	test("generates Definitions export array", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);
		const files = generateCode(schema);

		const categoryCode = files.get("Category.ts");
		expect(categoryCode).toContain(
			"export const CategoryDefinitions = [Category",
		);
	});

	test("generates readonly fields correctly", async () => {
		const schema = await parseSurqlFile(FIXTURE_PATH);
		const files = generateCode(schema);

		// createdAt fields are READONLY in the fixture
		const categoryCode = files.get("Category.ts");
		expect(categoryCode).toContain("readonly: true");
	});
});
