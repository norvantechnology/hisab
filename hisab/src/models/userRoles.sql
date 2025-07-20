CREATE TABLE IF NOT EXISTS hisab."userRoles" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdBy" INTEGER NOT NULL REFERENCES hisab."users"(id) ON DELETE CASCADE,
  "companyId" INTEGER NOT NULL REFERENCES hisab."companies"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP NULL
);

-- Create an index for better performance on companyId queries
CREATE INDEX IF NOT EXISTS idx_userroles_companyid ON hisab."userRoles" ("companyId");