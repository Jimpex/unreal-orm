import type { Surreal } from "surrealdb";
import { RecordId as SurrealRecordId } from "surrealdb";
import type {
	ModelStatic,
	InferShapeFromFields,
	ModelInstance,
	TableDefineOptions,
} from "../types/model";
import type { SelectQueryOptions, OrderByClause } from "../types/query";
import type { FieldDefinition } from "../../../schema/field-definitions/definitions";

export function getSelectMethod<
	TFields extends Record<string, FieldDefinition<unknown>>,
>() {
	return async function select<
		T extends ModelStatic<
			ModelInstance<InferShapeFromFields<TFields>>,
			TFields,
			TableDefineOptions<TFields>
		>,
	>(
		this: T,
		db: Surreal,
		options?: SelectQueryOptions<InferShapeFromFields<T["_fields"]>>,
	): Promise<unknown> {
		const opts = options || {};
		const tableName = this.getTableName();
		type ModelInstanceType = InstanceType<T>;
		type ActualTableData = InferShapeFromFields<T["_fields"]>;
		const queryParts: string[] = [];
		const bindings: Record<string, unknown> = opts.vars || {};
		const selectFields =
			opts.select && opts.select.length > 0
				? (opts.select as string[]).join(", ")
				: "*";
		let fromClause: string;
		let isDirectIdQuery = false;
		if (opts.from) {
			if (opts.from instanceof SurrealRecordId) {
				bindings.fromIdBinding = opts.from;
				fromClause = "$fromIdBinding";
				isDirectIdQuery = true;
			} else {
				fromClause = opts.only ? `ONLY ${opts.from}` : opts.from;
			}
		} else {
			fromClause = opts.only ? `ONLY ${tableName}` : tableName;
		}
		queryParts.push(`SELECT ${selectFields} FROM ${fromClause}`);
		if (!isDirectIdQuery && opts.where) {
			queryParts.push(`WHERE ${opts.where}`);
		} else if (isDirectIdQuery && opts.where) {
			console.warn(
				"[ORM WARNING] Applying WHERE clause to a direct RecordId query. This is unusual.",
			);
			queryParts.push(`WHERE ${opts.where}`);
		}
		if (opts.orderBy && opts.orderBy.length > 0) {
			const orderByClauses = opts.orderBy.map((ob: OrderByClause) => {
				let clause = String(ob.field);
				if (ob.order) clause += ` ${ob.order.toUpperCase()}`;
				if (ob.collate) clause += " COLLATE";
				if (ob.numeric) clause += " NUMERIC";
				return clause;
			});
			queryParts.push(`ORDER BY ${orderByClauses.join(", ")}`);
		}
		if (opts.limit !== undefined) queryParts.push(`LIMIT ${opts.limit}`);
		if (opts.start !== undefined) queryParts.push(`START ${opts.start}`);
		if (opts.fetch && opts.fetch.length > 0)
			queryParts.push(`FETCH ${opts.fetch.join(", ")}`);
		if (opts.groupBy && opts.groupBy.length > 0)
			queryParts.push(`GROUP BY ${opts.groupBy.join(", ")}`);
		const finalQuery = queryParts.join(" ");
		// TODO: Debug logging
		// console.debug(
		// 	`[ORM DEBUG] Executing query: "${finalQuery}" with bindings:`,
		// 	JSON.parse(JSON.stringify(bindings)),
		// );
		const queryResult = await db.query<[ActualTableData[]]>(
			finalQuery,
			bindings,
		);
		// TODO: Debug logging
		// console.debug("[ORM DEBUG] Query result:", queryResult);
		const recordArray: ActualTableData[] = queryResult?.[0] || [];
		if (opts.select || opts.groupBy) {
			return opts.only ? recordArray[0] : recordArray;
		}
		const instances = recordArray.map((r) => new this(r) as ModelInstanceType);
		return opts.only ? instances[0] : instances;
	};
}
