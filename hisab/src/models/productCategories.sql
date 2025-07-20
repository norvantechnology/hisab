-- hisab."productCategories" definition

-- Drop table

-- DROP TABLE hisab."productCategories";

CREATE TABLE hisab."productCategories" (
	id serial4 NOT NULL,
	"companyId" int4 NOT NULL,
	"name" text NOT NULL,
	description text NULL,
	"parentCategoryId" int4 NULL,
	"isActive" bool DEFAULT true NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT "productCategories_companyId_name_key" UNIQUE ("companyId", name),
	CONSTRAINT "productCategories_pkey" PRIMARY KEY ("companyId", id)
);

-- Permissions

ALTER TABLE hisab."productCategories" OWNER TO avnadmin;
GRANT ALL ON TABLE hisab."productCategories" TO avnadmin;


-- hisab."productCategories" foreign keys

ALTER TABLE hisab."productCategories" ADD CONSTRAINT "productCategories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES hisab.companies(id) ON DELETE CASCADE;
ALTER TABLE hisab."productCategories" ADD CONSTRAINT "productCategories_companyId_parentCategoryId_fkey" FOREIGN KEY ("companyId","parentCategoryId") REFERENCES hisab."productCategories"("companyId",id) ON DELETE SET NULL;