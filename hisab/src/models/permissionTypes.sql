-- hisab."permissionTypes" definition

-- Drop table

-- DROP TABLE hisab."permissionTypes";

CREATE TABLE hisab."permissionTypes" (
	id serial4 NOT NULL,
	"name" varchar(50) NOT NULL,
	description text NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT "permissionTypes_pkey" PRIMARY KEY (id)
);

-- Permissions

ALTER TABLE hisab."permissionTypes" OWNER TO avnadmin;
GRANT ALL ON TABLE hisab."permissionTypes" TO avnadmin;