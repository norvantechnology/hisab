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
	CONSTRAINT incomes_pkey PRIMARY KEY (id)
);

-- Permissions

ALTER TABLE hisab.incomes OWNER TO avnadmin;
GRANT ALL ON TABLE hisab.incomes TO avnadmin;


-- hisab.incomes foreign keys

ALTER TABLE hisab.incomes ADD CONSTRAINT "incomes_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES hisab."bankAccounts"(id) ON DELETE SET NULL;
ALTER TABLE hisab.incomes ADD CONSTRAINT "incomes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES hisab."incomeCategories"(id) ON DELETE SET NULL;
ALTER TABLE hisab.incomes ADD CONSTRAINT "incomes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES hisab.companies(id) ON DELETE CASCADE;
ALTER TABLE hisab.incomes ADD CONSTRAINT "incomes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES hisab.users(id) ON DELETE SET NULL;