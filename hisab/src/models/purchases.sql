-- hisab.purchases definition

-- Drop table

-- DROP TABLE hisab.purchases;

CREATE TABLE hisab.purchases (
	id serial4 NOT NULL,
	"companyId" int4 NOT NULL,
	"userId" int4 NOT NULL,
	"bankAccountId" int4 NULL,
	"contactId" int4 NULL,
	"invoiceNumber" text NOT NULL,
	"invoiceDate" date NOT NULL,
	"taxType" text NULL,
	"discountType" text NULL,
	"discountValue" numeric(10, 2) DEFAULT 0 NULL,
	"roundOff" numeric(10, 2) DEFAULT 0 NULL,
	"internalNotes" text NULL,
	"basicAmount" numeric(15, 2) DEFAULT 0 NULL,
	"totalDiscount" numeric(15, 2) DEFAULT 0 NULL,
	"taxAmount" numeric(15, 2) DEFAULT 0 NULL,
	"netPayable" numeric(15, 2) DEFAULT 0 NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"deletedAt" timestamp NULL,
	status text DEFAULT 'pending'::text NULL,
	remaining_amount numeric(15, 2) DEFAULT 0.00 NULL,
	paid_amount numeric(15, 2) DEFAULT 0.00 NULL,
	"deletedBy" int4 NULL,
	"pdfUrl" text NULL,
	CONSTRAINT purchases_check CHECK (((("bankAccountId" IS NOT NULL) AND ("contactId" IS NULL)) OR (("bankAccountId" IS NULL) AND ("contactId" IS NOT NULL)) OR (("bankAccountId" IS NOT NULL) AND ("contactId" IS NOT NULL)))),
	CONSTRAINT purchases_pkey PRIMARY KEY (id),
	CONSTRAINT purchases_status_check CHECK ((status = ANY (ARRAY['paid'::text, 'pending'::text])))
);

-- Permissions

ALTER TABLE hisab.purchases OWNER TO avnadmin;
GRANT ALL ON TABLE hisab.purchases TO avnadmin;


-- hisab.purchases foreign keys

ALTER TABLE hisab.purchases ADD CONSTRAINT "purchases_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES hisab."bankAccounts"(id) ON DELETE SET NULL;
ALTER TABLE hisab.purchases ADD CONSTRAINT "purchases_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES hisab.companies(id) ON DELETE CASCADE;
ALTER TABLE hisab.purchases ADD CONSTRAINT "purchases_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES hisab.contacts(id) ON DELETE SET NULL;
ALTER TABLE hisab.purchases ADD CONSTRAINT "purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES hisab.users(id) ON DELETE SET NULL;