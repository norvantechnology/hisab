CREATE TABLE IF NOT EXISTS hisab."purchase_items" (
  "id" SERIAL PRIMARY KEY,
  "purchaseId" INTEGER NOT NULL REFERENCES hisab."purchases"(id) ON DELETE CASCADE,
  "productId" INTEGER REFERENCES hisab."products"("id"),

  "qty" DECIMAL(10, 2) NOT NULL,
  "rate" DECIMAL(15, 2) NOT NULL,
  "discount" DECIMAL(10, 2) DEFAULT 0,
  "taxPercent" DECIMAL(5, 2) DEFAULT 0,

  "total" DECIMAL(15, 2) NOT NULL
);
