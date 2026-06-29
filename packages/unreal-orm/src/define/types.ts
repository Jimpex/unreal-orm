import type { AnyModelClass } from "./table/types/model";
import type { IndexDefinition } from "./index/types";
import type { BucketDefinition } from "./bucket/types";

/**
 * A union type representing any definable ORM entity, such as a model class, an index, or a bucket.
 * @internal
 */
export type Definable = AnyModelClass | IndexDefinition | BucketDefinition;
