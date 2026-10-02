import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetProductParams,
  GetProductResponse,
  GetSiteSettingsResponse,
  ListCategoriesResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  ListStoresResponse,
} from "@workspace/api-zod";
import {
  db,
  productsTable,
  siteSettingsTable,
  storesTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/products", async (req, res): Promise<void> => {
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { query, category, collection, sort } = parsed.data;
  const filters = [eq(productsTable.isPublished, true)];

  if (query) {
    filters.push(
      or(
        ilike(productsTable.name, `%${query}%`),
        ilike(productsTable.slug, `%${query}%`),
        ilike(productsTable.category, `%${query}%`),
        ilike(productsTable.collection, `%${query}%`),
      )!,
    );
  }
  if (category) filters.push(eq(productsTable.category, category));
  if (collection) filters.push(eq(productsTable.collection, collection));

  const ordering =
    sort === "newest"
      ? [desc(productsTable.createdAt)]
      : sort === "price-asc"
        ? [asc(productsTable.priceInr)]
        : sort === "price-desc"
          ? [desc(productsTable.priceInr)]
          : [desc(productsTable.isFeatured), desc(productsTable.createdAt)];

  const products = await db
    .select()
    .from(productsTable)
    .where(and(...filters))
    .orderBy(...ordering);

  res.json(ListProductsResponse.parse(products));
});

router.get("/products/:slug", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(
      and(
        eq(productsTable.slug, params.data.slug),
        eq(productsTable.isPublished, true),
      ),
    )
    .limit(1);

  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }

  res.json(GetProductResponse.parse(product));
});

router.get("/categories", async (_req, res): Promise<void> => {
  const [settings] = await db
    .select({ categories: siteSettingsTable.categories })
    .from(siteSettingsTable)
    .where(eq(siteSettingsTable.id, 1))
    .limit(1);

  res.json(ListCategoriesResponse.parse(settings?.categories ?? []));
});

router.get("/stores", async (_req, res): Promise<void> => {
  const stores = await db.select().from(storesTable).orderBy(asc(storesTable.id));
  res.json(ListStoresResponse.parse(stores));
});

router.get("/site-settings", async (_req, res): Promise<void> => {
  const [settings] = await db
    .select()
    .from(siteSettingsTable)
    .where(eq(siteSettingsTable.id, 1))
    .limit(1);

  if (!settings) {
    res.status(503).json({ error: "Storefront settings are not initialized." });
    return;
  }

  res.json(GetSiteSettingsResponse.parse(settings));
});

export default router;