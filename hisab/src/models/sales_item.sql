CREATE TABLE hisab.sale_items (
	id serial4 NOT NULL,
	"saleId" int4 NOT NULL,
	"productId" int4 NOT NULL,
	quantity numeric(10, 2) NOT NULL,
	rate numeric(15, 2) NOT NULL,
	"discountType" text DEFAULT 'rupees'::text NULL,
	"discountValue" numeric(10, 2) DEFAULT 0 NULL,
	"discountAmount" numeric(15, 2) DEFAULT 0 NULL,
	"taxRate" numeric(5, 2) DEFAULT 0 NULL,
	"taxAmount" numeric(15, 2) DEFAULT 0 NULL,
	"lineBasic" numeric(15, 2) DEFAULT 0 NULL,
	"lineTotal" numeric(15, 2) DEFAULT 0 NULL,
	"rateType" varchar(50) DEFAULT 'without_tax'::character varying NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT sale_items_pkey PRIMARY KEY (id)
);