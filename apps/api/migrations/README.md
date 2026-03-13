# Database Migrations

When deploying to **Railway** (or any production environment), TypeORM `synchronize` is disabled for safety. Schema changes must be applied manually.

## Run migration on Railway

1. Open [Railway Dashboard](https://railway.app) → your project
2. Click your **PostgreSQL** service
3. Go to **Data** or **Query** tab
4. Copy the contents of `001-add-consultation-fee-and-sale-columns.sql`
5. Paste and run the SQL

After running, redeploy the API (or it will auto-restart on the next push).
