CREATE TABLE IF NOT EXISTS hisab."products" (
  "id" SERIAL,
  "companyId" INTEGER NOT NULL REFERENCES hisab."companies"(id) ON DELETE CASCADE,
  "userId" INTEGER NOT NULL REFERENCES hisab."users"(id) ON DELETE SET NULL,
  
  -- Basic Information
  "name" TEXT NOT NULL,
  "itemType" TEXT NOT NULL CHECK ("itemType" IN ('product', 'service', 'bundle')),
  "itemCode" TEXT,
  "hsnCode" TEXT,
  "description" TEXT,
  "defaultInvoiceDescription" TEXT,
  
  -- Inventory Management
  "isInventoryTracked" BOOLEAN DEFAULT FALSE,
  "isSerialized" BOOLEAN DEFAULT FALSE,
  "unitOfMeasurementId" INTEGER REFERENCES hisab."unitOfMeasurements"(id),
  "stockCategoryId" INTEGER,
  
  -- Pricing Information
  "rate" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "isTaxInclusive" BOOLEAN DEFAULT FALSE,
  "discount" DECIMAL(5, 2) DEFAULT 0,
  "taxCategoryId" INTEGER REFERENCES hisab."taxCategories"(id),
  
  -- Opening Stock Information
  "openingStockQty" DECIMAL(10, 2) DEFAULT 0,
  "currentStock" DECIMAL(10, 2) DEFAULT 0,
  "openingStockCostPerQty" DECIMAL(15, 2) DEFAULT 0,
  
  -- Status and Timestamps
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP,
  
  PRIMARY KEY ("companyId", "id"),
  
  -- Corrected foreign key constraint
  FOREIGN KEY ("companyId", "stockCategoryId") 
    REFERENCES hisab."stockCategories"("companyId", "id") 
    ON DELETE SET NULL
);