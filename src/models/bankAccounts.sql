CREATE TABLE IF NOT EXISTS hisab."bankAccounts" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES hisab."users"(id) ON DELETE CASCADE,
  "companyId" INTEGER NOT NULL REFERENCES hisab."companies"(id) ON DELETE CASCADE,
  "accountType" TEXT NOT NULL CHECK ("accountType" IN ('cash', 'bank', 'credit_card', 'wallet')),
  "accountName" TEXT NOT NULL,
  "currentBalance" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "openingBalance" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP
);