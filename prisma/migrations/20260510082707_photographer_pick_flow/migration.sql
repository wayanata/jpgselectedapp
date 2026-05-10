-- Migrate Job to photographer-rooted flow; backfill legacy rows.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'Selections',
    "slug" TEXT NOT NULL,
    "customerToken" TEXT NOT NULL,
    "driveFolderId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "photographerId" TEXT NOT NULL,
    "customerId" TEXT,
    CONSTRAINT "Job_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Job_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Job" (
  "id",
  "title",
  "slug",
  "customerToken",
  "driveFolderId",
  "createdAt",
  "updatedAt",
  "photographerId",
  "customerId"
)
SELECT
  "id",
  "title",
  "slug",
  lower(hex(randomblob(16))) || '-' || lower(hex(randomblob(8))),
  'root',
  "createdAt",
  "updatedAt",
  COALESCE("customerId", (SELECT "id" FROM "User" LIMIT 1)),
  "customerId"
FROM "Job";

DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";

CREATE UNIQUE INDEX "Job_slug_key" ON "Job"("slug");
CREATE UNIQUE INDEX "Job_customerToken_key" ON "Job"("customerToken");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
