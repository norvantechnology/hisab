CREATE TABLE hisab.purchase_items (
	id serial4 NOT NULL,
	"purchaseId" int4 NOT NULL,
	"companyId" int4 NOT NULL,
	"productId" int4 NOT NULL,
	qty numeric(10, 2) NOT NULL,
	rate numeric(15, 2) NOT NULL,
	"discountType" varchar(50) DEFAULT 'rupees'::character varying NULL,
	"discountValue" numeric(15, 2) DEFAULT 0 NULL,
	"discountAmount" numeric(15, 2) DEFAULT 0 NULL,
	"taxRate" numeric(5, 2) DEFAULT 0 NULL,
	"taxAmount" numeric(15, 2) DEFAULT 0 NULL,
	total numeric(15, 2) NOT NULL,
	"serialNumbers" _text DEFAULT '{}'::text[] NULL,
	"deletedAt" timestamp NULL,
	"rateType" varchar(50) DEFAULT 'without_tax'::character varying NULL,
	CONSTRAINT purchase_items_pkey PRIMARY KEY (id),
	CONSTRAINT "purchase_items_rateType_check" CHECK ((("rateType")::text = ANY (ARRAY['with_tax'::text, 'without_tax'::text])))
);
