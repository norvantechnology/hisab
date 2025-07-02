CREATE TABLE IF NOT EXISTS hisab."serialNumbers" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL REFERENCES hisab."companies"(id) ON DELETE CASCADE,
  "productId" INTEGER NOT NULL,
  "variantId" INTEGER,
  "serialNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('in_stock', 'sold', 'returned', 'defective')),
  "purchaseDate" TIMESTAMP,
  "saleDate" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY ("companyId", "productId") 
    REFERENCES hisab."products"("companyId", "id") ON DELETE CASCADE,
  FOREIGN KEY ("companyId", "variantId") 
    REFERENCES hisab."productVariants"("companyId", "id") ON DELETE SET NULL,
  
  UNIQUE ("companyId", "serialNumber")
);