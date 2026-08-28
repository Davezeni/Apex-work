-- Allow OAuth-created accounts to exist before phone verification.
-- Phone remains unique when present; PostgreSQL permits multiple NULL values
-- in a unique column, while phone-signup accounts still provide a value.
ALTER TABLE "User" ALTER COLUMN "phone" DROP NOT NULL;
