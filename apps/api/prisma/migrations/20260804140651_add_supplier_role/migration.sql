-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "decisionNote" TEXT,
    "suppliedById" TEXT,
    "suppliedAt" DATETIME,
    "supplyNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_suppliedById_fkey" FOREIGN KEY ("suppliedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("createdAt", "decidedAt", "decidedById", "decisionNote", "id", "note", "productId", "quantity", "requestedById", "status", "updatedAt") SELECT "createdAt", "decidedAt", "decidedById", "decisionNote", "id", "note", "productId", "quantity", "requestedById", "status", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_productId_createdAt_idx" ON "Order"("productId", "createdAt");
CREATE INDEX "Order_requestedById_createdAt_idx" ON "Order"("requestedById", "createdAt");
CREATE INDEX "Order_status_idx" ON "Order"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Seed the single shared supplier account (tedarik / 1) used by the new Tedarikçi Paneli.
-- Kept as a data migration (not a manual server step) so it's created automatically on deploy.
INSERT INTO "User" ("id", "username", "passwordHash", "name", "role", "isActive", "createdAt", "updatedAt")
SELECT '1b2dbfd5-1dc9-47f1-b877-ea58d715d790', 'tedarik', '$2b$10$v9x6ibfQ9Knhp19PddDQoOTG8GmJlpAk3Ov.DP0MJdtHdcqApivt.', 'Tedarikçi', 'SUPPLIER', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE "username" = 'tedarik');
