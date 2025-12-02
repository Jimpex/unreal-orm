import type { Surreal } from "surrealdb";
import type {
	EventAST,
	FieldAST,
	IndexAST,
	SchemaAST,
	TableAST,
} from "unreal-orm";
import {
	parseFieldDefinition,
	parseIndexDefinition,
	parseTableDefinition,
} from "unreal-orm";
import type { DBInfo, TableInfo } from "./queryTypes";
import { extractSuccessResult } from "./queryTypes";
import { addWarning, checkFeatureSupport } from "./warnings";

/**
 * Introspects the connected database to build a schema AST.
 */
export async function introspect(db: Surreal): Promise<SchemaAST> {
	// 1. Get DB Info
	const [results] = await db.query("INFO FOR DB").collect();
	const dbInfo = extractSuccessResult<DBInfo>(results, "Failed to get DB info");
	const tablesMap = dbInfo.tables || {};

	// Check for unsupported database-level features
	if (dbInfo.analyzers && Object.keys(dbInfo.analyzers).length > 0) {
		for (const analyzerName of Object.keys(dbInfo.analyzers)) {
			checkFeatureSupport(
				"analyzer",
				analyzerName,
				dbInfo.analyzers[analyzerName] || "",
			);
		}
	}
	if (dbInfo.functions && Object.keys(dbInfo.functions).length > 0) {
		for (const funcName of Object.keys(dbInfo.functions)) {
			checkFeatureSupport(
				"function",
				funcName,
				dbInfo.functions[funcName] || "",
			);
		}
	}
	if (dbInfo.params && Object.keys(dbInfo.params).length > 0) {
		for (const paramName of Object.keys(dbInfo.params)) {
			checkFeatureSupport("param", paramName, dbInfo.params[paramName] || "");
		}
	}

	const tablesAST: TableAST[] = [];

	// 2. Iterate over tables
	for (const tableName of Object.keys(tablesMap)) {
		// The value in dbInfo.tables is just "DEFINE TABLE ...".
		// We need to fetch FIELDS, INDEXES, EVENTS for each table using INFO FOR TABLE.

		// Run INFO FOR TABLE
		let tableInfo: TableInfo;
		try {
			const [tableResult] = await db
				.query(`INFO FOR TABLE ${tableName}`)
				.collect();
			tableInfo = extractSuccessResult<TableInfo>(
				tableResult,
				`Failed to get info for table ${tableName}`,
			);
		} catch (error) {
			console.warn(
				`Failed to get info for table ${tableName}:`,
				error instanceof Error ? error.message : String(error),
			);
			continue;
		}

		// Parse Table Definition from the DB info (not from tableInfo)
		// Wait, INFO FOR TABLE returns structure:
		// { events: {}, fields: {}, indexes: {}, tables: {} }
		// Actually it returns definitions map.
		// Let's look at the raw output of INFO FOR TABLE.
		// It usually returns:
		// {
		//   events: { "name": "DEFINE EVENT..." },
		//   fields: { "name": "DEFINE FIELD..." },
		//   indexes: { "name": "DEFINE INDEX..." },
		//   lives: {},
		//   tables: {}
		// }
		// But it doesn't return the TABLE definition itself in the result root usually,
		// we have to rely on the INFO FOR DB result for the table definition string?
		// Yes, dbInfo.tables[tableName] contains "DEFINE TABLE ..."

		const tableDdl = tablesMap[tableName];
		if (!tableDdl) {
			console.warn(`No DDL found for table ${tableName}`);
			continue;
		}

		// Check for unsupported table features
		checkFeatureSupport("table", tableName, tableDdl);

		const partialTable = parseTableDefinition(tableDdl);

		// Parse Fields
		const fields: FieldAST[] = [];
		const fieldsMap = tableInfo.fields || {};
		for (const fieldName of Object.keys(fieldsMap)) {
			const fieldDdl = fieldsMap[fieldName];
			if (fieldDdl) {
				// Check for unsupported field features
				checkFeatureSupport("field", fieldName, fieldDdl);

				try {
					fields.push(parseFieldDefinition(fieldDdl));
				} catch (e) {
					console.warn(
						`Failed to parse field ${fieldName} on table ${tableName}`,
						e,
					);
				}
			}
		}

		// Parse Indexes
		const indexes: IndexAST[] = [];
		const indexesMap = tableInfo.indexes || {};
		for (const indexName of Object.keys(indexesMap)) {
			const indexDdl = indexesMap[indexName];
			if (indexDdl) {
				// Check for unsupported index features
				const supported = checkFeatureSupport("index", indexName, indexDdl);

				if (supported) {
					try {
						indexes.push(parseIndexDefinition(indexDdl));
					} catch (e) {
						console.warn(
							`Failed to parse index ${indexName} on table ${tableName}`,
							e,
						);
					}
				}
			}
		}

		// Parse Events (Changefeeds)
		const events: EventAST[] = [];
		const eventsMap = tableInfo.events || {};
		for (const eventName of Object.keys(eventsMap)) {
			const eventDdl = eventsMap[eventName];
			if (eventDdl) {
				checkFeatureSupport("event", eventName, eventDdl);
			}
		}

		if (partialTable.name && partialTable.type) {
			tablesAST.push({
				name: partialTable.name,
				type: partialTable.type,
				drop: partialTable.drop || false,
				schemafull: partialTable.schemafull || false,
				viewQuery: partialTable.viewQuery,
				permissions: partialTable.permissions || {},
				fields,
				indexes,
				events,
			});
		}
	}

	return {
		tables: tablesAST,
	};
}
