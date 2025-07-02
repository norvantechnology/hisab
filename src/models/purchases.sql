CREATE TABLE IF NOT EXISTS hisab."purchases" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL REFERENCES hisab."companies"(id) ON DELETE CASCADE,
  "userId" INTEGER NOT NULL REFERENCES hisab."users"(id) ON DELETE SET NULL,
  "bankAccountId" INTEGER NOT NULL REFERENCES hisab."bankAccounts"(id) ON DELETE SET NULL,

  "invoiceNumber" TEXT NOT NULL,
  "invoiceDate" DATE NOT NULL,

  "taxPercent" DECIMAL(5, 2) DEFAULT 0,
  "discountType" TEXT DEFAULT 'per_item' CHECK ("discountType" IN ('per_item', 'global')),
  "globalDiscount" DECIMAL(10, 2) DEFAULT 0,

  "roundOff" DECIMAL(10, 2) DEFAULT 0,
  "internalNotes" TEXT,

  "basicAmount" DECIMAL(15, 2) DEFAULT 0,
  "netPayable" DECIMAL(15, 2) DEFAULT 0,

  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP
);
