CREATE TABLE IF NOT EXISTS hisab."companies" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES hisab."users"(id) ON DELETE CASCADE,
  "gstin" TEXT,
  "name" TEXT NOT NULL,
  "country" TEXT,
  "currency" TEXT,
  "address1" TEXT,
  "address2" TEXT,
  "city" TEXT,
  "pincode" TEXT,
  "state" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
