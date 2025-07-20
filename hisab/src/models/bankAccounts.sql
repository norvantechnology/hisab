CREATE TABLE hisab."bankAccounts" (
	id serial4 NOT NULL,
	"userId" int4 NOT NULL,
	"companyId" int4 NOT NULL,
	"accountType" text NOT NULL,
	"accountName" text NOT NULL,
	"currentBalance" numeric(15, 2) DEFAULT 0 NOT NULL,
	"openingBalance" numeric(15, 2) DEFAULT 0 NOT NULL,
	"isActive" bool DEFAULT true NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"deletedAt" timestamp NULL,
	CONSTRAINT "bankAccounts_accountType_check" CHECK (("accountType" = ANY (ARRAY['cash'::text, 'bank'::text, 'credit_card'::text, 'wallet'::text]))),
	CONSTRAINT "bankAccounts_pkey" PRIMARY KEY (id)
);

-- Permissions

ALTER TABLE hisab."bankAccounts" OWNER TO avnadmin;
GRANT ALL ON TABLE hisab."bankAccounts" TO avnadmin;


-- hisab."bankAccounts" foreign keys

ALTER TABLE hisab."bankAccounts" ADD CONSTRAINT "bankAccounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES hisab.companies(id) ON DELETE CASCADE;
ALTER TABLE hisab."bankAccounts" ADD CONSTRAINT "bankAccounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES hisab.users(id) ON DELETE CASCADE;