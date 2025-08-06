-- hisab.sale_serial_numbers definition

-- Drop table

-- DROP TABLE hisab.sale_serial_numbers;

CREATE TABLE hisab.sale_serial_numbers (
	id serial4 NOT NULL,
	"saleId" int4 NOT NULL,
	"saleItemId" int4 NOT NULL,
	"productId" int4 NOT NULL,
	"serialNumber" text NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT sale_serial_numbers_pkey PRIMARY KEY (id)
);

-- Permissions

ALTER TABLE hisab.sale_serial_numbers OWNER TO avnadmin;
GRANT ALL ON TABLE hisab.sale_serial_numbers TO avnadmin;


-- hisab.sale_serial_numbers foreign keys

ALTER TABLE hisab.sale_serial_numbers ADD CONSTRAINT "sale_serial_numbers_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES hisab.sales(id) ON DELETE CASCADE;
ALTER TABLE hisab.sale_serial_numbers ADD CONSTRAINT "sale_serial_numbers_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES hisab.sale_items(id) ON DELETE CASCADE;