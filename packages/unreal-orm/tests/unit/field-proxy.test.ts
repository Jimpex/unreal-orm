import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { BoundQuery, Expr, Surreal } from "surrealdb";
import { Field, Table, applySchema } from "../../src";
import {
	add,
	and,
	avg,
	both,
	containsAll,
	containsAny,
	containsNone,
	count,
	countIn,
	countOut,
	createFieldProxy,
	divide,
	eq,
	exact,
	in_ as graphIn,
	gt,
	gte,
	inside,
	intersects,
	isFalse,
	isIn,
	isNone,
	isNotIn,
	isNotNone,
	isNotNull,
	isNull,
	isTrue,
	lt,
	lte,
	matches,
	max,
	min,
	modulo,
	multiply,
	ne,
	or,
	out,
	outside,
	subtract,
	sum,
} from "../../src";
import type { ColumnRef } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";

const ctx = { def: (value: unknown) => JSON.stringify(value) };

function sqlOf(bq: BoundQuery): string {
	return bq.query.replace(/\$([a-zA-Z0-9_]+)/g, (_, key) => {
		const val = bq.bindings[key];
		return val === undefined ? `$${key}` : JSON.stringify(val);
	});
}

class TestAuthor extends Table.normal({
	name: "test_author",
	fields: {
		name: Field.string(),
		email: Field.string(),
	},
	schemafull: true,
}) {}

class TestPost extends Table.normal({
	name: "test_post",
	fields: {
		title: Field.string(),
		content: Field.string(),
		views: Field.number(),
		author: Field.record(() => TestAuthor),
		metadata: Field.object({
			category: Field.string(),
			featured: Field.bool(),
		}),
		tags: Field.array(Field.string()),
	},
	schemafull: true,
}) {}

class TestFollow extends Table.relation({
	name: "test_follow",
	schemafull: false,
	fields: {
		in: Field.record(() => TestAuthor),
		out: Field.record(() => TestAuthor),
		since: Field.datetime(),
	},
}) {}

describe("FieldProxy SQL generation", () => {
	test("generates equality and comparison operators", () => {
		const fields = createFieldProxy(TestPost._fields);

		expect(sqlOf(fields.views.eq(100))).toBe("views = 100");
		expect(sqlOf(fields.views.ne(100))).toBe("views != 100");
		expect(sqlOf(fields.views.gt(100))).toBe("views > 100");
		expect(sqlOf(fields.views.gte(100))).toBe("views >= 100");
		expect(sqlOf(fields.views.lt(100))).toBe("views < 100");
		expect(sqlOf(fields.views.lte(100))).toBe("views <= 100");
	});

	test("generates string methods", () => {
		const fields = createFieldProxy(TestPost._fields);

		expect(fields.title.toLowerCase().toSQL(ctx)).toBe(
			"string::lowercase(title)",
		);
		expect(fields.title.toUpperCase().toSQL(ctx)).toBe(
			"string::uppercase(title)",
		);
		expect(fields.title.trim().toSQL(ctx)).toBe("string::trim(title)");
		expect(fields.title.length().toSQL(ctx)).toBe("string::len(title)");
		expect(sqlOf(fields.title.contains("surreal"))).toBe(
			'string::contains(title, "surreal")',
		);
		expect(sqlOf(fields.title.startsWith("hello"))).toBe(
			'string::starts_with(title, "hello")',
		);
		expect(sqlOf(fields.title.endsWith("world"))).toBe(
			'string::ends_with(title, "world")',
		);
		expect(fields.title.replace("a", "b").toSQL(ctx)).toBe(
			'string::replace(title, "a", "b")',
		);
		expect(fields.title.slice(0).toSQL(ctx)).toBe("string::slice(title, 0)");
		expect(fields.title.slice(0, 5).toSQL(ctx)).toBe(
			"string::slice(title, 0, 5)",
		);
	});

	test("generates number methods", () => {
		const fields = createFieldProxy(TestPost._fields);

		expect(fields.views.abs().toSQL(ctx)).toBe("math::abs(views)");
		expect(fields.views.ceil().toSQL(ctx)).toBe("math::ceil(views)");
		expect(fields.views.floor().toSQL(ctx)).toBe("math::floor(views)");
		expect(fields.views.round().toSQL(ctx)).toBe("math::round(views)");
		expect(fields.views.sqrt().toSQL(ctx)).toBe("math::sqrt(views)");
		expect(fields.views.clamp(0, 10).toSQL(ctx)).toBe(
			"math::clamp(views, 0, 10)",
		);
	});

	test("generates array methods", () => {
		const fields = createFieldProxy(TestPost._fields);

		expect(sqlOf(fields.tags.contains("news"))).toBe('tags CONTAINS "news"');
		expect(fields.tags.length().toSQL(ctx)).toBe("array::len(tags)");
		expect(fields.tags.distinct().toSQL(ctx)).toBe("array::distinct(tags)");
		expect(fields.tags.join(",").toSQL(ctx)).toBe('array::join(tags, ",")');
		expect(fields.tags.flatten().toSQL(ctx)).toBe("array::flatten(tags)");
	});

	test("generates nested object and record field access", () => {
		const fields = createFieldProxy(TestPost._fields);

		expect(sqlOf(fields.metadata.category.eq("tech"))).toBe(
			'metadata.category = "tech"',
		);
		expect(sqlOf(fields.author.name.eq("Alice"))).toBe('author.name = "Alice"');
	});

	test("composes logical expressions with and/or", () => {
		const fields = createFieldProxy(TestPost._fields);

		const expr = and(fields.title.contains("hello"), fields.views.gt(10));
		expect(sqlOf(expr)).toBe(
			'(string::contains(title, "hello")) AND (views > 10)',
		);

		const orExpr = or(fields.views.eq(1), fields.views.eq(2));
		expect(sqlOf(orExpr)).toBe("(views = 1) OR (views = 2)");
	});

	test("supports standalone comparison helpers", () => {
		const fields = createFieldProxy(TestPost._fields);

		expect(sqlOf(eq(fields.title, "a title"))).toBe('title = "a title"');
		expect(sqlOf(ne(fields.views, 100))).toBe("views != 100");
		expect(sqlOf(gt(fields.views, 100))).toBe("views > 100");
		expect(sqlOf(gte(fields.views, 100))).toBe("views >= 100");
		expect(sqlOf(lt(fields.views, 100))).toBe("views < 100");
		expect(sqlOf(lte(fields.views, 100))).toBe("views <= 100");
	});

	test("generates additional SurrealQL operators", () => {
		const fields = createFieldProxy(TestPost._fields);

		expect(sqlOf(fields.views.exact(10))).toBe("views == 10");
		expect(sqlOf(fields.tags.isNone())).toBe("tags IS NONE");
		expect(sqlOf(fields.tags.isNotNone())).toBe("tags IS NOT NONE");
		expect(sqlOf(fields.tags.isNull())).toBe("tags IS NULL");
		expect(sqlOf(fields.tags.isNotNull())).toBe("tags IS NOT NULL");
		expect(sqlOf(fields.title.isTrue())).toBe("title IS TRUE");
		expect(sqlOf(fields.title.isFalse())).toBe("title IS FALSE");

		expect(
			sqlOf(fields.author.inside({ type: "Point", coordinates: [0, 0] })),
		).toBe('author INSIDE {"type":"Point","coordinates":[0,0]}');
		expect(sqlOf(fields.title.matches("surreal"))).toBe('title @@ "surreal"');
		expect(sqlOf(fields.title.matches("surreal", 1))).toBe(
			'title @1@ "surreal"',
		);
		expect(sqlOf(fields.views.isIn([1, 2, 3]))).toBe("views IN [1,2,3]");
		expect(sqlOf(fields.views.isNotIn([1, 2, 3]))).toBe("views NOT IN [1,2,3]");
		expect(sqlOf(fields.tags.containsAny(["news", "tech"]))).toBe(
			'tags CONTAINSANY ["news","tech"]',
		);
		expect(sqlOf(fields.tags.containsAll(["news", "tech"]))).toBe(
			'tags CONTAINSALL ["news","tech"]',
		);
		expect(sqlOf(fields.tags.containsNone(["spam"]))).toBe(
			'tags CONTAINSNONE ["spam"]',
		);
	});

	test("supports standalone additional operator helpers", () => {
		const fields = createFieldProxy(TestPost._fields);

		expect(sqlOf(exact(fields.views, 10))).toBe("views == 10");
		expect(sqlOf(isNone(fields.tags))).toBe("tags IS NONE");
		expect(sqlOf(isIn(fields.views, [1, 2, 3]))).toBe("views IN [1,2,3]");
		expect(sqlOf(containsAny(fields.tags, ["news"]))).toBe(
			'tags CONTAINSANY ["news"]',
		);
	});

	test("generates native function namespaces", () => {
		const fields = createFieldProxy(TestPost._fields);

		expect(fields.title.string.lowercase().toSQL(ctx)).toBe(
			"string::lowercase(title)",
		);
		expect(fields.views.math.round().toSQL(ctx)).toBe("math::round(views)");
		expect(fields.views.math.round(2).toSQL(ctx)).toBe("math::round(views, 2)");
		expect(fields.tags.array.distinct().toSQL(ctx)).toBe(
			"array::distinct(tags)",
		);
		expect(fields.author.meta.id().toSQL(ctx)).toBe("meta::id(author)");
		expect((fields.title.is.email() as ColumnRef).toSQL(ctx)).toBe(
			"is::email(title)",
		);
		expect((fields.title.parse.url() as ColumnRef).toSQL(ctx)).toBe(
			"parse::url(title)",
		);
		expect(
			(fields.title.string["similarity::jaro"]() as ColumnRef).toSQL(ctx),
		).toBe("string::similarity::jaro(title)");
	});

	test("generates all additional function namespaces", () => {
		const fields = createFieldProxy(TestPost._fields);

		expect((fields.title.bytes.len() as ColumnRef).toSQL(ctx)).toBe(
			"bytes::len(title)",
		);
		expect((fields.title.crypto.sha256() as ColumnRef).toSQL(ctx)).toBe(
			"crypto::sha256(title)",
		);
		expect(
			(fields.title.duration.from_secs(3600) as ColumnRef).toSQL(ctx),
		).toBe("duration::from_secs(title, 3600)");
		expect(
			(fields.title.encoding.base64_encode() as ColumnRef).toSQL(ctx),
		).toBe("encoding::base64_encode(title)");
		expect(
			(fields.title.geo.distance(fields.title) as ColumnRef).toSQL(ctx),
		).toBe("geo::distance(title, title)");
		expect((fields.title.http.head() as ColumnRef).toSQL(ctx)).toBe(
			"http::head(title)",
		);
		expect((fields.title.object.keys() as ColumnRef).toSQL(ctx)).toBe(
			"object::keys(title)",
		);
		expect((fields.title.rand.uuid() as ColumnRef).toSQL(ctx)).toBe(
			"rand::uuid(title)",
		);
		expect(fields.author.record.id().toSQL(ctx)).toBe("record::id(author)");
		expect((fields.title.search.analyze("test") as ColumnRef).toSQL(ctx)).toBe(
			'search::analyze(title, "test")',
		);
		expect((fields.title.session.db() as ColumnRef).toSQL(ctx)).toBe(
			"session::db(title)",
		);
		expect(fields.title.type.int().toSQL(ctx)).toBe("type::int(title)");
		expect((fields.title.vector.add([1, 2]) as ColumnRef).toSQL(ctx)).toBe(
			"vector::add(title, [1,2])",
		);
	});

	test("generates arithmetic operators", () => {
		const fields = createFieldProxy(TestPost._fields);

		expect(fields.views.add(10).toSQL(ctx)).toBe("views + 10");
		expect(fields.views.subtract(5).toSQL(ctx)).toBe("views - 5");
		expect(fields.views.multiply(2).toSQL(ctx)).toBe("views * 2");
		expect(fields.views.divide(3).toSQL(ctx)).toBe("views / 3");
		expect(fields.views.modulo(7).toSQL(ctx)).toBe("views % 7");
		// Chaining: (views + 10) > 100
		expect(sqlOf(fields.views.add(10).gt(100))).toBe("views + 10 > 100");
		// String concatenation
		expect(fields.title.add("!").toSQL(ctx)).toBe('title + "!"');
	});

	test("supports standalone arithmetic helpers", () => {
		const fields = createFieldProxy(TestPost._fields);

		expect(add(fields.views, 10).toSQL(ctx)).toBe("views + 10");
		expect(subtract(fields.views, 5).toSQL(ctx)).toBe("views - 5");
		expect(multiply(fields.views, 2).toSQL(ctx)).toBe("views * 2");
		expect(divide(fields.views, 3).toSQL(ctx)).toBe("views / 3");
		expect(modulo(fields.views, 7).toSQL(ctx)).toBe("views % 7");
	});

	test("generates graph traversal operators", () => {
		const fields = createFieldProxy(TestPost._fields);

		expect(fields.author.out("follow").toSQL(ctx)).toBe("author->follow");
		expect(fields.author.in("follow").toSQL(ctx)).toBe("author<-follow");
		expect(fields.author.both("follow").toSQL(ctx)).toBe("author<->follow");
		// Without edge type (any edge)
		expect(fields.author.out().toSQL(ctx)).toBe("author->");
		// Chaining: author->follow->user
		expect(fields.author.out("follow").out("user").toSQL(ctx)).toBe(
			"author->follow->user",
		);
	});

	test("supports standalone graph traversal helpers", () => {
		const fields = createFieldProxy(TestPost._fields);

		expect(out(fields.author, "follow").toSQL(ctx)).toBe("author->follow");
		expect(graphIn(fields.author, "follow").toSQL(ctx)).toBe("author<-follow");
		expect(both(fields.author, "follow").toSQL(ctx)).toBe("author<->follow");
	});

	test("graph traversal with edge model resolves target fields", () => {
		const fields = createFieldProxy(TestPost._fields);

		// With edge model, the result should resolve target table fields
		const traversed = fields.author.out("test_follow", TestFollow);
		expect(traversed.toSQL(ctx)).toBe("author->test_follow");
		// Access nested field from target table (TestAuthor.name)
		const nameRef = (traversed as unknown as Expr & Record<string, Expr>).name;
		expect((nameRef as ColumnRef).toSQL(ctx)).toBe("author->test_follow.name");
	});

	test("typed namespace overloads return correct types", () => {
		const fields = createFieldProxy(TestPost._fields);

		// string::lowercase should return StringColumn with .contains()
		expect(fields.title.string.lowercase().toSQL(ctx)).toBe(
			"string::lowercase(title)",
		);
		expect(fields.title.string.uppercase().toSQL(ctx)).toBe(
			"string::uppercase(title)",
		);
		expect(fields.title.string.len().toSQL(ctx)).toBe("string::len(title)");

		// math::abs should return NumberColumn with .gt()
		expect(fields.views.math.abs().toSQL(ctx)).toBe("math::abs(views)");
		expect(fields.views.math.round().toSQL(ctx)).toBe("math::round(views)");
		expect(fields.views.math.sqrt().toSQL(ctx)).toBe("math::sqrt(views)");

		// array::len should return NumberColumn
		expect(fields.tags.array.len().toSQL(ctx)).toBe("array::len(tags)");
		expect(fields.tags.array.join(", ").toSQL(ctx)).toBe(
			'array::join(tags, ", ")',
		);

		// type::int should return NumberColumn
		expect(fields.views.type.int().toSQL(ctx)).toBe("type::int(views)");
		expect(fields.views.type.string().toSQL(ctx)).toBe("type::string(views)");

		// record::table should return StringColumn
		expect(fields.author.record.table().toSQL(ctx)).toBe(
			"record::table(author)",
		);

		// meta::table should return StringColumn
		expect(fields.author.meta.table().toSQL(ctx)).toBe("meta::table(author)");

		// Unknown function still works via fallback
		const jaro = fields.title.string["similarity::jaro"](
			"other",
		) as unknown as ColumnRef;
		expect(jaro.toSQL(ctx)).toBe('string::similarity::jaro(title, "other")');
	});

	test("aggregate helpers generate correct SQL", () => {
		const fields = createFieldProxy(TestPost._fields);

		expect(count().toSQL(ctx)).toBe("count()");
		expect(count(fields.views).toSQL(ctx)).toBe("count(views)");
		expect(sum(fields.views).toSQL(ctx)).toBe("math::sum(views)");
		expect(avg(fields.views).toSQL(ctx)).toBe("math::mean(views)");
		expect(min(fields.views).toSQL(ctx)).toBe("math::min(views)");
		expect(max(fields.views).toSQL(ctx)).toBe("math::max(views)");
		expect(countOut(fields.author, "follow").toSQL(ctx)).toBe(
			"count(author->follow)",
		);
		expect(countIn(fields.author, "follow").toSQL(ctx)).toBe(
			"count(author<-follow)",
		);
	});
});

describe("FieldProxy integration with CRUD methods", () => {
	let db: Surreal;

	beforeAll(async () => {
		db = await setupInMemoryDb("field_proxy_test", "field_proxy_test");
		await applySchema(db, [TestAuthor, TestPost]);
	});

	afterAll(async () => {
		await teardownDb(db);
	});

	test("select with typed where callback", async () => {
		const author = await TestAuthor.create(db, {
			name: "Alice",
			email: "alice@example.com",
		});
		await TestPost.create(db, {
			title: "SurrealDB post",
			content: "content",
			views: 150,
			author: author.id,
			metadata: { category: "tech", featured: true },
			tags: ["news", "tech"],
		});

		const result = await TestPost.select(db, {
			where: (f) => f.title.contains("Surreal"),
			only: true,
		});

		expect(result).toBeTruthy();
		expect(result?.title).toBe("SurrealDB post");
	});

	test("count with typed where callback", async () => {
		const author = await TestAuthor.create(db, {
			name: "Bob",
			email: "bob@example.com",
		});
		await TestPost.create(db, {
			title: "Popular post",
			content: "content",
			views: 200,
			author: author.id,
			metadata: { category: "life", featured: false },
			tags: ["life"],
		});

		const popular = await TestPost.count(db, {
			where: (f) => f.views.gt(100),
		});

		expect(popular).toBe(2);
	});

	test("updateMany with typed where callback", async () => {
		await TestPost.updateMany(db, {
			where: (f) => f.metadata.category.eq("life"),
			data: { views: 999 },
			mode: "merge",
		});

		const updated = await TestPost.select(db, {
			where: (f) => f.title.eq("Popular post"),
			only: true,
		});

		expect(updated?.views).toBe(999);
	});

	test("deleteMany with typed where callback", async () => {
		await TestPost.deleteMany(db, {
			where: (f) => f.tags.contains("life"),
		});

		const remaining = await TestPost.count(db);
		expect(remaining).toBe(1);
	});

	test("select with aggregate and GROUP BY", async () => {
		// Create test data
		const author = await TestAuthor.create(db, {
			name: "Carol",
			email: "carol@example.com",
		});
		await TestPost.create(db, {
			title: "Post A",
			content: "content",
			views: 100,
			author: author.id,
			metadata: { category: "tech", featured: true },
			tags: ["tech"],
		});
		await TestPost.create(db, {
			title: "Post B",
			content: "content",
			views: 300,
			author: author.id,
			metadata: { category: "tech", featured: false },
			tags: ["tech"],
		});

		// Use aggregate with GROUP BY via raw surql select
		const { surql } = await import("surrealdb");
		const { typed } = await import("../../src");
		const results = await TestPost.select(db, {
			select: {
				category: typed<string>(surql`metadata.category`),
				totalViews: typed<number>(surql`math::sum(views)`),
				avgViews: typed<number>(surql`math::mean(views)`),
			},
			groupBy: ["metadata.category"],
		} as unknown as Record<string, unknown>);

		expect(results.length).toBeGreaterThan(0);
		const techRow = (results as unknown as Array<Record<string, unknown>>).find(
			(r) => r.category === "tech",
		);
		expect(techRow).toBeTruthy();
		expect(techRow?.totalViews).toBe(550);
		expect(techRow?.avgViews).toBeCloseTo(183.33, 1);
	});

	test("select with ORDER BY computed expression", async () => {
		const { surql } = await import("surrealdb");

		const results = await TestPost.select(db, {
			orderBy: [{ field: surql`views`, order: "DESC" }],
		});

		expect(results.length).toBeGreaterThan(0);
		// Should be ordered by views descending
		expect(results[0].views).toBeGreaterThanOrEqual(
			results[results.length - 1].views,
		);
	});

	test("update with set mode — atomic increment via surql", async () => {
		const { surql } = await import("surrealdb");

		// Find the first post and increment its views atomically
		const posts = await TestPost.select(db, { limit: 1 });
		expect(posts.length).toBe(1);
		const before = posts[0].views;

		const updated = await TestPost.update(db, posts[0].id, {
			mode: "set",
			data: { views: surql`views + 1` },
			// biome-ignore lint/suspicious/noExplicitAny: set mode accepts unknown values for computed expressions
		} as any);

		expect(updated.views).toBe(before + 1);
	});

	test("updateMany with set mode — field proxy callback for computed expressions", async () => {
		// Increment all posts' views by 1 using field proxy
		const before = await TestPost.select(db, {});
		const totalBefore = before.reduce((sum, p) => sum + p.views, 0);

		await TestPost.updateMany(db, {
			where: () => true as unknown as BoundQuery,
			// biome-ignore lint/suspicious/noExplicitAny: field proxy type not inferred through set mode union
			data: (f: any) => ({ views: f.views.add(1) }),
			mode: "set",
			// biome-ignore lint/suspicious/noExplicitAny: set mode accepts unknown values for computed expressions
		} as any);

		const after = await TestPost.select(db, {});
		const totalAfter = after.reduce((sum, p) => sum + p.views, 0);

		// Each post should have been incremented by 1
		expect(totalAfter).toBe(totalBefore + after.length);
	});

	test("update with set mode — mixed plain values and computed expressions", async () => {
		const { surql } = await import("surrealdb");

		const posts = await TestPost.select(db, { limit: 1 });
		const postId = posts[0].id;

		const updated = await TestPost.update(db, postId, {
			mode: "set",
			data: {
				title: "Updated via SET",
				views: surql`views * 2`,
			},
			// biome-ignore lint/suspicious/noExplicitAny: set mode accepts unknown values for computed expressions
		} as any);

		expect(updated.title).toBe("Updated via SET");
		expect(updated.views).toBe(posts[0].views * 2);
	});
});
