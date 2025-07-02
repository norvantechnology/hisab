CREATE TABLE IF NOT EXISTS hisab."payments" (
  "id" SERIAL PRIMARY KEY,
  "paymentNumber" TEXT NOT NULL,
  "companyId" INTEGER NOT NULL REFERENCES hisab."companies"(id) ON DELETE CASCADE,
  "contactId" INTEGER NOT NULL REFERENCES hisab."contacts"(id) ON DELETE RESTRICT,
  "bankId" INTEGER REFERENCES hisab."bankAccounts"(id) ON DELETE SET NULL,
  "date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "amount" DECIMAL(15, 2) NOT NULL,
  "paymentType" TEXT CHECK ("paymentType" IN ('payment', 'receipt')) NOT NULL,
  "transactions" JSONB NOT NULL,
  "discounts" JSONB,
  "notes" TEXT,
  "createdBy" INTEGER REFERENCES hisab."users"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  "deletedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);