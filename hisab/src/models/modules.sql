-- hisab.modules definition

-- Drop table

-- DROP TABLE hisab.modules;

CREATE TABLE hisab.modules (
	id serial4 NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"deletedAt" timestamp NULL,
	CONSTRAINT modules_name_key UNIQUE (name),
	CONSTRAINT modules_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_modules_name ON hisab.modules USING btree (name);

-- Permissions

ALTER TABLE hisab.modules OWNER TO avnadmin;
GRANT ALL ON TABLE hisab.modules TO avnadmin;