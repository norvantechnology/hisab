-- hisab.expenses definition

-- Drop table

-- DROP TABLE hisab.expenses;

CREATE TABLE hisab.expenses (
	id serial4 NOT NULL,
	"userId" int4 NOT NULL,
	"companyId" int4 NOT NULL,
	"date" date DEFAULT CURRENT_DATE NOT NULL,
	"categoryId" int4 NULL,
	"bankAccountId" int4 NULL,
	amount numeric(15, 2) NOT NULL,
	notes text NULL,
	"createdBy" int4 NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT expenses_pkey PRIMARY KEY (id)
);

-- Permissions

ALTER TABLE hisab.expenses OWNER TO avnadmin;
GRANT ALL ON TABLE hisab.expenses TO avnadmin;


-- hisab.expenses foreign keys

ALTER TABLE hisab.expenses ADD CONSTRAINT "expenses_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES hisab."bankAccounts"(id) ON DELETE SET NULL;
ALTER TABLE hisab.expenses ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES hisab."expenseCategories"(id) ON DELETE SET NULL;
ALTER TABLE hisab.expenses ADD CONSTRAINT "expenses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES hisab.companies(id) ON DELETE CASCADE;
ALTER TABLE hisab.expenses ADD CONSTRAINT "expenses_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES hisab.users(id) ON DELETE SET NULL;
ALTER TABLE hisab.expenses ADD CONSTRAINT "expenses_userId_fkey" FOREIGN KEY ("userId") REFERENCES hisab.users(id) ON DELETE CASCADE;