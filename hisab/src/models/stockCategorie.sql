-- hisab."stockCategories" definition

-- Drop table

-- DROP TABLE hisab."stockCategories";

CREATE TABLE hisab."stockCategories" (
	id serial4 NOT NULL,
	"companyId" int4 NOT NULL,
	"name" text NOT NULL,
	description text NULL,
	"isActive" bool DEFAULT true NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT "stockCategories_pkey" PRIMARY KEY ("companyId", id)
);

-- Permissions

ALTER TABLE hisab."stockCategories" OWNER TO avnadmin;
GRANT ALL ON TABLE hisab."stockCategories" TO avnadmin;


-- hisab."stockCategories" foreign keys

ALTER TABLE hisab."stockCategories" ADD CONSTRAINT "stockCategories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES hisab.companies(id) ON DELETE CASCADE;