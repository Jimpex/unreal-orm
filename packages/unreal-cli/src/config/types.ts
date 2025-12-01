/**
 * Configuration types for UnrealORM CLI
 */

import type { ConnectOptions, RootAuth, NamespaceAuth, DatabaseAuth } from "surrealdb";

export type AuthConfig = RootAuth | NamespaceAuth | DatabaseAuth;

/** Remote connection via URL */
export interface RemoteConnection extends ConnectOptions {
	url: string;
}

/** Embedded connection mode (requires @surrealdb/node) */
export interface EmbeddedConnection extends ConnectOptions {
	embedded:
		| "memory"
		| `file://${string}`
		| `surrealkv://${string}`
		| `rocksdb://${string}`;
}

export type ConnectionConfig = RemoteConnection | EmbeddedConnection;

export interface UnrealConfig {
	connection: ConnectionConfig;
	schema: {
		output: string;
		include?: string[];
	};
}

/**
 * Helper to define configuration with type safety
 */
export function defineConfig(config: UnrealConfig): UnrealConfig {
	return config;
}
