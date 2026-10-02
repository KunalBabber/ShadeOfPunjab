import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

const adminUserIds = new Set(
  (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((userId) => userId.trim())
    .filter(Boolean),
);

export function isAdminUserId(userId: string | null | undefined): boolean {
  return Boolean(userId && adminUserIds.has(userId));
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;

  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  if (!isAdminUserId(userId)) {
    res.status(403).json({ error: "Owner access is not enabled for this account." });
    return;
  }

  next();
};