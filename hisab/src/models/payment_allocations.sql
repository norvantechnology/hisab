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
	CONSTRAINT payment_allocations_balance_check CHECK ((((("allocationType")::text = 'opening-balance'::text) AND ("purchaseId" IS NULL)) OR ((("allocationType")::text = 'current-balance'::text) AND ("purchaseId" IS NULL)) OR ((("allocationType")::text = 'purchase'::text) AND ("purchaseId" IS NOT NULL)))),
	CONSTRAINT "payment_allocations_paymentId_purchaseId_type_key" UNIQUE ("paymentId", "purchaseId", "allocationType"),
	CONSTRAINT payment_allocations_pkey PRIMARY KEY (id)
);

-- Permissions

ALTER TABLE hisab.payment_allocations OWNER TO avnadmin;
GRANT ALL ON TABLE hisab.payment_allocations TO avnadmin;


-- hisab.payment_allocations foreign keys

ALTER TABLE hisab.payment_allocations ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES hisab.payments(id) ON DELETE CASCADE;
ALTER TABLE hisab.payment_allocations ADD CONSTRAINT "payment_allocations_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES hisab.purchases(id) ON DELETE CASCADE;