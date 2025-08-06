-- hisab."roleModulePermissions" definition

-- Drop table

-- DROP TABLE hisab."roleModulePermissions";

CREATE TABLE hisab."roleModulePermissions" (
	id serial4 NOT NULL,
	"roleId" int4 NOT NULL,
	"moduleId" int4 NOT NULL,
	"permissionType" varchar(20) NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT "roleModulePermissions_permissionType_check" CHECK ((("permissionType")::text = ANY ((ARRAY['VIEW'::character varying, 'CREATE'::character varying, 'EDIT'::character varying, 'DELETE'::character varying])::text[]))),
	CONSTRAINT "roleModulePermissions_pkey" PRIMARY KEY (id),
	CONSTRAINT "roleModulePermissions_roleId_moduleId_permissionType_key" UNIQUE ("roleId", "moduleId", "permissionType")
);
CREATE INDEX idx_rolemoduleperms_moduleid ON hisab."roleModulePermissions" USING btree ("moduleId");
CREATE INDEX idx_rolemoduleperms_roleid ON hisab."roleModulePermissions" USING btree ("roleId");

-- Permissions

ALTER TABLE hisab."roleModulePermissions" OWNER TO avnadmin;
GRANT ALL ON TABLE hisab."roleModulePermissions" TO avnadmin;


-- hisab."roleModulePermissions" foreign keys

ALTER TABLE hisab."roleModulePermissions" ADD CONSTRAINT "roleModulePermissions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES hisab.modules(id) ON DELETE CASCADE;
ALTER TABLE hisab."roleModulePermissions" ADD CONSTRAINT "roleModulePermissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES hisab."userRoles"(id) ON DELETE CASCADE;