import { pgTable, uuid, text, timestamp, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import type { GameState } from "@/lib/game-data";

export const users = pgTable("game_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  name: text("name").notNull().default("President"),
  guest: boolean("guest").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const sessions = pgTable("game_sessions", {
  token: text("token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
});
export const saves = pgTable("game_saves", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<GameState>().notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const authLimits = pgTable("auth_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull().default(1),
  resetAt: timestamp("reset_at").notNull(),
});
