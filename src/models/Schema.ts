import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// This file defines the structure of your database tables using the Drizzle ORM.

// To modify the database schema:
// 1. Update this file with your desired changes.
// 2. Generate a new migration by running: `npm run db:generate`

// The generated migration file will reflect your schema changes.
// The migration is automatically applied during the next database interaction,
// so there's no need to run it manually or restart the Next.js server.

// Need a database for production? Check out https://www.prisma.io/?via=nextjsboilerplate
// Tested and compatible with Next.js Boilerplate

export const counterSchema = pgTable('counter', {
  id: serial('id').primaryKey(),
  count: integer('count').default(0),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// User profiles table - extends Supabase auth.users
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey(), // References auth.users.id
  email: varchar('email', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  locale: varchar('locale', { length: 10 }).default('zh').notNull(),
  timezone: varchar('timezone', { length: 50 }).default('Asia/Shanghai'),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// User preferences table
export const userPreferences = pgTable('user_preferences', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull(), // References auth.users.id
  theme: varchar('theme', { length: 20 }).default('light').notNull(),
  emailNotifications: boolean('email_notifications').default(true).notNull(),
  marketingEmails: boolean('marketing_emails').default(false).notNull(),
  language: varchar('language', { length: 10 }).default('zh').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// User subscriptions table for billing
export const userSubscriptions = pgTable('user_subscriptions', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull(), // References auth.users.id
  planId: varchar('plan_id', { length: 50 }).notNull(), // free, pro, enterprise
  status: varchar('status', { length: 20 }).default('active').notNull(), // active, cancelled, expired
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  currentPeriodStart: timestamp('current_period_start', { mode: 'date' }),
  currentPeriodEnd: timestamp('current_period_end', { mode: 'date' }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// Spirit generation records - stores each mirror generation
export const spiritGenerations = pgTable('spirit_generations', {
  id: serial('id').primaryKey(),
  spiritId: varchar('spirit_id', { length: 20 }).notNull(), // naga, singha, hong, chang, garuda
  spiritName: varchar('spirit_name', { length: 100 }),
  userPhoto: text('user_photo'), // base64 thumbnail
  generatedImage: text('generated_image').notNull(), // base64 result
  prompt: text('prompt'),
  spiritScores: jsonb('spirit_scores'), // { naga: 0.8, singha: 0.6, ... }
  metadata: jsonb('metadata'), // additional data
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});
