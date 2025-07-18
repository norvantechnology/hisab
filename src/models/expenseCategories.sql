CREATE TABLE IF NOT EXISTS hisab."expenseCategories" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES hisab."users"(id) ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdBy" INTEGER REFERENCES hisab."users"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);