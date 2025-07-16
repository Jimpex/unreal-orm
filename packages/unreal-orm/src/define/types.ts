import type { AnyModelClass } from "./table/types/model";
import type { IndexDefinition } from "./index/types";

export type Definable = AnyModelClass | IndexDefinition;
