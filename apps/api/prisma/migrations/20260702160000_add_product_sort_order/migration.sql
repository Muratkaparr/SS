-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "categoryId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 5,
    "safetyMarginDays" INTEGER NOT NULL DEFAULT 3,
    "criticalLevelManual" INTEGER,
    "criticalLevel" INTEGER NOT NULL DEFAULT 0,
    "suggestedCriticalLevel" INTEGER,
    "avgDailyConsumption7d" REAL NOT NULL DEFAULT 0,
    "avgDailyConsumption30d" REAL NOT NULL DEFAULT 0,
    "confidence" TEXT NOT NULL DEFAULT 'LOW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("avgDailyConsumption30d", "avgDailyConsumption7d", "categoryId", "confidence", "createdAt", "criticalLevel", "criticalLevelManual", "currentStock", "description", "id", "imageUrl", "leadTimeDays", "name", "safetyMarginDays", "suggestedCriticalLevel", "unit", "updatedAt", "warehouseId") SELECT "avgDailyConsumption30d", "avgDailyConsumption7d", "categoryId", "confidence", "createdAt", "criticalLevel", "criticalLevelManual", "currentStock", "description", "id", "imageUrl", "leadTimeDays", "name", "safetyMarginDays", "suggestedCriticalLevel", "unit", "updatedAt", "warehouseId" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "Product_warehouseId_sortOrder_idx" ON "Product"("warehouseId", "sortOrder");
CREATE UNIQUE INDEX "Product_warehouseId_name_key" ON "Product"("warehouseId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

