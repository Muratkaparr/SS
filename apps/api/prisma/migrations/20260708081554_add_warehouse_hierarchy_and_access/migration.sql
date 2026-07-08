-- AlterTable
ALTER TABLE "User" ADD COLUMN "rootAllWarehousesLabel" TEXT;

-- CreateTable
CREATE TABLE "WarehouseAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WarehouseAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WarehouseAccess_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "parentId" TEXT,
    "includeInParentTotal" BOOLEAN NOT NULL DEFAULT true,
    "allChildrenLabel" TEXT NOT NULL DEFAULT 'Bütün Ürünler',
    CONSTRAINT "Warehouse_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Warehouse_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Warehouse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Warehouse" ("createdAt", "id", "location", "name", "ownerId", "sortOrder", "updatedAt") SELECT "createdAt", "id", "location", "name", "ownerId", "sortOrder", "updatedAt" FROM "Warehouse";
DROP TABLE "Warehouse";
ALTER TABLE "new_Warehouse" RENAME TO "Warehouse";
CREATE INDEX "Warehouse_ownerId_parentId_idx" ON "Warehouse"("ownerId", "parentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "WarehouseAccess_warehouseId_idx" ON "WarehouseAccess"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseAccess_userId_warehouseId_key" ON "WarehouseAccess"("userId", "warehouseId");
