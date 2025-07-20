-- hisab.products definition

-- Drop table

-- DROP TABLE hisab.products;

CREATE TABLE hisab.products (
	id serial4 NOT NULL,
	"companyId" int4 NOT NULL,
	"userId" int4 NOT NULL,
	"name" text NOT NULL,
	"itemType" text NOT NULL,
	"itemCode" text NULL,
	"hsnCode" text NULL,
	description text NULL,
	"defaultInvoiceDescription" text NULL,
	"categoryId" int4 NULL,
	"isInventoryTracked" bool DEFAULT false NULL,
	"isSerialized" bool DEFAULT false NULL,
	"unitOfMeasurementId" int4 NULL,
	"stockCategoryId" int4 NULL,
	rate numeric(15, 2) DEFAULT 0 NOT NULL,
	"isTaxInclusive" bool DEFAULT false NULL,
	discount numeric(5, 2) DEFAULT 0 NULL,
	"taxCategoryId" int4 NULL,
	"openingStockQty" numeric(10, 2) DEFAULT 0 NULL,
	"currentStock" numeric(10, 2) DEFAULT 0 NULL,
	"openingStockCostPerQty" numeric(15, 2) DEFAULT 0 NULL,
	"isActive" bool DEFAULT true NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"deletedAt" timestamp NULL,
	CONSTRAINT "products_itemType_check" CHECK (("itemType" = ANY (ARRAY['product'::text, 'service'::text, 'bundle'::text]))),
	CONSTRAINT products_pkey PRIMARY KEY ("companyId", id)
);

-- Permissions

ALTER TABLE hisab.products OWNER TO avnadmin;
GRANT ALL ON TABLE hisab.products TO avnadmin;


-- hisab.products foreign keys

ALTER TABLE hisab.products ADD CONSTRAINT "products_companyId_categoryId_fkey" FOREIGN KEY ("companyId","categoryId") REFERENCES hisab."productCategories"("companyId",id) ON DELETE SET NULL;
ALTER TABLE hisab.products ADD CONSTRAINT "products_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES hisab.companies(id) ON DELETE CASCADE;
ALTER TABLE hisab.products ADD CONSTRAINT "products_companyId_stockCategoryId_fkey" FOREIGN KEY ("companyId","stockCategoryId") REFERENCES hisab."stockCategories"("companyId",id) ON DELETE SET NULL;
ALTER TABLE hisab.products ADD CONSTRAINT "products_taxCategoryId_fkey" FOREIGN KEY ("taxCategoryId") REFERENCES hisab."taxCategories"(id);
ALTER TABLE hisab.products ADD CONSTRAINT "products_unitOfMeasurementId_fkey" FOREIGN KEY ("unitOfMeasurementId") REFERENCES hisab."unitOfMeasurements"(id);
ALTER TABLE hisab.products ADD CONSTRAINT "products_userId_fkey" FOREIGN KEY ("userId") REFERENCES hisab.users(id) ON DELETE SET NULL;