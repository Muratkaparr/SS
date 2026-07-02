-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Warehouse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Warehouse_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Warehouse" ("createdAt", "id", "location", "name", "ownerId", "updatedAt") SELECT "createdAt", "id", "location", "name", "ownerId", "updatedAt" FROM "Warehouse";
DROP TABLE "Warehouse";
ALTER TABLE "new_Warehouse" RENAME TO "Warehouse";
CREATE UNIQUE INDEX "Warehouse_ownerId_name_key" ON "Warehouse"("ownerId", "name");

-- Backfill sortOrder to match the previous alphabetical ordering (per owner), so existing
-- warehouse tabs keep their current order until an admin manually reorders them.
UPDATE "Warehouse"
SET "sortOrder" = (
  SELECT COUNT(*)
  FROM "Warehouse" AS w2
  WHERE w2."ownerId" = "Warehouse"."ownerId"
    AND (w2."name" < "Warehouse"."name" OR (w2."name" = "Warehouse"."name" AND w2."id" < "Warehouse"."id"))
);

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
