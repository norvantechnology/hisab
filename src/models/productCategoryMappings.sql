CREATE TABLE IF NOT EXISTS hisab."productCategoryMappings" (
  "companyId" INTEGER NOT NULL REFERENCES hisab."companies"(id) ON DELETE CASCADE,
  "productId" INTEGER NOT NULL,
  "categoryId" INTEGER NOT NULL,
  
  PRIMARY KEY ("companyId", "productId", "categoryId"),
  FOREIGN KEY ("companyId", "productId") 
    REFERENCES hisab."products"("companyId", "id") ON DELETE CASCADE,
  FOREIGN KEY ("companyId", "categoryId") 
    REFERENCES hisab."productCategories"("companyId", "id") ON DELETE CASCADE
);