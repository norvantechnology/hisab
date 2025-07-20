CREATE TABLE IF NOT EXISTS hisab."purchase_items" (
  "id" SERIAL PRIMARY KEY,
  "purchaseId" INTEGER NOT NULL REFERENCES hisab."purchases"(id) ON DELETE CASCADE,
  "companyId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,

  "qty" DECIMAL(10, 2) NOT NULL,
  "rate" DECIMAL(15, 2) NOT NULL,
  "discount" DECIMAL(10, 2) DEFAULT 0,
  "discountRate" DECIMAL(5, 2) DEFAULT 0,
  "taxRate" DECIMAL(5, 2) DEFAULT 0,
  "taxAmount" DECIMAL(15, 2) DEFAULT 0,
  "total" DECIMAL(15, 2) NOT NULL,

  FOREIGN KEY ("companyId", "productId") 
    REFERENCES hisab."products"("companyId", "id") ON DELETE CASCADE
);