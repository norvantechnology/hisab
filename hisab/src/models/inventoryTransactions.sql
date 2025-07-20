-- hisab."inventoryTransactions" definition

-- Drop table

-- DROP TABLE hisab."inventoryTransactions";

CREATE TABLE hisab."inventoryTransactions" (
	id serial4 NOT NULL,
	"companyId" int4 NOT NULL,
	"productId" int4 NOT NULL,
	"variantId" int4 NULL,
	"transactionType" text NOT NULL,
	quantity numeric(10, 2) NOT NULL,
	"unitCost" numeric(15, 2) NULL,
	"totalValue" numeric(15, 2) NULL,
	"referenceId" int4 NULL,
	"referenceType" text NULL,
	notes text NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"createdBy" int4 NULL,
	CONSTRAINT "inventoryTransactions_pkey" PRIMARY KEY ("companyId", id),
	CONSTRAINT "inventoryTransactions_transactionType_check" CHECK (("transactionType" = ANY (ARRAY['purchase'::text, 'sale'::text, 'return'::text, 'adjustment'::text, 'opening_stock'::text])))
);
CREATE INDEX idx_inv_trans_company_date ON hisab."inventoryTransactions" USING btree ("companyId", "createdAt");
CREATE INDEX idx_inv_trans_company_product ON hisab."inventoryTransactions" USING btree ("companyId", "productId");

-- Permissions

ALTER TABLE hisab."inventoryTransactions" OWNER TO avnadmin;
GRANT ALL ON TABLE hisab."inventoryTransactions" TO avnadmin;


-- hisab."inventoryTransactions" foreign keys

ALTER TABLE hisab."inventoryTransactions" ADD CONSTRAINT "inventoryTransactions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES hisab.companies(id) ON DELETE CASCADE;
ALTER TABLE hisab."inventoryTransactions" ADD CONSTRAINT "inventoryTransactions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES hisab.users(id);