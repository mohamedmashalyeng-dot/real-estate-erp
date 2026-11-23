# Security changes and deployment

## Configuration required before deploying

Keep the application's existing random `AUTH_SECRET` if it is at least 32
characters. A missing, short, known development secret or example placeholder
is now rejected in production, at request time. Builds still do not require
runtime secrets. Generate a secret locally if needed with:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Store it in Hostinger's application environment, not Git or chat. Changing an
existing auth secret signs out existing sessions. Keep `APP_URL` set to the
actual HTTPS domain; it controls secure cookies and the allowed sign-in
redirect origin. Keep the existing database and Facebook settings.

No database schema change is required for this UI/security release. Sign-in
throttling uses the existing indexed AuditLog table. The earlier Facebook
column repair is a separate deployment step described in facebook-leads.md.

## Controls implemented

- Eight sign-in attempts per normalized account in 15 minutes, persisted in
  MySQL. Serializable transactions and deadlock retries enforce the limit
  across concurrent workers. All attempts count, including successful ones;
  a restart does not clear the window. Identifiers are HMAC hashes, not raw
  email addresses. Unknown users still incur password comparison work.
- Only ACTIVE users may sign in. Membership roles must belong to the same
  organization. Protected requests still recheck current user/membership data.
- Tenant update/updateMany/upsert paths reject organization reassignment,
  including nested organization writes. Dashboard metrics are queried only
  when the member has their corresponding permissions.
- Random per-request CSP nonces protect page scripts. The theme bootstrap and
  Next.js scripts receive the nonce. Framing, plugins and base URL overrides
  are denied. Inline styles remain allowed for Radix and data charts; inline
  scripts and eval remain disallowed in production. Pages are dynamically
  rendered and marked private/no-store. API routes keep their own auth rules.
- Secure cookies for the configured HTTPS site, allowed-origin sign-in
  redirects, nosniff, framing/referrer/permissions headers and HSTS.
- Actual streamed body limits: 32 KiB for auth POSTs and 256 KiB for Facebook
  webhooks. Chunked bodies cannot bypass the limits. JSON content type,
  batch/ID limits and an HMAC over the original bytes are enforced before
  processing Facebook deliveries. Webhook retries remain idempotent.
- Raw internal error details are not returned by server actions. Audit
  redaction handles camelCase secret keys and nested arrays; error logs avoid
  request bodies, tokens and connection-string messages.
- Report CSV export quotes and prefixes formula-like text with a tab while
  preserving ordinary numeric financial values. Exported text has a protective
  prefix; downstream import tools should account for it. Spreadsheet programs
  differ, so this is not a guarantee for every save/reopen workflow.

## Secrets already shared outside secure storage

The database password, Meta app secret, Page access tokens, webhook verification
token and Page-token encryption key appeared in the support conversation.
Replace exposed credentials in their issuing services and update Hostinger's
environment. This has not been done automatically: the hosting and Meta
administration tools are not connected, and silently replacing encryption keys
would break the existing Page connection.

When changing `FACEBOOK_TOKEN_ENCRYPTION_KEY`, keep a secure backup of the old
key until recovery is complete, then reconnect the Page with a fresh Page token
in ERP Settings. A new token submitted explicitly is encrypted using the new
key. Update the Meta webhook verify token to match the new hosting value, and
keep the Meta app secret on Hostinger in sync with Meta. Never publish secrets
or database exports in Git. Use Sync Facebook after reconnecting to recover
available submissions missed while reconfiguring.

## Operational boundaries

The login window is per account, not a substitute for hosting-level traffic
limits. Configure Hostinger/CDN rate limits for broad floods, keep backups and
dependencies current, and monitor application errors. LoginGuard audit rows
are retained for auditability; the operational retention policy should archive
or prune old records, keeping at least the active 15-minute window.

Validation passed: 68 automated tests, TypeScript, ESLint and a production
build. Local production-browser checks covered desktop/mobile sign-in,
navigation, theme switching, Facebook connection controls, nonce headers,
reduced motion and horizontal overflow without hydration or CSP errors.
This does not certify the hosting infrastructure or replace a penetration test.

## References

- Next.js security and CSP guides shipped with the installed framework in
  `node_modules/next/dist/docs/01-app/02-guides/`.
- [OWASP CSV injection guidance](https://github.com/OWASP/www-community/blob/master/pages/attacks/CSV_Injection.md)
