CREATE TABLE IF NOT EXISTS hisab."permissionTypes" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO hisab."permissionTypes" ("name", "description") VALUES
('VIEWER', 'Can view company data'),
('EDITOR', 'Can view and edit company data'),
('ADMIN', 'Full access including user management');