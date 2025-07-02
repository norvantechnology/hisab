CREATE TABLE IF NOT EXISTS hisab."roleModulePermissions" (
  "id" SERIAL PRIMARY KEY,
  "roleId" INTEGER NOT NULL REFERENCES hisab."userRoles"(id) ON DELETE CASCADE,
  "moduleId" INTEGER NOT NULL REFERENCES hisab."modules"(id) ON DELETE CASCADE,
  "permissionType" VARCHAR(20) NOT NULL CHECK ("permissionType" IN ('VIEW', 'CREATE', 'EDIT', 'DELETE')),
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("roleId", "moduleId", "permissionType")
);

CREATE INDEX IF NOT EXISTS idx_rolemoduleperms_roleid ON hisab."roleModulePermissions" ("roleId");
CREATE INDEX IF NOT EXISTS idx_rolemoduleperms_moduleid ON hisab."roleModulePermissions" ("moduleId");