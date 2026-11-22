PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cost_types` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`period` text NOT NULL,
	`name` text NOT NULL,
	`base_category` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`utility` text,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cost_types_name_valid" CHECK(length(trim("name")) BETWEEN 1 AND 80 AND "name" = trim("name")),
	CONSTRAINT "cost_types_utility_known" CHECK("utility" IN ('strom', 'heizung', 'wasser'))
);
--> statement-breakpoint
INSERT INTO `__new_cost_types`("id", "property_id", "period", "name", "base_category", "position", "utility") SELECT "id", "property_id", "period", "name", "base_category", "position", "utility" FROM `cost_types`;--> statement-breakpoint
DROP TABLE `cost_types`;--> statement-breakpoint
ALTER TABLE `__new_cost_types` RENAME TO `cost_types`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `cost_types_property_period_name_idx` ON `cost_types` (`property_id`,`period`,`name`);