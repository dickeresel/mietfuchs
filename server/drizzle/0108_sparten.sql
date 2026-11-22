CREATE TABLE `tenancy_utility_prepayments` (
	`tenancy_id` text NOT NULL,
	`kind` text NOT NULL,
	`from` text NOT NULL,
	`monthly_cents` integer NOT NULL,
	PRIMARY KEY(`tenancy_id`, `kind`, `from`),
	FOREIGN KEY (`tenancy_id`) REFERENCES `tenancies`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tenancy_utility_prepayments_not_negative" CHECK("monthly_cents" >= 0),
	CONSTRAINT "tenancy_utility_prepayments_kind_known" CHECK("kind" IN ('strom', 'heizung', 'wasser'))
);
--> statement-breakpoint
ALTER TABLE `cost_types` ADD `utility` text;