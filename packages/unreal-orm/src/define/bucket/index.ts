import type { BucketDefinition, BucketOptions } from "./types";

export const Bucket = {
	/**
	 * Defines a file storage bucket.
	 * The definition can be passed to `applySchema` to create the bucket in SurrealDB.
	 *
	 * **EXPERIMENTAL**: Requires the `files` experimental capability to be enabled.
	 * Enable with `--allow-experimental files` when starting SurrealDB.
	 *
	 * @param options Configuration for the bucket.
	 * @returns A bucket definition object.
	 *
	 * @since SurrealDB v3.0.0
	 *
	 * @example
	 * ```ts
	 * // In-memory bucket
	 * const AvatarBucket = Bucket.define({
	 *   name: "avatars",
	 *   backend: "memory",
	 * });
	 *
	 * // Disk-backed bucket with permissions
	 * const UploadBucket = Bucket.define({
	 *   name: "uploads",
	 *   backend: "file:/var/data/uploads",
	 *   permissions: surql`WHERE $auth.role = 'admin' OR $action = 'get'`,
	 *   comment: "User upload storage",
	 * });
	 *
	 * // Apply to the database
	 * await applySchema(db, [User, AvatarBucket, UploadBucket]);
	 * ```
	 */
	define(options: BucketOptions): BucketDefinition {
		return {
			_type: "bucket",
			...options,
		};
	},
};
