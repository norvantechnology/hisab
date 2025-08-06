-- hisab.payment_allocations definition

-- Drop table

-- DROP TABLE hisab.payment_allocations;

CREATE TABLE hisab.payment_allocations (
	id serial4 NOT NULL,
	"paymentId" int4 NOT NULL,
	"purchaseId" int4 NULL,
	"allocationType" varchar(50) DEFAULT 'purchase'::character varying NOT NULL,
	amount numeric(15, 2) NOT NULL,
	"paidAmount" numeric(15, 2) NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"balanceType" varchar(20) NULL,
	"expenseId" int4 NULL,
	"incomeId" int4 NULL,
	"saleId" int4 NULL,
	CONSTRAINT payment_allocations_balance_check CHECK ((((("allocationType")::text = 'opening-balance'::text) AND ("purchaseId" IS NULL) AND ("expenseId" IS NULL) AND ("incomeId" IS NULL) AND ("saleId" IS NULL)) OR ((("allocationType")::text = 'current-balance'::text) AND ("purchaseId" IS NULL) AND ("expenseId" IS NULL) AND ("incomeId" IS NULL) AND ("saleId" IS NULL)) OR ((("allocationType")::text = 'purchase'::text) AND ("purchaseId" IS NOT NULL) AND ("expenseId" IS NULL) AND ("incomeId" IS NULL) AND ("saleId" IS NULL)) OR ((("allocationType")::text = 'expense'::text) AND ("purchaseId" IS NULL) AND ("expenseId" IS NOT NULL) AND ("incomeId" IS NULL) AND ("saleId" IS NULL)) OR ((("allocationType")::text = 'income'::text) AND ("purchaseId" IS NULL) AND ("expenseId" IS NULL) AND ("incomeId" IS NOT NULL) AND ("saleId" IS NULL)) OR ((("allocationType")::text = 'sale'::text) AND ("purchaseId" IS NULL) AND ("expenseId" IS NULL) AND ("incomeId" IS NULL) AND ("saleId" IS NOT NULL)))),
	CONSTRAINT payment_allocations_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_payment_allocations_sale ON hisab.payment_allocations USING btree ("saleId", "allocationType") WHERE (("allocationType")::text = 'sale'::text);
CREATE UNIQUE INDEX payment_allocations_payment_balance_unique ON hisab.payment_allocations USING btree ("paymentId", "allocationType") WHERE (("allocationType")::text = ANY ((ARRAY['opening-balance'::character varying, 'current-balance'::character varying])::text[]));
CREATE UNIQUE INDEX payment_allocations_payment_expense_unique ON hisab.payment_allocations USING btree ("paymentId", "expenseId", "allocationType") WHERE ((("allocationType")::text = 'expense'::text) AND ("expenseId" IS NOT NULL));
CREATE UNIQUE INDEX payment_allocations_payment_income_unique ON hisab.payment_allocations USING btree ("paymentId", "incomeId", "allocationType") WHERE ((("allocationType")::text = 'income'::text) AND ("incomeId" IS NOT NULL));
CREATE UNIQUE INDEX payment_allocations_payment_purchase_unique ON hisab.payment_allocations USING btree ("paymentId", "purchaseId", "allocationType") WHERE ((("allocationType")::text = 'purchase'::text) AND ("purchaseId" IS NOT NULL));
CREATE UNIQUE INDEX payment_allocations_payment_sale_unique ON hisab.payment_allocations USING btree ("paymentId", "saleId", "allocationType") WHERE ((("allocationType")::text = 'sale'::text) AND ("saleId" IS NOT NULL));

-- Permissions

ALTER TABLE hisab.payment_allocations OWNER TO avnadmin;
GRANT ALL ON TABLE hisab.payment_allocations TO avnadmin;


-- hisab.payment_allocations foreign keys

ALTER TABLE hisab.payment_allocations ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES hisab.payments(id) ON DELETE CASCADE;
ALTER TABLE hisab.payment_allocations ADD CONSTRAINT "payment_allocations_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES hisab.purchases(id) ON DELETE CASCADE;