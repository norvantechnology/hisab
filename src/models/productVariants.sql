CREATE TABLE IF NOT EXISTS hisab."productVariants" (
  "id" SERIAL,
  "companyId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "variantName" TEXT NOT NULL,
  "sku" TEXT,
  "barcode" TEXT,
  "priceAdjustment" DECIMAL(15, 2) DEFAULT 0,
  "currentStock" DECIMAL(10, 2) DEFAULT 0,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY ("companyId", "id"),
  
  FOREIGN KEY ("companyId", "productId") 
    REFERENCES hisab."products"("companyId", "id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_variants_company_product ON hisab."productVariants" ("companyId", "productId");