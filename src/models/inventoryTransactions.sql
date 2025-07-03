CREATE TABLE IF NOT EXISTS hisab."inventoryTransactions" (
  "id" SERIAL,
  "companyId" INTEGER NOT NULL REFERENCES hisab."companies"(id) ON DELETE CASCADE,
  "productId" INTEGER NOT NULL,
  "transactionType" TEXT NOT NULL CHECK ("transactionType" IN ('purchase', 'sale', 'return', 'adjustment', 'opening_stock')),
  "quantity" DECIMAL(10, 2) NOT NULL,
  "unitCost" DECIMAL(15, 2),
  "totalValue" DECIMAL(15, 2),
  "referenceId" INTEGER,
  "referenceType" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "createdBy" INTEGER REFERENCES hisab."users"(id),

  PRIMARY KEY ("companyId", "id"),
  FOREIGN KEY ("companyId", "productId") 
    REFERENCES hisab."products"("companyId", "id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inv_trans_company_product 
  ON hisab."inventoryTransactions" ("companyId", "productId");

CREATE INDEX IF NOT EXISTS idx_inv_trans_company_date 
  ON hisab."inventoryTransactions" ("companyId", "createdAt");
