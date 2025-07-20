-- hisab."incomeCategories" definition

-- Drop table

-- DROP TABLE hisab."incomeCategories";

CREATE TABLE hisab."incomeCategories" (
	id serial4 NOT NULL,
	"userId" int4 NOT NULL,
	"name" text NOT NULL,
	"isActive" bool DEFAULT true NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT "incomeCategories_pkey" PRIMARY KEY (id)
);

-- Permissions

ALTER TABLE hisab."incomeCategories" OWNER TO avnadmin;
GRANT ALL ON TABLE hisab."incomeCategories" TO avnadmin;


-- hisab."incomeCategories" foreign keys

ALTER TABLE hisab."incomeCategories" ADD CONSTRAINT "incomeCategories_userId_fkey" FOREIGN KEY ("userId") REFERENCES hisab.users(id) ON DELETE CASCADE;