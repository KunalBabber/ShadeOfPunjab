import { createInsertSchema } from "drizzle-zod";
import { jsonb, pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

export const siteSettingsTable = pgTable("site_settings", {
  id: integer("id").primaryKey(),
  brandName: text("brand_name").notNull().default("Shades of Punjab"),
  heroHeadline: text("hero_headline").notNull().default("Style Rooted in Punjab"),
  heroSubheading: text("hero_subheading"),
  heroImageUrl: text("hero_image_url"),
  instagramUrl: text("instagram_url")
    .notNull()
    .default("https://www.instagram.com/shades.of.punjab.amritsar/"),
  categories: jsonb("categories")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  featuredCollectionTitle: text("featured_collection_title"),
  featuredCollectionDescription: text("featured_collection_description"),
  aboutStory: text("about_story"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSiteSettingsSchema = createInsertSchema(
  siteSettingsTable,
).omit({
  updatedAt: true,
});
export type InsertSiteSettings = z.infer<typeof insertSiteSettingsSchema>;
export type SiteSettings = typeof siteSettingsTable.$inferSelect;