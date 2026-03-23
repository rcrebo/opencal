import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
  varchar,
  json,
} from "drizzle-orm/pg-core";

export const slots = pgTable("slots", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull(), // admin email who created this slot
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  isBooked: boolean("is_booked").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const otpCodes = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  zoomLink: text("zoom_link").notNull().default(""),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  slotId: integer("slot_id")
    .references(() => slots.id)
    .notNull()
    .unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  notes: text("notes"),
  participants: json("participants").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
