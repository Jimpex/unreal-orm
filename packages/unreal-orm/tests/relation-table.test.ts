import { test, describe, expect } from "bun:test";
import { Surreal } from "surrealdb";
import { Field } from "../src/fields";
import Table from "../src/define";
import { surrealdbNodeEngines } from "@surrealdb/node";

// Define two normal tables for relation endpoints
class User extends Table.normal({
  name: "user",
  fields: {
    name: Field.string(),
  },
  schemafull: true,
}) {}

class Post extends Table.normal({
  name: "post",
  fields: {
    title: Field.string(),
  },
  schemafull: true,
}) {}

// Define a relation table
const Authored = Table.relation({
  name: "authored",
  fields: {
    in: Field.record(() => User),
    out: Field.record(() => Post),
    since: Field.datetime({ default: "time::now()" }),
  },
  schemafull: true,
});

describe("Relation Table API", () => {
  test("should enforce 'in' and 'out' fields at type level", () => {
    // TypeScript: The following should error if 'in' or 'out' are missing
    Table.relation({
      name: "bad_relation",
      // @ts-expect-error
      fields: { since: Field.datetime() },
    });
    // Valid usage should not error
    Table.relation({
      name: "good_relation",
      fields: {
        in: Field.record(() => User),
        out: Field.record(() => Post),
      },
    });
  });

  test("should allow creating and selecting relation records", async () => {
    const db = new Surreal({ engines: surrealdbNodeEngines() });
    await db.connect("mem://");
    await db.use({ namespace: "test_rel", database: "test_rel" });

    // Create endpoints
    const user = await User.create(db, { name: "Alice" });
    const post = await Post.create(db, { title: "Hello World" });

    // Create a relation record
    const authored = await Authored.create(db, {
      in: user.id,
      out: post.id,
      since: new Date(),
    });
    expect(authored.in).toEqual(user.id);
    expect(authored.out).toEqual(post.id);

    // Select relation records
    const found = await Authored.select(db);
    expect(found.length).toBe(1);
    expect(found[0]?.in).toEqual(user.id);
    expect(found[0]?.out).toEqual(post.id);

    await db.delete("authored");
    await db.delete("user");
    await db.delete("post");
    await db.close();
  });
});
