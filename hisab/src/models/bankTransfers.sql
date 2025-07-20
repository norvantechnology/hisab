-- hisab."bankTransfers" definition

-- Drop table

-- DROP TABLE hisab."bankTransfers";

CREATE TABLE hisab."bankTransfers" (
	id serial4 NOT NULL,
	"transferNumber" text NOT NULL,
	"companyId" int4 NOT NULL,
	"fromBankId" int4 NOT NULL,
	"toBankId" int4 NOT NULL,
	"date" date DEFAULT CURRENT_DATE NOT NULL,
	amount numeric(15, 2) NOT NULL,
	description text NULL,
	"referenceNumber" text NULL,
	"createdBy" int4 NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"deletedAt" timestamp NULL,
	CONSTRAINT "bankTransfers_pkey" PRIMARY KEY (id)
);

-- Permissions

ALTER TABLE hisab."bankTransfers" OWNER TO avnadmin;
GRANT ALL ON TABLE hisab."bankTransfers" TO avnadmin;


-- hisab."bankTransfers" foreign keys

ALTER TABLE hisab."bankTransfers" ADD CONSTRAINT "bankTransfers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES hisab.companies(id) ON DELETE CASCADE;
ALTER TABLE hisab."bankTransfers" ADD CONSTRAINT "bankTransfers_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES hisab.users(id) ON DELETE SET NULL;
ALTER TABLE hisab."bankTransfers" ADD CONSTRAINT "bankTransfers_fromBankId_fkey" FOREIGN KEY ("fromBankId") REFERENCES hisab."bankAccounts"(id) ON DELETE RESTRICT;
ALTER TABLE hisab."bankTransfers" ADD CONSTRAINT "bankTransfers_toBankId_fkey" FOREIGN KEY ("toBankId") REFERENCES hisab."bankAccounts"(id) ON DELETE RESTRICT;