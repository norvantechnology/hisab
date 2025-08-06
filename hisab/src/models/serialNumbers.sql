-- hisab."serialNumbers" definition

-- Drop table

-- DROP TABLE hisab."serialNumbers";

CREATE TABLE hisab."serialNumbers" (
	id serial4 NOT NULL,
	"companyId" int4 NOT NULL,
	"productId" int4 NOT NULL,
	"variantId" int4 NULL,
	"serialNumber" text NOT NULL,
	status text NOT NULL,
	"purchaseDate" timestamp NULL,
	"saleDate" timestamp NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"purchaseItemId" int4 NULL,
	CONSTRAINT "serialNumbers_companyId_productId_serialNumber_key" UNIQUE ("companyId", "productId", "serialNumber"),
	CONSTRAINT "serialNumbers_pkey" PRIMARY KEY (id),
	CONSTRAINT "serialNumbers_status_check" CHECK ((status = ANY (ARRAY['in_stock'::text, 'sold'::text, 'returned'::text, 'defective'::text])))
);

-- Permissions

ALTER TABLE hisab."serialNumbers" OWNER TO avnadmin;
GRANT ALL ON TABLE hisab."serialNumbers" TO avnadmin;


-- hisab."serialNumbers" foreign keys

ALTER TABLE hisab."serialNumbers" ADD CONSTRAINT "serialNumbers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES hisab.companies(id) ON DELETE CASCADE;
ALTER TABLE hisab."serialNumbers" ADD CONSTRAINT "serialNumbers_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES hisab.purchase_items(id);