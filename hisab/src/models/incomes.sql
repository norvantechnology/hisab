-- hisab.incomes definition

-- Drop table

-- DROP TABLE hisab.incomes;

CREATE TABLE hisab.incomes (
	id serial4 NOT NULL,
	"companyId" int4 NOT NULL,
	"date" date DEFAULT CURRENT_DATE NOT NULL,
	"categoryId" int4 NULL,
	"bankAccountId" int4 NULL,
	amount numeric(15, 2) NOT NULL,
	notes text NULL,
	"createdBy" int4 NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"contactId" int4 NULL,
	status text DEFAULT 'paid'::text NULL,
	"dueDate" date NULL,
	remaining_amount numeric(15, 2) DEFAULT 0.00 NULL,
	paid_amount numeric(15, 2) DEFAULT 0.00 NULL,
	CONSTRAINT incomes_payment_method_check CHECK (((("bankAccountId" IS NOT NULL) AND ("contactId" IS NULL)) OR (("contactId" IS NOT NULL) AND ("bankAccountId" IS NULL) AND (status = 'pending'::text) AND ("dueDate" IS NOT NULL)) OR (("contactId" IS NOT NULL) AND ("bankAccountId" IS NOT NULL) AND (status = 'paid'::text)))),
	CONSTRAINT incomes_pkey PRIMARY KEY (id),
	CONSTRAINT incomes_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text])))
);
CREATE INDEX idx_incomes_contact_status ON hisab.incomes USING btree ("contactId", status) WHERE ("contactId" IS NOT NULL);
CREATE INDEX idx_incomes_payment_tracking ON hisab.incomes USING btree ("companyId", status, remaining_amount) WHERE ((status = 'pending'::text) AND (remaining_amount > (0)::numeric));

-- Permissions

ALTER TABLE hisab.incomes OWNER TO avnadmin;
GRANT ALL ON TABLE hisab.incomes TO avnadmin;


-- hisab.incomes foreign keys

ALTER TABLE hisab.incomes ADD CONSTRAINT "incomes_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES hisab."bankAccounts"(id) ON DELETE SET NULL;
ALTER TABLE hisab.incomes ADD CONSTRAINT "incomes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES hisab."incomeCategories"(id) ON DELETE SET NULL;
ALTER TABLE hisab.incomes ADD CONSTRAINT "incomes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES hisab.companies(id) ON DELETE CASCADE;
ALTER TABLE hisab.incomes ADD CONSTRAINT "incomes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES hisab.users(id) ON DELETE SET NULL;