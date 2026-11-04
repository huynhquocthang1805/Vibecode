// Owner: data-engineer (Huy) — ACC-01: Drizzle schema (better-auth + profile + user_data)
import {
  boolean,
  customType,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

export const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array | string }>({
  dataType() {
    return 'bytea';
  },
  toDriver(val: Buffer | Uint8Array): Buffer {
    return Buffer.isBuffer(val) ? val : Buffer.from(val);
  },
  fromDriver(val: unknown): Buffer {
    if (Buffer.isBuffer(val)) return val;
    if (val instanceof Uint8Array) return Buffer.from(val);
    if (typeof val === 'string') {
      const hex = val.startsWith('\\x') ? val.slice(2) : val;
      return Buffer.from(hex, 'hex');
    }
    return Buffer.from(val as ArrayBuffer);
  },
});

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { mode: 'date' }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { mode: 'date' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }),
  updatedAt: timestamp('updatedAt', { mode: 'date' }),
});

export const profile = pgTable('profile', {
  userId: text('userId')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  displayName: varchar('displayName', { length: 60 }).notNull(),
  company: varchar('company', { length: 80 }),
  jobTitle: varchar('jobTitle', { length: 60 }),
  avatar: bytea('avatar'),
  avatarType: varchar('avatarType', { length: 16 }),
  avatarVersion: integer('avatarVersion').notNull().default(0),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull(),
});

export const userData = pgTable('user_data', {
  userId: text('userId')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  state: text('state').notNull(),
  revision: integer('revision').notNull(),
  rows: integer('rows').notNull(),
  bytes: integer('bytes').notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull(),
});

export const schema = {
  user,
  session,
  account,
  verification,
  profile,
  userData,
};
