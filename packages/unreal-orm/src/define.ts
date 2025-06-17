import type { Surreal } from 'surrealdb';
import { RecordId as SurrealRecordId } from 'surrealdb';
import type {
  FieldDefinition,
  InferTableDataFromFields,
  ModelInstance,
  ModelStatic,
  TableDefineOptions,
  InferShapeFromFields,
  CreateData,
  SelectQueryOptions,
  OrderByClause,
  // AnyFunction
} from "./types";
import { BaseTable } from './baseTable';

/**
 * Defines a new table model class. Returns a class representing a SurrealDB table, with strong typing for fields and relations.
 *
 * @template TFields The shape of the field definitions for the table.
 * @param options The table configuration options (name, fields, indexes, permissions, etc.)
 * @returns A new class representing the SurrealDB table model, with static CRUD/query methods and proper TypeScript typing for all fields.
 *
 * @example
 *   // Define a User model
 *   import Table, { Field } from 'unreal-orm';
 *   const User = Table.define({
 *     name: 'user',
 *     fields: {
 *       name: Field.string({ assert: '$value.length > 2' }),
 *       age: Field.number({ default: '0' }),
 *       profile: Field.object({
 *         bio: Field.string(),
 *         website: Field.option(Field.string()),
 *       }),
 *       posts: Field.array(Field.record((): any => Post), { max: 100 }),
 *     },
 *     indexes: [{ name: 'user_name_idx', fields: ['name'], unique: true }],
 *   });
 *
 *   // Add instance/static methods directly in the class body (required)
 *   class UserWithMethods extends User {
 *     getDisplayName(): string {
 *       return this.name.toUpperCase();
 *     }
 *     static async findByName(db, name: string) {
 *       return this.select(db, { where: `name = $name`, vars: { name }, only: true });
 *     }
 *   }
 *
 *   // Usage
 *   const user = await User.create(db, { name: 'Alice' });
 *   const found = await UserWithMethods.findByName(db, 'Alice');
 */
function defineTable< 
  TFields extends Record<string, FieldDefinition<unknown>>
>(
  options: TableDefineOptions<TFields>
): ModelStatic<ModelInstance<InferTableDataFromFields<TFields>>, TFields> {
  type TableData = InferTableDataFromFields<TFields>;
  type CreateInputData = InferShapeFromFields<TFields>;
  type ThisModelInstance = ModelInstance<TableData>;
  // Type alias for the full data shape of this table's records, including 'id'
  class DynamicModelBase extends BaseTable<TableData> {
    // Statically store the options and field definitions for runtime access
    static readonly _tableName = options.name;
    static readonly _fields = options.fields;
    static readonly _options = options;

    // Holds dynamic properties for schemaless data or dynamic query results (e.g. GROUP BY)
    $dynamic: Record<string, unknown> = {};

    [key: string]: unknown;

    static getTableName(): string {
      return options.name;
    }

    static async create<T extends typeof DynamicModelBase>(
      this: T,
      db: Surreal,
      data: CreateData<TFields>
    ): Promise<InstanceType<T>> {
      if (!db) {
        throw new Error('SurrealDB instance must be provided to create a record.');
      }
      // The db.create method expects data without an ID. CreateData<TableData> is Omit<TableData, 'id'>.
      // The generic for db.create should be the shape of data *without* id.
      const createdRecords = await db.create<CreateInputData>(this.getTableName(), data as CreateInputData);
      if (!createdRecords || createdRecords.length === 0) {
        // This case should ideally not happen if SurrealDB successfully creates a record
        // and doesn't throw an error, but it's good to be defensive.
        throw new Error(`Failed to create record in ${this.getTableName()}. No record returned.`);
      }
      // db.create returns an array of created records. We expect one for a single create operation.
      // The createdRecord will include the 'id' field populated by SurrealDB.
      // db.create returns (CreateInputData & { id: RecordId })[] which is compatible with TableData
      const createdRecord = createdRecords[0] as TableData;
      return new this(createdRecord) as InstanceType<T>;
    }

    constructor(data: TableData & Record<string, unknown>) {
      super(data); // This now only sets `this.id`.

      const fields = (this.constructor as typeof DynamicModelBase)._fields;

      // Manually assign properties from data, hydrating relations as we go.
      for (const key in data) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
        if (key === 'id') continue;

        const fieldDef = fields[key as keyof TFields];
        const rawValue = data[key as keyof TableData];

        if (!fieldDef) {
          // This property exists on the data but not in the schema, assign it to the dynamic part.
          this.$dynamic[key] = data[key];
          continue;
        }

        // --- Relation Hydration Logic ---
        // Hydrate single record relation
        if (fieldDef.type.startsWith('record<') && fieldDef.recordTableThunk && typeof rawValue === 'object' && rawValue !== null && !(rawValue instanceof SurrealRecordId) && !Array.isArray(rawValue)) {
          const RelatedModel = fieldDef.recordTableThunk();
          this[key] = new RelatedModel(rawValue as unknown as TableData);
          continue;
        }
        
        // Hydrate array of records relation
        const arrayElementType = fieldDef.arrayElementType;
        if (fieldDef.type.startsWith('array<') && arrayElementType?.type.startsWith('record<') && arrayElementType.recordTableThunk && Array.isArray(rawValue)) {
          const RelatedModel = arrayElementType.recordTableThunk();
          this[key] = rawValue.map((item: unknown) => {
            // Only instantiate if it's a plain object (a fetched record), not a RecordId string
            if (typeof item === 'object' && item !== null && !(item instanceof SurrealRecordId)) {
              return new RelatedModel(item as TableData);
            }
            return item; // It's already a RecordId or some other primitive, return as-is
          });
          continue;
        }
        
        // Default assignment if no hydration happened
        (this as { [key: string]: unknown })[key] = rawValue;
      }
    }

    async update(db: Surreal, data: Partial<CreateInputData>): Promise<void> {
      if (!this.id) { 
        throw new Error('Instance must have an ID to be updated.');
      }
      if (!db) {
        throw new Error('SurrealDB instance must be provided to update a record.');
      }

      // data is Partial<Omit<TableData, 'id'>>.
      // The surrealdb.js client's update method is typed to accept this for the data payload.
      await db.update(this.id, data); 

      // Update instance properties
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key) && key in DynamicModelBase._fields) {
          (this as { [key: string]: unknown })[key] = data[key as keyof CreateInputData];
        }
      }
    }

    // Placeholder for common CRUD static methods to be added later

    // --- Static SELECT methods ---

    /**
     * Selects all records from the table.
     * @param db - The SurrealDB client instance.
     * @returns A promise that resolves to an array of model instances.
     */
    // Overload for grouped selects
    static async select<T extends typeof DynamicModelBase, O extends SelectQueryOptions<InferTableDataFromFields<T['_fields']>> & { groupBy: string[] }>(this: T, db: Surreal, options: O): Promise<Record<string, unknown>[]>;




    // Overload for partial selects
    static async select<T extends typeof DynamicModelBase, O extends SelectQueryOptions<InferTableDataFromFields<T['_fields']>> & { select: string[] }>(this: T, db: Surreal, options: O): Promise<O['only'] extends true ? Partial<InferTableDataFromFields<T['_fields']>> | undefined : Partial<InferTableDataFromFields<T['_fields']>>[]>;

    /**
     * Selects all records from the table.
     * @param db - The SurrealDB client instance.
     * @returns A promise that resolves to an array of model instances.
     */
    static async select<T extends typeof DynamicModelBase>(this: T, db: Surreal): Promise<InstanceType<T>[]>;
    /**
     * Selects records from the table with a wide range of query options.
     * @template O - The type of the select query options.
     * @param db - The SurrealDB client instance.
     * @param options - The query options, including filters, sorting, and fetching.
     * @returns A promise that resolves to a single model instance (or undefined) if `options.only` is true,
     *          or an array of model instances otherwise.
     */
    static async select<T extends typeof DynamicModelBase, O extends SelectQueryOptions<InferTableDataFromFields<T['_fields']>>>(
      this: T,
      db: Surreal,
      options: O
    ): Promise<O['only'] extends true ? InstanceType<T> | undefined : InstanceType<T>[]>;

    // Unified implementation for all select overloads
    static async select<T extends typeof DynamicModelBase>(
      this: T,
      db: Surreal,
      options?: SelectQueryOptions<InferTableDataFromFields<T['_fields']>>
    ): Promise<unknown> { // Return type is 'unknown' as this implements multiple differently-typed overloads.
      const opts = options || {};
      const tableName = this.getTableName();
      type ModelInstanceType = InstanceType<T>;
      type ActualTableData = InferTableDataFromFields<T['_fields']>;

      const queryParts: string[] = [];
      const bindings: Record<string, unknown> = opts.vars || {};
      const selectFields = (opts.select && opts.select.length > 0) ? (opts.select as string[]).join(', ') : '*';

      let fromClause: string;
      let isDirectIdQuery = false;

      if (opts.from) {
        if (opts.from instanceof SurrealRecordId) {
          bindings.fromIdBinding = opts.from; // Bind the RecordId instance directly
          fromClause = '$fromIdBinding';
          isDirectIdQuery = true;
        } else {
          // opts.from is a string (e.g. a subquery result or different table name)
          fromClause = (opts.only) ? `ONLY ${opts.from}` : opts.from;
        }
      } else {
        // Default to table name, apply ONLY if requested
        fromClause = (opts.only) ? `ONLY ${tableName}` : tableName;
      }

      queryParts.push(`SELECT ${selectFields} FROM ${fromClause}`);

      // WHERE clause is only added if not a direct ID query or if explicitly provided
      if (!isDirectIdQuery && opts.where) {
        queryParts.push(`WHERE ${opts.where}`);
      } else if (isDirectIdQuery && opts.where) {
        // This case might be unusual (WHERE on a direct ID query) but supported if user provides it
        console.warn('[ORM WARNING] Applying WHERE clause to a direct RecordId query. This is unusual.');
        queryParts.push(`WHERE ${opts.where}`);
      }
      if (opts.orderBy && opts.orderBy.length > 0) {
        const orderByClauses = opts.orderBy.map((ob: OrderByClause) => {
          let clause = String(ob.field);
          if (ob.order) clause += ` ${ob.order.toUpperCase()}`;
          if (ob.collate) clause += ' COLLATE';
          if (ob.numeric) clause += ' NUMERIC';
          return clause;
        });
        queryParts.push(`ORDER BY ${orderByClauses.join(', ')}`);
      }
      if (opts.limit !== undefined) queryParts.push(`LIMIT ${opts.limit}`);
      if (opts.start !== undefined) queryParts.push(`START ${opts.start}`);
      if (opts.fetch && opts.fetch.length > 0) queryParts.push(`FETCH ${opts.fetch.join(', ')}`);
      if (opts.groupBy && opts.groupBy.length > 0) queryParts.push(`GROUP BY ${opts.groupBy.join(', ')}`);

      const finalQuery = queryParts.join(' ');
      console.log(`[ORM DEBUG] Executing query: "${finalQuery}" with bindings:`, JSON.parse(JSON.stringify(bindings)));

      // The result from db.query is always an array of results for each statement.
      // We always expect an array of records from the first result.
      const queryResult = await db.query<[ActualTableData[]]>(finalQuery, bindings);
      console.debug('[ORM DEBUG] Query result:', queryResult);
      const recordArray: ActualTableData[] = queryResult?.[0] || [];

      // For partial or grouped selects, return the raw data, respecting the 'only' flag.
      if (opts.select || opts.groupBy) {
        return opts.only ? recordArray[0] : recordArray;
      }

      const instances = recordArray.map(r => new this(r) as ModelInstanceType);

      return opts.only ? instances[0] : instances;
    }
  }

  return DynamicModelBase as unknown as ModelStatic<ThisModelInstance, TFields>;
}

export const Table = {
  define: defineTable,
}
export default Table;