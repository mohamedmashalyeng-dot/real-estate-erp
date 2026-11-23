# Facebook Lead Ads on the deployed ERP

The Hostinger application for `https://erp.orvann.com` deploys from
`mohamedmashalyeng-dot/real-estate-erp`, branch `master`. The separate `west_erp`
repository is not the source of this deployment. Keep the existing Hostinger
repository, MySQL connection, authentication configuration, webpack build and
single build worker.

## Deployment

1. Back up the hosted database using the hosting controls.
2. Merge this change into this repository's `master` and deploy that commit.
3. Keep the build command as `npm run build`. It generates Prisma and compiles
   without requiring database credentials at build time.
4. Start using `npm start`. Its `prestart` hook runs `prisma migrate deploy`
   against the runtime `DATABASE_URL` before starting Next.js. The existing
   MySQL migration history is retained. The new migration only adds four
   nullable Facebook settings columns and a unique Page index; it does not
   recreate existing tables or alter leads, prices, collections, or reports.
   If the host overrides the start command and invokes Next directly, run
   `npm run db:deploy` as a release step before starting the new app instead.
5. Configure these server environment variables in Hostinger, then redeploy:

   ```text
   APP_URL=https://erp.orvann.com
   FACEBOOK_APP_SECRET=<Meta app secret>
   FACEBOOK_WEBHOOK_VERIFY_TOKEN=<random verify token>
   FACEBOOK_TOKEN_ENCRYPTION_KEY=<separate 64-character hex key>
   FACEBOOK_GRAPH_API_VERSION=v27.0
   ```

   `.env.local` is ignored by Git and is not uploaded to Hostinger. Keep the
   encryption key stable: existing saved tokens need it to decrypt.

If migration deployment fails because the existing database has tables but no
recorded initial migration, stop and inspect its schema/migration history.
Do not reset it, run `db push --accept-data-loss`, or mark the initial migration
as applied without verifying that the existing schema matches it. A migration
failure prevents the new process from starting rather than resetting data.

### Hostinger starts Next.js directly: missing Facebook columns

If runtime logs say that `OrganizationSettings.facebookPageAccessToken` does
not exist, the code was deployed without the schema migration. Some managed
deployments start Next.js directly and do not run npm's `prestart` lifecycle.

The preferred release step is `npm run db:deploy` with the hosted application's
runtime environment. If a terminal/release command is unavailable, back up the
ERP database, select that existing database in phpMyAdmin, and import
[`sql/repair-facebook-leads.sql`](./sql/repair-facebook-leads.sql). This portable
MySQL/MariaDB script adds only missing Facebook columns and the Page index. It
can be imported again without overwriting records or saved credentials.

This fallback deliberately does not invent or rewrite Prisma migration history.
After the SQL repair, if the original initial migration is already recorded,
reconcile the applied Facebook migration from the application server with
`npx prisma migrate resolve --applied 20261123170000_facebook_leads` before using
`npm run db:deploy` again. If the initial migration is unrecorded, inspect the
actual schema before baselining it. Do not reset the database. A manual SQL
repair alone does not require rebuilding the app.

## Meta and ERP connection

1. In the Meta app, configure a **Page** webhook with callback
   `https://erp.orvann.com/api/webhooks/facebook` and the same verify token
   configured on Hostinger. Subscribe to **leadgen**. A bare request to that
   URL should return 403 when configured, or 503 when the verify token is
   missing. A correct verification request returns its `hub.challenge` with
   status 200. A 404 means the route is not deployed/routed to this app.
2. Obtain a Page access token with access to the Page's leads and the permissions
   required by Meta for retrieval and webhook subscription, including
   `leads_retrieval` and `pages_manage_metadata`. Check Leads Access Manager and
   the applicable app review requirements.
3. Open ERP **Settings > Facebook Lead Ads**. For **West Development Ngg**, use
   Page ID `1199396266586272` and its Page token. Do not use a user token or
   another Page's token. The connection checks the token identity and form
   access, subscribes the app to Page leadgen events, and stores an encrypted
   token bound to the current organization.
4. Open **CRM & Leads > Sync Facebook** to import available historical
   submissions. Repeated syncs and webhook retries do not duplicate submissions
   or overwrite existing sales notes, stages or assignments.
5. Create a submission with Meta's Lead Ads Testing Tool and verify that it
   appears in this organization's CRM with source Facebook, contact details,
   question answers in notes and an import activity. New records appear on the
   next CRM page refresh; this does not add live browser push updates.

The endpoint verifies the signature over the raw request body before processing
notifications and acknowledges only after database writes finish. Unknown Pages
and unrelated events are ignored; failed retrievals return a retryable 500.
Keep tokens and secrets out of shared screenshots, logs and Git.

## References

- [Meta: retrieve Lead Ads submissions](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/)
- [Meta: leadgen webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/)
- [Meta: Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing/)
