/*
  Warnings:

  - Added the required column `ownerId` to the `Category` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Category_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Var olan kategoriler (bu dev veritabanında hepsi seed verisi) en eski ADMIN hesabına
-- atanır — veri kaybı yok, sadece görünürlük kapsamı Admin'e daraltılıyor.
INSERT INTO "new_Category" ("id", "name", "ownerId")
SELECT "id", "name", (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1)
FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE UNIQUE INDEX "Category_ownerId_name_key" ON "Category"("ownerId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
