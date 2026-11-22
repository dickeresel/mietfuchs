CREATE TABLE `unit_area_changes` (
	`unit_id` text NOT NULL,
	`from` text NOT NULL,
	`area_m2` real NOT NULL,
	PRIMARY KEY(`unit_id`, `from`),
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "unit_area_changes_area_not_negative" CHECK("area_m2" >= 0),
	CONSTRAINT "unit_area_changes_from_valid" CHECK("from" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
