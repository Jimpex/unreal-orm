import type { BoundQuery, Expr } from "surrealdb";

/**
 * Options for defining a file storage bucket.
 *
 * **EXPERIMENTAL**: Requires the `files` experimental capability to be enabled.
 * Enable with `--allow-experimental files` when starting SurrealDB.
 *
 * @since SurrealDB v3.0.0
 *
 * @example
 * ```ts
 * const AvatarBucket = Bucket.define({
 *   name: "avatars",
 *   backend: "memory",
 * });
 *
 * const UploadBucket = Bucket.define({
 *   name: "uploads",
 *   backend: "file:/var/data/uploads",
 *   permissions: surql`WHERE $auth.role = 'admin' OR $action = 'get'`,
 * });
 * ```
 */
export interface BucketOptions {
	/** The name of the bucket. Used as the path prefix in file pointers (e.g., `f"name:/file.txt"`). */
	name: string;
	/**
	 * The storage backend for the bucket.
	 * - `"memory"` — non-persistent, in-memory storage.
	 * - `"file:/path/to/folder"` — persistent disk storage. Requires `SURREAL_BUCKET_FOLDER_ALLOWLIST` to be set.
	 * - Omit for a global bucket (uses `SURREAL_GLOBAL_BUCKET` / `SURREAL_GLOBAL_BUCKET_ENFORCED`).
	 */
	backend?: string;
	/** Whether the bucket is read-only (`READONLY`). */
	readonly?: boolean;
	/**
	 * A SurrealQL `WHERE` expression controlling access to files in this bucket.
	 * Available variables inside the clause:
	 * - `$action`: The action being performed (`put`, `get`, `head`, `delete`, `copy`, `rename`, `exists`, `list`).
	 * - `$file`: The file pointer being accessed.
	 * - `$target`: The target file pointer for `copy`/`rename` operations.
	 *
	 * @example
	 * ```ts
	 * permissions: surql`WHERE $auth.role = 'admin'`
	 * permissions: surql`WHERE $action IN ['get', 'head'] OR $auth.admin = true`
	 * ```
	 */
	permissions?: BoundQuery | Expr;
	/** A comment describing the bucket. */
	comment?: string;
}

/**
 * The internal representation of a bucket definition.
 * Created by `Bucket.define()` and passed to `applySchema`.
 * @internal
 */
export interface BucketDefinition extends BucketOptions {
	/** @internal A type identifier for the bucket definition. */
	_type: "bucket";
}
