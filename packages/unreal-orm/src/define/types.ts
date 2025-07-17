import type { AnyModelClass } from "./table/types/model";
import type { IndexDefinition } from "./index/types";

/**
 * A union type representing any definable ORM entity, such as a model class or an index.
 * @internal
 */
export type Definable = AnyModelClass | IndexDefinition;
