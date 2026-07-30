import { describe, test, expect } from "bun:test";
import { Table, RecordIdRange, StringRecordId } from "surrealdb";
import { NONE, UNBOUNDED, RangeId, Range } from "../../src/query/range";

// ============================================================================
// RangeId — record ID ranges (table required)
// ============================================================================

describe("RangeId", () => {
	test("accepts a string table name", () => {
		const range = RangeId("player").from(2).toInclusive(4);
		expect(range).toBeInstanceOf(RecordIdRange);
	});

	test("accepts a Table instance", () => {
		const table = new Table("player");
		const range = RangeId(table).from(2).toInclusive(4);
		expect(range).toBeInstanceOf(RecordIdRange);
	});

	test("produces identical results for string and Table input", () => {
		const fromString = RangeId("person").from(2).toInclusive(4);
		const fromTable = RangeId(new Table("person")).from(2).toInclusive(4);
		expect(fromString).toEqual(fromTable);
	});

	test("from().to() creates a range", () => {
		const range = RangeId("person").from(2).to(4);
		expect(range).toBeInstanceOf(RecordIdRange);
	});

	test("from().toInclusive() creates a range", () => {
		const range = RangeId("person").from(2).toInclusive(4);
		expect(range).toBeInstanceOf(RecordIdRange);
	});

	test("fromExclusive().to() creates a range", () => {
		const range = RangeId("person").fromExclusive(2).to(4);
		expect(range).toBeInstanceOf(RecordIdRange);
	});

	test("fromUnbounded().to() creates a range", () => {
		const range = RangeId("person").fromUnbounded().to(4);
		expect(range).toBeInstanceOf(RecordIdRange);
	});

	test("from().toUnbounded() creates a range", () => {
		const range = RangeId("person").from(2).toUnbounded();
		expect(range).toBeInstanceOf(RecordIdRange);
	});

	test("handles NONE sentinel via StringRecordId fallback", () => {
		const range = RangeId("player")
			.from(["mage", NONE])
			.to(["mage", UNBOUNDED]);
		expect(range).toBeInstanceOf(StringRecordId);
		if (!(range instanceof StringRecordId)) throw new Error("unreachable");
		const str = range.toJSON();
		expect(str).toContain("player:");
		expect(str).toContain("mage");
		expect(str).toContain("NONE");
	});

	test("handles array record ID components", () => {
		const range = RangeId("player").from(["mage", 1]).to(["mage", 10]);
		expect(range).toBeInstanceOf(RecordIdRange);
	});
});

// ============================================================================
// Range — value ranges (no table)
// ============================================================================

describe("Range", () => {
	test("from().to() creates a range", () => {
		const range = Range.from(0).to(100);
		expect(range).toBeDefined();
	});

	test("from().toInclusive() creates a range", () => {
		const range = Range.from(0).toInclusive(100);
		expect(range).toBeDefined();
	});

	test("fromExclusive().to() creates a range", () => {
		const range = Range.fromExclusive(0).to(100);
		expect(range).toBeDefined();
	});

	test("from().toUnbounded() creates a range", () => {
		const range = Range.from(0).toUnbounded();
		expect(range).toBeDefined();
	});

	test("fromUnbounded().to() creates a range", () => {
		const range = Range.fromUnbounded().to(100);
		expect(range).toBeDefined();
	});

	test("works with string values", () => {
		const range = Range.from("a").to("z");
		expect(range).toBeDefined();
	});
});

// ============================================================================
// Sentinel values
// ============================================================================

describe("Sentinels", () => {
	test("NONE is a unique symbol", () => {
		expect(typeof NONE).toBe("symbol");
		expect(NONE).not.toBe(UNBOUNDED);
	});

	test("UNBOUNDED is a unique symbol", () => {
		expect(typeof UNBOUNDED).toBe("symbol");
		expect(UNBOUNDED).not.toBe(NONE);
	});
});
