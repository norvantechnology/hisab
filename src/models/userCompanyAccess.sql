CREATE TABLE IF NOT EXISTS hisab."userCompanyAccess" (
  "id" SERIAL PRIMARY KEY,
  "adminUserId" INTEGER NOT NULL REFERENCES hisab."users"(id) ON DELETE CASCADE,
  "grantedUserId" INTEGER NOT NULL REFERENCES hisab."users"(id) ON DELETE CASCADE,
  "companyId" INTEGER NOT NULL REFERENCES hisab."companies"(id) ON DELETE CASCADE,
  "roleId" INTEGER REFERENCES hisab."userRoles"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP NULL,
  UNIQUE ("grantedUserId", "companyId")
);