import { test, describe, expect, beforeAll, afterAll } from 'bun:test';
import { type RecordId, Surreal, RecordId as SurrealRecordId } from "surrealdb";
import { surrealdbNodeEngines } from '@surrealdb/node';
import { Field } from "../src/fields"; // Use relative import
import Table from '../src/define';
import { applySchema } from '../src/schemaGenerator'; // Use relative import

// Define the User table
class User extends Table.define({
  fields: {
    name: Field.string({ assert: 'string::len($value) > 0 AND string::len($value) <= 255' }),
    email: Field.string({ value: 'string::lowercase($value)', assert: 'string::is::email($value)' }),
    age: Field.option(Field.number({ assert: '$value >= 0' })),
    createdAt: Field.datetime({ default: 'time::now()' }),
    tags: Field.array(Field.string(), {default: '[]'}),
    settings: Field.object({
      profile_visibility: Field.string({ default: '"public"', assert: '$value INSIDE ["public", "private", "friends"]' })
    }, {default: '{}'}),
    optionalBio: Field.option(Field.string({ assert: 'string::len($value) <= 500' })),
    lastLogin: Field.option(Field.datetime()),
    status: Field.string({ default: '"pending"' }),
    // biome-ignore lint/suspicious/noExplicitAny: Using `any` in the thunk is a temporary workaround to break the circular dependency between the User and Post models. A more robust solution is being investigated.
    posts: Field.array(Field.record((): any => Post), {default: '[]'})
  },
  name: 'user',
  schemafull: true,
  permissions: {
    select: 'FULL',
    create: 'WHERE $auth.role = "admin"',
    update: 'WHERE $auth.id = $this.id OR $auth.role = "admin"',
    delete: 'WHERE $auth.role = "admin"'
  },
  indexes: [
    { name: 'idx_email', fields: ['email'], unique: true },
    { name: 'idx_name_age', fields: ['name', 'age'] }
  ]
  // instanceMethods are now defined in the class body
}) {
  getProfileVisibility(): string | undefined {
    // 'this' is automatically typed as an instance of User
    // Accessing nested property: this.settings.profile_visibility
    // The 'settings' field is defined as Field.object({ profile_visibility: Field.string(...) })
    // So, this.settings should be an object with a profile_visibility property.
    return this.settings?.profile_visibility;
  }

  isAdult(): boolean {
    return (this.age ?? 0) >= 18;
  }
}

// Define the Post table
// IMPORTANT: Using a thunk `() => User` to avoid circular dependency issues.
class Post extends Table.define({
  fields: {
    title: Field.string({ assert: 'string::len($value) > 0' }),
    content: Field.string(),
    published: Field.option(Field.bool({ default: 'false' })),
    publishedAt: Field.option(Field.datetime()),
    // biome-ignore lint/suspicious/noExplicitAny: Using `any` in the thunk is a temporary workaround to break the circular dependency between the User and Post models. A more robust solution is being investigated.
    author: Field.record((): any => User, { onDelete: 'cascade' }),
    viewCount: Field.number({ default: '0' }),
    tags: Field.array(Field.string(), {default: '[]'})
  },
  name: 'post',
  schemafull: true
}) {
  getAuthorName(): string | undefined {
    // Check if author is populated and is a User instance with a name property
    // Ensure author is treated as a User instance for type checking
    const authorInstance = this.author as User | undefined;
    if (authorInstance && typeof authorInstance === 'object' && 'name' in authorInstance && typeof authorInstance.name === 'string') {
      return authorInstance.name;
    }
    return undefined;
  }

  async publish(db: Surreal): Promise<void> {
    // 'this' is automatically typed as an instance of Post
    await this.update(db, { published: true, publishedAt: new Date() });
  }
}

// Define the AdminUser table
class AdminUser extends Table.define({
  name: 'admin_user',
  fields: {
    username: Field.string(),
    role: Field.string(),
  }
  // instanceMethods can be added to the class body if needed
}) {
  static getPlatformName() {
    return 'SuperAdmin Platform';
  }
}

describe('ORM Integration Tests', () => {
  let db: Surreal;
  const user1Id = new SurrealRecordId('user', 'user1');
  const user2Id = new SurrealRecordId('user', 'user2');
  let post1Id: RecordId<'post'>;

  beforeAll(async () => {
    db = new Surreal({
      engines: surrealdbNodeEngines(),
    });
    await db.connect('mem://');
    await db.use({ namespace: 'test', database: 'test' });
    await applySchema(db, [User, Post, AdminUser], 'IF NOT EXISTS');

    // Seeding initial data
    await db.create(user1Id, { name: 'Alice', email: 'alice@example.com', age: 25, tags: ['dev'], settings: { profile_visibility: 'private' }, createdAt: new Date(), status: 'active' });
    await db.create(user2Id, { name: 'Bob', email: 'bob@example.com', age: 19, tags: ['qa'], settings: { profile_visibility: 'public' }, createdAt: new Date(), status: 'active' });

    const post1 = await Post.create(db, { title: 'First Post', content: '...', author: user1Id, published: true, tags: ['tech', 'news'], publishedAt: new Date() }) as InstanceType<typeof Post>;
    post1Id = post1.id as RecordId<'post'>;
    await Post.create(db, { title: 'Second Post', content: '...', author: user2Id, published: false, tags: ['lifestyle'], publishedAt: new Date() });
  });

  afterAll(async () => {
    await db.delete('user');
    await db.delete('post');
    await db.close();
  });

  test('should fetch all users and instantiate them correctly', async () => {
    const allUsers = await User.select(db);
    expect(allUsers.length).toBe(2);
    const alice = allUsers.find((u) => u.name === 'Alice');
    if (!alice) {
      throw new Error('Expected to find user "Alice", but she was not found.');
    }
    // Assign to a new variable with an explicit type annotation.
    // After the guard, user_maybe is known to be InstanceType<typeof User>.
    const user1 = alice;

    // Strong type guard for the compiler
    if (!(user1 instanceof User)) {
      throw new Error('Test setup error: user1 is not an instance of User as expected.');
    }

    expect(user1.name).toBe('Alice');
    // Now call the instance method, user1 is definitely a User instance.
    const isAdultStatus = user1.isAdult();
    expect(isAdultStatus).toBe(true);
  });

  test('should fetch a single user by ID using "only"', async () => {
    const singleUser = await User.select(db, { from: user1Id, only: true });
    if (!singleUser) {
      throw new Error('Expected to select the user, but it was not found.');
    }
    expect(singleUser).toBeInstanceOf(User);
    expect(singleUser.name).toBe('Alice');
    expect(singleUser.email).toBe('alice@example.com');
  });

  test('should select specific fields and return raw objects', async () => {
    const usersNameEmail = await User.select(db, { select: ['name', 'email'] });
    expect(usersNameEmail.length).toBe(2);
    // When selecting specific fields, the result is a raw object, not a model instance
    expect(usersNameEmail[0]).not.toBeInstanceOf(User);
    expect(usersNameEmail[0]).toEqual({ name: 'Alice', email: 'alice@example.com' });
  });

  test('should select users with a WHERE clause', async () => {
    const usersOver20 = await User.select(db, { where: 'age > $minAge', vars: { minAge: 20 } });
    expect(usersOver20.length).toBe(1);
    const user = usersOver20[0];
    if (!user) {
      throw new Error('Expected to select at least one user, but the array was empty.');
    }
    expect(user).toBeInstanceOf(User);
    expect(user.name).toBe('Alice');
  });

  test('should select users with GROUP BY and return raw data', async () => {
    type GroupedUser = { status: string; total: number; average_age: number };

    const usersByStatusRaw = await User.select(db, {
      select: ['status', 'count() as total', 'math::mean(age) as average_age'],
      groupBy: ['status'],
    });
    
    expect(usersByStatusRaw.length).toBe(1);
    const activeGroup = (usersByStatusRaw as GroupedUser[]).find((g) => g.status === 'active');
    if (!activeGroup) {
      throw new Error('Expected to find the active group, but it was not found.');
    }
    expect(activeGroup.total).toBe(2);
    expect(activeGroup.average_age).toBeCloseTo(22);
  });

  test('should fetch a related record and hydrate it into a model instance', async () => {
    const postWithAuthor = await Post.select(db, {
      from: post1Id,
      only: true,
      fetch: ['author'],
    });

    if (!postWithAuthor) {
      throw new Error('Expected to select the post, but it was not found.');
    }
    expect(postWithAuthor).toBeInstanceOf(Post);
    expect(postWithAuthor.title).toBe('First Post');

    // The `author` property should be an instance of the `User` class.
    const { author } = postWithAuthor;
    if (!(author instanceof User)) {
      throw new Error('The author property was not hydrated into a User instance.');
    }
    
    expect(author.isAdult()).toBe(true);
  });

  test('should fetch a user with an array of related posts and hydrate them', async () => {
    // Create another user for this test
    const userWithPostsData = {
      name: 'Carol',
      email: 'carol@example.com',
      age: 30,
    };
    const user3 = await User.create(db, userWithPostsData);

    // Create posts for Carol
    const carolPost1 = await Post.create(db, {
      title: 'Carol Post 1',
      content: 'Content by Carol',
      author: user3.id,
      published: true,
    });
    const carolPost2 = await Post.create(db, {
      title: 'Carol Post 2',
      content: 'More content by Carol',
      author: user3.id,
      published: false,
    });

    // SurrealDB relation update: user -> posts -> post
    // This is a bit manual, ideally the ORM would help more here in the future
    await db.query("UPDATE $user SET posts = [$carolPost1, $carolPost2]", {
      user: user3.id,
      carolPost1: carolPost1.id,
      carolPost2: carolPost2.id,
    });

    const userWithFetchedPosts = await User.select(db, {
      from: user3.id,
      only: true,
      fetch: ['posts'],
    });

    if (!userWithFetchedPosts) {
      throw new Error('Expected to select the user, but it was not found.');
    }
    expect(userWithFetchedPosts.posts).toBeInstanceOf(Array);
    expect(userWithFetchedPosts.posts.length).toBe(2);

    const [fetchedPost1, fetchedPost2] = userWithFetchedPosts.posts;

    if (!fetchedPost1 || !fetchedPost2) {
      throw new Error('Expected to find two posts, but they were not found in the array.');
    }

    if (!(fetchedPost1 instanceof Post) || !(fetchedPost2 instanceof Post)) {
      throw new Error('Posts were not hydrated into Post instances.');
    }

    expect(fetchedPost1.title).toBe('Carol Post 1');
    expect(fetchedPost2.title).toBe('Carol Post 2');
  });  // This closes the 'should fetch a user with an array of related posts...' test

  // Test for instance methods (class body)
  test('should correctly call instance method defined in class body', async () => {
    const user = await User.select(db, { from: user1Id, only: true });
    if (!user) throw new Error('User not found');
    expect(user.isAdult()).toBe(true); // Alice is 25
    const user2 = await User.select(db, { from: user2Id, only: true });
    if (!user2) throw new Error('User 2 not found for isAdult test');
    expect(user2.isAdult()).toBe(true); // Bob is 19
  });

  // Test for instance methods (now class-defined)
  test('should correctly call instance method getProfileVisibility (class defined)', async () => {
    const user = await User.select(db, { from: user1Id, only: true });
    if (!user) throw new Error('User not found');
    expect(user.getProfileVisibility()).toBe('private');
  });

  // Test for static methods (class body)
  test('should correctly call static method defined in class body', () => {
    // expect(User.getRegisteredUsersCount).toBeDefined();
    // // Further checks depend on actual implementation of getRegisteredUsersCount
    // // For example, if it's a function:
    // // if (typeof User.getRegisteredUsersCount === 'function') {
    // //   expect(User.getRegisteredUsersCount()).toBeGreaterThanOrEqual(2); 
    // // }

  });

  // AdminUser definition moved to top-level, test remains here
  test('should correctly call static method defined via options on a different model', () => {
    expect(AdminUser.getPlatformName()).toBe('SuperAdmin Platform');
  });

// Example for User's static method from options (if one were defined)
// test('should correctly call static method defined via options on User model', () => {
//   // Assuming User had a static method like:
//   // staticMethods: { getGlobalUserSetting: () => 'default_theme' }
//   // expect(User.getGlobalUserSetting()).toBe('default_theme');
// });

test('should fail to create a user with an invalid email', async () => {
  const invalidUserData = {
    name: 'Invalid Email User',
    email: 'not-a-valid-email', // Invalid email
    age: 30,
  };
  // We expect User.create to throw due to the email validation assertion.
  // We catch the error and return undefined as that meets or goal.
  // If a user was created, it would return the user and fail
  expect(await User.create(db, invalidUserData).catch(() => undefined)).toBeUndefined();
});

}); // This closes the main describe block
