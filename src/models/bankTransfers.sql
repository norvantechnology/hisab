CREATE TABLE IF NOT EXISTS hisab."bankTransfers" (
  "id" SERIAL PRIMARY KEY,
  "transferNumber" TEXT NOT NULL,
  "companyId" INTEGER NOT NULL REFERENCES hisab."companies"(id) ON DELETE CASCADE,
  "fromBankId" INTEGER NOT NULL REFERENCES hisab."bankAccounts"(id) ON DELETE RESTRICT,
  "toBankId" INTEGER NOT NULL REFERENCES hisab."bankAccounts"(id) ON DELETE RESTRICT,
  "date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "amount" DECIMAL(15, 2) NOT NULL,
  "description" TEXT,
  "referenceNumber" TEXT,
  "createdBy" INTEGER REFERENCES hisab."users"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP
);