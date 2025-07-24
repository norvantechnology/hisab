-- hisab.contacts definition

-- Drop table

-- DROP TABLE hisab.contacts;

CREATE TABLE hisab.contacts (
	id serial4 NOT NULL,
	"companyId" int4 NOT NULL,
	gstin text NULL,
	"name" text NOT NULL,
	mobile text NULL,
	email text NULL,
	"dueDays" int4 NULL,
	currency text DEFAULT 'INR'::text NULL,
	"contactType" text DEFAULT 'customer'::text NOT NULL,
	"billingAddress1" text NULL,
	"billingAddress2" text NULL,
	"billingCity" text NULL,
	"billingPincode" text NULL,
	"billingState" text NULL,
	"billingCountry" text DEFAULT 'India'::text NULL,
	"shippingAddress1" text NULL,
	"shippingAddress2" text NULL,
	"shippingCity" text NULL,
	"shippingPincode" text NULL,
	"shippingState" text NULL,
	"shippingCountry" text DEFAULT 'India'::text NULL,
	"isShippingSame" bool DEFAULT false NULL,
	"openingBalance" numeric(15, 2) DEFAULT 0.00 NULL,
	"openingBalanceType" text DEFAULT 'payable'::text NULL,
	"enablePortal" bool DEFAULT false NULL,
	notes text NULL,
	"createdBy" int4 NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"currentBalance" numeric(15, 2) DEFAULT 0.00 NULL,
	"currentBalanceType" text DEFAULT 'payable'::text NULL,
	"deletedAt" timestamp NULL,
	CONSTRAINT "contacts_balanceType_check" CHECK (("openingBalanceType" = ANY (ARRAY['payable'::text, 'receivable'::text]))),
	CONSTRAINT "contacts_contactType_check" CHECK (("contactType" = ANY (ARRAY['customer'::text, 'vendor'::text]))),
	CONSTRAINT contacts_pkey PRIMARY KEY (id)
);

-- Permissions

ALTER TABLE hisab.contacts OWNER TO avnadmin;
GRANT ALL ON TABLE hisab.contacts TO avnadmin;


-- hisab.contacts foreign keys

ALTER TABLE hisab.contacts ADD CONSTRAINT "contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES hisab.companies(id) ON DELETE CASCADE;
ALTER TABLE hisab.contacts ADD CONSTRAINT "contacts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES hisab.users(id) ON DELETE SET NULL;