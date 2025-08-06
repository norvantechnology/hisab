-- hisab.payments definition

-- Drop table

-- DROP TABLE hisab.payments;

CREATE TABLE hisab.payments (
	id serial4 NOT NULL,
	"paymentNumber" text NOT NULL,
	"companyId" int4 NOT NULL,
	"contactId" int4 NOT NULL,
	"bankId" int4 NULL,
	"date" date DEFAULT CURRENT_DATE NOT NULL,
	amount numeric(15, 2) NOT NULL,
	"paymentType" text NOT NULL,
	discounts jsonb NULL,
	notes text NULL,
	"createdBy" int4 NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"deletedAt" timestamp NULL,
	description text NULL,
	"adjustmentType" text DEFAULT 'none'::text NULL,
	"adjustmentValue" numeric(15, 2) NULL,
	"openingBalancePayment" numeric(15, 2) DEFAULT 0.00 NULL,
	"deletedBy" int4 NULL,
	"pdfUrl" text NULL, -- S3 URL of the generated payment PDF invoice
	"pdfGeneratedAt" timestamp NULL, -- Timestamp when the PDF was last generated
	CONSTRAINT "payments_adjustmentType_check" CHECK (("adjustmentType" = ANY (ARRAY['none'::text, 'discount'::text, 'extra_receipt'::text, 'surcharge'::text]))),
	CONSTRAINT "payments_paymentType_check" CHECK (("paymentType" = ANY (ARRAY['payment'::text, 'receipt'::text]))),
	CONSTRAINT payments_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_payments_pdf_generated_at ON hisab.payments USING btree ("pdfGeneratedAt") WHERE ("pdfGeneratedAt" IS NOT NULL);
CREATE INDEX idx_payments_pdf_url ON hisab.payments USING btree ("pdfUrl") WHERE ("pdfUrl" IS NOT NULL);

-- Column comments

COMMENT ON COLUMN hisab.payments."pdfUrl" IS 'S3 URL of the generated payment PDF invoice';
COMMENT ON COLUMN hisab.payments."pdfGeneratedAt" IS 'Timestamp when the PDF was last generated';

-- Permissions

ALTER TABLE hisab.payments OWNER TO avnadmin;
GRANT ALL ON TABLE hisab.payments TO avnadmin;


-- hisab.payments foreign keys

ALTER TABLE hisab.payments ADD CONSTRAINT "payments_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES hisab."bankAccounts"(id) ON DELETE SET NULL;
ALTER TABLE hisab.payments ADD CONSTRAINT "payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES hisab.companies(id) ON DELETE CASCADE;
ALTER TABLE hisab.payments ADD CONSTRAINT "payments_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES hisab.contacts(id) ON DELETE RESTRICT;
ALTER TABLE hisab.payments ADD CONSTRAINT "payments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES hisab.users(id) ON DELETE SET NULL;