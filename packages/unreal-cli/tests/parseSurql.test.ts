import { describe, test, expect } from "bun:test";
import { parseSurqlContent } from "../src/introspection/parseSurql";

describe("parseSurqlContent", () => {
	test("parses DEFINE BUCKET statements", () => {
		const content = `
			DEFINE BUCKET avatars BACKEND 'memory';
			DEFINE BUCKET static BACKEND 'file:/data/static' READONLY PERMISSIONS FULL COMMENT 'assets';
			DEFINE BUCKET global_assets PERMISSIONS WHERE $auth.role = 'admin';
		`;

		const schema = parseSurqlContent(content);

		expect(schema.buckets).toHaveLength(3);
		expect(schema.buckets?.map((b) => b.name)).toEqual([
			"avatars",
			"static",
			"global_assets",
		]);

		const staticBucket = schema.buckets?.find((b) => b.name === "static");
		expect(staticBucket?.backend).toBe("file:/data/static");
		expect(staticBucket?.readonly).toBe(true);
		expect(staticBucket?.permissions).toBe("FULL");
		expect(staticBucket?.comment).toBe("assets");

		const globalBucket = schema.buckets?.find((b) => b.name === "global_assets");
		expect(globalBucket?.backend).toBeUndefined();
		expect(globalBucket?.permissions).toBe("WHERE $auth.role = 'admin'");
	});
});
