-- hisab.purchase_items definition

-- Drop table

-- DROP TABLE hisab.purchase_items;

CREATE TABLE hisab.purchase_items (
	id serial4 NOT NULL,
	"purchaseId" int4 NOT NULL,
	"companyId" int4 NOT NULL,
	"productId" int4 NOT NULL,
	qty numeric(10, 2) NOT NULL,
	rate numeric(15, 2) NOT NULL,
	discount numeric(10, 2) DEFAULT 0 NULL,
	"discountRate" numeric(5, 2) DEFAULT 0 NULL,
	"taxRate" numeric(5, 2) DEFAULT 0 NULL,
	"taxAmount" numeric(15, 2) DEFAULT 0 NULL,
	total numeric(15, 2) NOT NULL,
	"serialNumbers" _text DEFAULT '{}'::text[] NULL,
	"deletedAt" timestamp NULL,
	CONSTRAINT purchase_items_pkey PRIMARY KEY (id)
);

-- Permissions

ALTER TABLE hisab.purchase_items OWNER TO avnadmin;
GRANT ALL ON TABLE hisab.purchase_items TO avnadmin;


-- hisab.purchase_items foreign keys

ALTER TABLE hisab.purchase_items ADD CONSTRAINT "purchase_items_companyId_productId_fkey" FOREIGN KEY ("companyId","productId") REFERENCES hisab.products("companyId",id) ON DELETE CASCADE;
ALTER TABLE hisab.purchase_items ADD CONSTRAINT "purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES hisab.purchases(id) ON DELETE CASCADE;