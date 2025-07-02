CREATE TABLE IF NOT EXISTS hisab."productCategories" (
  "id" SERIAL,
  "companyId" INTEGER NOT NULL REFERENCES hisab."companies"(id) ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "parentCategoryId" INTEGER,
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY ("companyId", "id"),
  FOREIGN KEY ("companyId", "parentCategoryId") 
    REFERENCES hisab."productCategories"("companyId", "id") ON DELETE SET NULL,
  UNIQUE ("companyId", "name")
);