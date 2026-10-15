# Data folder

Local runs keep `mavri.db` (SQLite), its `-wal` and `-shm` files and `secret.key` here. Contents are ignored by git. In Docker the same files live in the `/data` volume. Back this folder up.
