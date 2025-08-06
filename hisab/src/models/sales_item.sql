-- hisab.sale_items definition

-- Drop table

-- DROP TABLE hisab.sale_items;

CREATE TABLE hisab.sale_items (
	id serial4 NOT NULL,
	"saleId" int4 NOT NULL,
	"productId" int4 NOT NULL,
	quantity numeric(10, 2) NOT NULL,
	rate numeric(15, 2) NOT NULL,
	"taxRate" numeric(5, 2) DEFAULT 0 NULL,
	"taxAmount" numeric(15, 2) DEFAULT 0 NULL,
	discount numeric(15, 2) DEFAULT 0 NULL,
	"discountRate" numeric(5, 2) DEFAULT 0 NULL,
	total numeric(15, 2) NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT sale_items_pkey PRIMARY KEY (id)
);

-- Permissions

ALTER TABLE hisab.sale_items OWNER TO avnadmin;
GRANT ALL ON TABLE hisab.sale_items TO avnadmin;


-- hisab.sale_items foreign keys

ALTER TABLE hisab.sale_items ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES hisab.sales(id) ON DELETE CASCADE;