Schema changes made after the baseline go here, one `.sql` file each, named
`YYYYMMDD-NN-description.sql` (the same pattern as the original TypeScript
migrations). They run once, in name order, in a single transaction with foreign
keys off, and are recorded in the `migrations` table.
