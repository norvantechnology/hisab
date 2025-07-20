-- hisab.companies definition

-- Drop table

-- DROP TABLE hisab.companies;

CREATE TABLE hisab.companies (
	id serial4 NOT NULL,
	"userId" int4 NOT NULL,
	gstin text NULL,
	"name" text NOT NULL,
	country text NULL,
	currency text NULL,
	address1 text NULL,
	address2 text NULL,
	city text NULL,
	pincode text NULL,
	state text NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT companies_pkey PRIMARY KEY (id)
);

-- Permissions

ALTER TABLE hisab.companies OWNER TO avnadmin;
GRANT ALL ON TABLE hisab.companies TO avnadmin;


-- hisab.companies foreign keys

ALTER TABLE hisab.companies ADD CONSTRAINT "companies_userId_fkey" FOREIGN KEY ("userId") REFERENCES hisab.users(id) ON DELETE CASCADE;