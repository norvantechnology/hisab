-- hisab."expenseCategories" definition

-- Drop table

-- DROP TABLE hisab."expenseCategories";

CREATE TABLE hisab."expenseCategories" (
	id serial4 NOT NULL,
	"userId" int4 NOT NULL,
	"name" text NOT NULL,
	"isActive" bool DEFAULT true NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT "expenseCategories_pkey" PRIMARY KEY (id)
);

-- Permissions

ALTER TABLE hisab."expenseCategories" OWNER TO avnadmin;
GRANT ALL ON TABLE hisab."expenseCategories" TO avnadmin;


-- hisab."expenseCategories" foreign keys

ALTER TABLE hisab."expenseCategories" ADD CONSTRAINT "expenseCategories_userId_fkey" FOREIGN KEY ("userId") REFERENCES hisab.users(id) ON DELETE CASCADE;