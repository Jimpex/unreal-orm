import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import {
	Field,
	Table,
	Bucket,
	applySchema,
	generateSurqlFromAST,
	extractSchemaFromDefinables,
} from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import { RecordId, surql, type Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("bucket_test", "bucket_test");
});

afterAll(async () => {
	await teardownDb(db);
});

describe("Bucket Support", () => {
	// Define a memory bucket for avatars
	const AvatarBucket = Bucket.define({
		name: "avatars",
		backend: "memory",
		comment: "User avatar storage",
	});

	// Define a table with an optional file field
	class User extends Table.normal({
		name: "user",
		fields: {
			name: Field.string(),
			avatar: Field.option(Field.file()),
		},
		schemafull: true,
	}) {}

	test("Bucket definition has correct structure", () => {
		expect(AvatarBucket._type).toBe("bucket");
		expect(AvatarBucket.name).toBe("avatars");
		expect(AvatarBucket.backend).toBe("memory");
		expect(AvatarBucket.comment).toBe("User avatar storage");
	});

	test("Bucket is extracted to SchemaAST correctly", () => {
		const schema = extractSchemaFromDefinables([AvatarBucket]);
		expect(schema.buckets).toHaveLength(1);
		expect(schema.buckets[0]).toMatchObject({
			name: "avatars",
			backend: "memory",
			comment: "User avatar storage",
		});
	});

	test("Bucket DDL is generated correctly", () => {
		const schema = extractSchemaFromDefinables([AvatarBucket]);
		const ddl = generateSurqlFromAST(schema, "error");
		expect(ddl).toContain("DEFINE BUCKET avatars BACKEND 'memory'");
		expect(ddl).toContain("COMMENT 'User avatar storage'");
	});

	test("Bucket with permissions generates correct DDL", () => {
		const RestrictedBucket = Bucket.define({
			name: "restricted",
			backend: "memory",
			permissions: surql`WHERE $auth.role = 'admin'`,
		});

		const schema = extractSchemaFromDefinables([RestrictedBucket]);
		const ddl = generateSurqlFromAST(schema, "error");
		expect(ddl).toContain("DEFINE BUCKET restricted BACKEND 'memory'");
		expect(ddl).toContain("PERMISSIONS WHERE $auth.role = 'admin'");
	});

	test("Field.file() returns correct field definition", () => {
		const fileField = Field.file();
		expect(fileField.type).toBe("file");
	});

	test("Schema with buckets and tables generates complete DDL", () => {
		const schema = extractSchemaFromDefinables([AvatarBucket, User]);
		expect(schema.buckets).toHaveLength(1);
		expect(schema.tables).toHaveLength(1);

		const ddl = generateSurqlFromAST(schema, "error");
		// Should contain bucket DDL
		expect(ddl).toContain("DEFINE BUCKET avatars");
		// Should contain table DDL
		expect(ddl).toContain("DEFINE TABLE user");
		// Should contain file field DDL
		expect(ddl).toContain("DEFINE FIELD avatar ON TABLE user");
		expect(ddl).toContain("TYPE option<file>");
	});

	test("applySchema with buckets and file field", async () => {
		await applySchema(db, [AvatarBucket, User], "OVERWRITE");

		// Verify bucket exists in database info
		const [results] = await db.query("INFO FOR DB").collect();
		const dbInfo = results as { buckets?: Record<string, string> };

		expect(dbInfo.buckets).toBeDefined();
		expect(dbInfo.buckets?.avatars).toContain("DEFINE BUCKET avatars");
	});

	test("file pointer is FileRef with bucket and key", async () => {
		// Create a user - we'll set the avatar via query
		const user = await User.create(db, { name: "Alice" });

		// Create a file pointer using type::file() and update the user
		await db.query(
			surql`UPDATE ${user.id} SET avatar = type::file("avatars", "/alice-avatar.png")`,
		);

		// Fetch the user back
		const updated = await User.select(db, { from: user.id, only: true });
		expect(updated).toBeDefined();

		// The avatar field should be a FileRef instance
		const fileRef = updated?.avatar;
		expect(fileRef).toBeDefined();
		expect(fileRef?.bucket).toBe("avatars");
		expect(fileRef?.key).toBe("/alice-avatar.png");
	});

	test("upload and fetch file via SurrealQL", async () => {
		// Create a user with avatar file pointer
		await db.query(
			surql`CREATE user:bob SET name = "Bob", avatar = type::file("avatars", "/bob-doc.txt")`,
		);

		const user = await User.select(db, {
			from: new RecordId("user", "bob"),
			only: true,
		});
		expect(user?.avatar).toBeDefined();

		// Upload file content via SurrealQL using .put() method on file pointer
		const testContent = "Hello from SurrealDB file storage!";
		await db.query(surql`user:bob.avatar.put(${testContent})`);

		// Fetch the file content back via SurrealQL using .get() method
		const [results] = await db.query(surql`user:bob.avatar.get()`).collect();
		expect(results).toBeDefined();
		// Result is ArrayBuffer - convert to string for comparison
		const decoder = new TextDecoder();
		const content = decoder.decode(results as ArrayBuffer);
		expect(content).toBe(testContent);
	});

	test("file metadata via SurrealQL .head()", async () => {
		// Create a user with avatar
		await db.query(
			surql`CREATE user:charlie SET name = "Charlie", avatar = type::file("avatars", "/charlie-meta.txt")`,
		);

		// Upload with specific content
		const testContent = "Metadata test content";
		await db.query(surql`user:charlie.avatar.put(${testContent})`);

		// Get metadata via .head() method
		const [meta] = await db.query(surql`user:charlie.avatar.head()`).collect();
		expect(meta).toBeDefined();
		const metaObj = meta as { size?: number; contentType?: string };
		expect(metaObj?.size).toBe(testContent.length);
		// Content-Type may not be set for plain text strings without explicit type
		// Just verify we got the metadata object successfully
	});

	test("ORM create with FileRef pointer", async () => {
		// Upload a file first, then get its FileRef via query
		await db.query(surql`f"avatars:/orm-create.txt".put("ORM create test")`);
		const [fileRef] = await db
			.query(surql`f"avatars:/orm-create.txt"`)
			.collect();

		// Pass the FileRef directly into ORM create
		const user = await User.create(db, {
			name: "ORMCreate",
			avatar: fileRef as unknown as import("surrealdb").FileRef,
		});
		expect(user.name).toBe("ORMCreate");
		expect(user.avatar).toBeDefined();
		expect(user.avatar?.bucket).toBe("avatars");
		expect(user.avatar?.key).toBe("/orm-create.txt");

		// Select back via ORM — FileRef is preserved
		const fetched = await User.select(db, { from: user.id, only: true });
		expect(fetched?.avatar?.bucket).toBe("avatars");
		expect(fetched?.avatar?.key).toBe("/orm-create.txt");
	});

	test("ORM select returns FileRef instance", async () => {
		// File operations must be done via SurrealQL (SDK limitation — JS SDK has no file I/O methods yet)
		await db.query(
			surql`CREATE user:fileref_test SET name = "FileRefTest", avatar = type::file("avatars", "/fileref-test.txt")`,
		);
		await db.query(surql`user:fileref_test.avatar.put("test content")`);

		// ORM select returns a proper FileRef instance
		const user = await User.select(db, {
			from: new RecordId("user", "fileref_test"),
			only: true,
		});
		expect(user?.avatar?.constructor?.name).toBe("FileRef");
		expect(user?.avatar?.bucket).toBe("avatars");
		expect(user?.avatar?.key).toBe("/fileref-test.txt");

		// File content is read back via SurrealQL
		const [bytes] = await db
			.query(surql`user:fileref_test.avatar.get()`)
			.collect();
		const content = new TextDecoder().decode(bytes as ArrayBuffer);
		expect(content).toBe("test content");
	});
});
