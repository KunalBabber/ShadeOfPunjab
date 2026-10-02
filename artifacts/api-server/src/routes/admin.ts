import { asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import {
  CreateProductBody,
  CreateProductResponse,
  CreateStoreBody,
  CreateStoreResponse,
  DeleteProductParams,
  DeleteStoreParams,
  GetAdminAccessResponse,
  ListAdminProductsResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
  UpdateSiteSettingsBody,
  UpdateSiteSettingsResponse,
  UpdateStoreBody,
  UpdateStoreParams,
  UpdateStoreResponse,
} from "@workspace/api-zod";
import {
  db,
  productsTable,
  siteSettingsTable,
  storesTable,
} from "@workspace/db";
import { isAdminUserId, requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
router.get("/admin/access", (req, res): void => {
  const userId = getAuth(req).userId;
  res.json(
    GetAdminAccessResponse.parse({
      signedIn: Boolean(userId),
      isAdmin: isAdminUserId(userId),
    }),
  );
});
router.use("/admin", requireAdmin);

function toSlug(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

router.get("/admin/products", async (_req, res): Promise<void> => {
  const products = await db
    .select()
    .from(productsTable)
    .orderBy(asc(productsTable.createdAt));
  res.json(ListAdminProductsResponse.parse(products));
});

router.post("/admin/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const values = parsed.data;
  const [product] = await db
    .insert(productsTable)
    .values({
      name: values.name.trim(),
      slug: toSlug(values.slug?.trim() || values.name),
      description: values.description ?? null,
      priceInr: values.priceInr ?? null,
      imageUrls: values.imageUrls ?? [],
      sizes: values.sizes ?? [],
      colors: values.colors ?? [],
      category: values.category ?? null,
      collection: values.collection ?? null,
      stock: values.stock ?? null,
      isPublished: values.isPublished ?? false,
      isFeatured: values.isFeatured ?? false,
      isNewArrival: values.isNewArrival ?? false,
    })
    .returning();

  res.status(201).json(CreateProductResponse.parse(product));
});

router.patch("/admin/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res
      .status(400)
      .json({ error: params.error?.message ?? parsed.error?.message });
    return;
  }

  const values = parsed.data;
  const updates = {
    ...(values.name !== undefined ? { name: values.name.trim() } : {}),
    ...(values.slug !== undefined
      ? { slug: toSlug(values.slug) }
      : values.name !== undefined
        ? { slug: toSlug(values.name) }
        : {}),
    ...(values.description !== undefined
      ? { description: values.description }
      : {}),
    ...(values.priceInr !== undefined ? { priceInr: values.priceInr } : {}),
    ...(values.imageUrls !== undefined ? { imageUrls: values.imageUrls } : {}),
    ...(values.sizes !== undefined ? { sizes: values.sizes } : {}),
    ...(values.colors !== undefined ? { colors: values.colors } : {}),
    ...(values.category !== undefined ? { category: values.category } : {}),
    ...(values.collection !== undefined
      ? { collection: values.collection }
      : {}),
    ...(values.stock !== undefined ? { stock: values.stock } : {}),
    ...(values.isPublished !== undefined
      ? { isPublished: values.isPublished }
      : {}),
    ...(values.isFeatured !== undefined
      ? { isFeatured: values.isFeatured }
      : {}),
    ...(values.isNewArrival !== undefined
      ? { isNewArrival: values.isNewArrival }
      : {}),
  };

  const [product] = await db
    .update(productsTable)
    .set(updates)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }

  res.json(UpdateProductResponse.parse(product));
});

router.delete("/admin/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .returning({ id: productsTable.id });
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }

  res.sendStatus(204);
});

router.post("/admin/stores", async (req, res): Promise<void> => {
  const parsed = CreateStoreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [store] = await db
    .insert(storesTable)
    .values({
      name: parsed.data.name.trim(),
      address: parsed.data.address ?? null,
      phone: parsed.data.phone ?? null,
      whatsapp: parsed.data.whatsapp ?? null,
      openingHours: parsed.data.openingHours ?? null,
      mapsUrl: parsed.data.mapsUrl ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      description: parsed.data.description ?? null,
    })
    .returning();

  res.status(201).json(CreateStoreResponse.parse(store));
});

router.patch("/admin/stores/:id", async (req, res): Promise<void> => {
  const params = UpdateStoreParams.safeParse(req.params);
  const parsed = UpdateStoreBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res
      .status(400)
      .json({ error: params.error?.message ?? parsed.error?.message });
    return;
  }

  const [store] = await db
    .update(storesTable)
    .set({
      ...parsed.data,
      ...(parsed.data.name !== undefined
        ? { name: parsed.data.name.trim() }
        : {}),
    })
    .where(eq(storesTable.id, params.data.id))
    .returning();

  if (!store) {
    res.status(404).json({ error: "Store not found." });
    return;
  }

  res.json(UpdateStoreResponse.parse(store));
});

router.delete("/admin/stores/:id", async (req, res): Promise<void> => {
  const params = DeleteStoreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [store] = await db
    .delete(storesTable)
    .where(eq(storesTable.id, params.data.id))
    .returning({ id: storesTable.id });
  if (!store) {
    res.status(404).json({ error: "Store not found." });
    return;
  }

  res.sendStatus(204);
});

router.put("/admin/site-settings", async (req, res): Promise<void> => {
  const parsed = UpdateSiteSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const values = parsed.data;
  const [settings] = await db
    .insert(siteSettingsTable)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({
      target: siteSettingsTable.id,
      set: { ...values },
    })
    .returning();

  res.json(UpdateSiteSettingsResponse.parse(settings));
});

export default router;