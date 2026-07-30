import {
	type Bound,
	BoundExcluded,
	BoundIncluded,
	RecordId,
	RecordIdRange,
	type RecordIdValue,
	StringRecordId,
	Range as SurrealRange,
	Table,
	toSurrealqlString,
} from "surrealdb";

/**
 * Sentinel value representing SurrealDB `NONE`.
 * @example
 * ```ts
 * RangeId("player").from(["mage", NONE]).to(["mage", UNBOUNDED]);
 * ```
 */
export const NONE = Symbol("unreal-orm.NONE");

/**
 * Sentinel value representing an unbounded range component (`..`).
 * @example
 * ```ts
 * RangeId("player").from(["mage", UNBOUNDED]).to(["mage", UNBOUNDED]);
 * ```
 */
export const UNBOUNDED = Symbol("unreal-orm.UNBOUNDED");

type RangeValue = RecordIdValue | typeof NONE | typeof UNBOUNDED | RecordId;

/**
 * Values that can be passed to `makeBound` — excludes `NONE` (handled via
 * `StringRecordId` before `makeBound` is ever called).
 */
type BoundableValue = Exclude<RangeValue, typeof NONE>;

function isSentinel(value: unknown): value is typeof NONE | typeof UNBOUNDED {
	return value === NONE || value === UNBOUNDED;
}

function containsNestedSentinel(value: unknown): boolean {
	// Top-level sentinels are handled by makeBound — only check inside arrays/objects.
	if (isSentinel(value)) return false;
	if (Array.isArray(value)) return value.some(hasSentinel);
	if (value && typeof value === "object" && !(value instanceof RecordId)) {
		return Object.values(value).some(hasSentinel);
	}
	return false;
}

function hasSentinel(value: unknown): boolean {
	if (isSentinel(value)) return true;
	if (Array.isArray(value)) return value.some(hasSentinel);
	if (value && typeof value === "object" && !(value instanceof RecordId)) {
		return Object.values(value).some(hasSentinel);
	}
	return false;
}

function makeBound(
	value: BoundableValue,
	includeDefault: boolean,
): Bound<RecordIdValue> | undefined {
	if (value === UNBOUNDED) return undefined;
	if (value instanceof RecordId) {
		return includeDefault
			? new BoundIncluded(value.id)
			: new BoundExcluded(value.id);
	}
	return includeDefault ? new BoundIncluded(value) : new BoundExcluded(value);
}

function serializeComponent(value: unknown): string {
	if (value === NONE) return "NONE";
	if (value === UNBOUNDED) return "..";
	if (value instanceof RecordId) return toSurrealqlString(value.id);
	return toSurrealqlString(value);
}

function serializeIdValue(value: RangeValue): string {
	if (value instanceof RecordId) return toSurrealqlString(value.id);
	if (value === NONE) return "NONE";
	if (value === UNBOUNDED) {
		throw new Error(
			"UNBOUNDED can only be used inside array or object record IDs",
		);
	}
	if (Array.isArray(value)) {
		return `[${value.map(serializeComponent).join(", ")}]`;
	}
	if (value && typeof value === "object") {
		const pairs = Object.entries(value).map(
			([k, v]) => `${k}: ${serializeComponent(v)}`,
		);
		return `{ ${pairs.join(", ")} }`;
	}
	return toSurrealqlString(value);
}

function buildRangeString(
	table: string,
	start: RangeValue,
	startIncluded: boolean,
	end: RangeValue,
	endIncluded: boolean,
): string {
	const startStr = start === UNBOUNDED ? "" : serializeIdValue(start);
	const endStr = end === UNBOUNDED ? "" : serializeIdValue(end);
	const op = `${startIncluded ? "" : ">"}..${endIncluded ? "=" : ""}`;
	return `${table}:${startStr}${op}${endStr}`;
}

export type RecordIdRangeResult =
	| RecordIdRange<string, RecordIdValue>
	| StringRecordId;
export type ValueRangeResult = SurrealRange<RecordIdValue, RecordIdValue>;

// ============================================================================
// RangeId builders (record ID ranges — table is required)
// ============================================================================

/**
 * Builder class for the terminal bound of a record ID range.
 */
export class RangeIdEnd {
	constructor(
		private readonly table: string,
		private readonly startValue: RangeValue,
		private readonly startIncluded: boolean,
	) {}

	to(value: RangeValue): RecordIdRangeResult {
		return this.build(value, false);
	}

	toInclusive(value: RangeValue): RecordIdRangeResult {
		return this.build(value, true);
	}

	toUnbounded(): RecordIdRangeResult {
		return this.build(UNBOUNDED, false);
	}

	private build(value: RangeValue, include: boolean): RecordIdRangeResult {
		if (
			this.startValue === NONE ||
			value === NONE ||
			containsNestedSentinel(this.startValue) ||
			containsNestedSentinel(value)
		) {
			return new StringRecordId(
				buildRangeString(
					this.table,
					this.startValue,
					this.startIncluded,
					value,
					include,
				),
			);
		}
		return new RecordIdRange(
			this.table,
			makeBound(this.startValue, this.startIncluded),
			makeBound(value, include),
		);
	}
}

/**
 * Builder class for the start bound of a record ID range.
 */
export class RangeIdStart {
	constructor(private readonly table: string) {}

	from(value: RangeValue): RangeIdEnd {
		return new RangeIdEnd(this.table, value, true);
	}

	fromExclusive(value: Exclude<RangeValue, typeof UNBOUNDED>): RangeIdEnd {
		return new RangeIdEnd(this.table, value, false);
	}

	fromUnbounded(): RangeIdEnd {
		return new RangeIdEnd(this.table, UNBOUNDED, true);
	}
}

// ============================================================================
// Range builders (value ranges — no table)
// ============================================================================

/**
 * Values valid for value ranges — excludes `NONE` (only used in record ID ranges).
 */
type ValueRangeInput = Exclude<RangeValue, typeof NONE>;

/**
 * Builder class for the terminal bound of a value range.
 */
export class RangeValueEnd {
	constructor(
		private readonly startValue: ValueRangeInput,
		private readonly startIncluded: boolean,
	) {}

	to(value: ValueRangeInput): ValueRangeResult {
		return new SurrealRange(
			makeBound(this.startValue, this.startIncluded),
			makeBound(value, false),
		);
	}

	toInclusive(value: ValueRangeInput): ValueRangeResult {
		return new SurrealRange(
			makeBound(this.startValue, this.startIncluded),
			makeBound(value, true),
		);
	}

	toUnbounded(): ValueRangeResult {
		return new SurrealRange(
			makeBound(this.startValue, this.startIncluded),
			undefined,
		);
	}
}

/**
 * Builder class for the start bound of a value range.
 */
export class RangeValueStart {
	from(value: ValueRangeInput): RangeValueEnd {
		return new RangeValueEnd(value, true);
	}

	fromExclusive(
		value: Exclude<ValueRangeInput, typeof UNBOUNDED>,
	): RangeValueEnd {
		return new RangeValueEnd(value, false);
	}

	fromUnbounded(): RangeValueEnd {
		return new RangeValueEnd(UNBOUNDED, true);
	}
}

/**
 * Builds a value range for use in `WHERE` clauses.
 *
 * @example
 * ```ts
 * import { Range } from "unreal-orm";
 *
 * // 0..100 (start included, end excluded)
 * Range.from(0).to(100);
 *
 * // 0..=100 (start included, end included)
 * Range.from(0).toInclusive(100);
 *
 * // 0.. (end unbounded)
 * Range.from(0).toUnbounded();
 * ```
 */
export const Range = new RangeValueStart();

/**
 * Builds a record ID range for a specific table.
 *
 * @example
 * ```ts
 * import { RangeId } from "unreal-orm";
 *
 * // person:2..=4
 * RangeId("person").from(2).toInclusive(4);
 *
 * // player:['mage', NONE]..['mage', ..]
 * RangeId("player").from(["mage", NONE]).to(["mage", UNBOUNDED]);
 * ```
 */
export function RangeId(table: string | Table): RangeIdStart {
	return new RangeIdStart(typeof table === "string" ? table : table.name);
}
