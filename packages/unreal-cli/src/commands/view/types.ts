import type { Surreal } from "surrealdb";

export interface TableInfo {
	name: string;
	count: number | "?" | "timeout";
}

export interface ViewState {
	db: Surreal;
	pageSize: number;
	terminalHeight: number;
	/** Query timeout in seconds */
	timeout: number;
	/** Max concurrent count queries */
	concurrency: number;
}

export type PendingChange =
	| { type: "edit"; key: string; oldValue: unknown; newValue: unknown }
	| { type: "add"; key: string; value: unknown }
	| { type: "remove"; key: string; oldValue: unknown };
