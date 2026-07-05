# Tenanto — Post-Reset Checklist

## Database

- [ ] Create PostgreSQL database: `tenanto_prod` and user: `tenanto`
- [ ] Update `DB_NAME`, `DB_USER`, `DB_PASSWORD` secrets in GitHub Actions and on production server
- [ ] Run initial migrations on the production database

## Email / SES

- [ ] Register email domain `tenanto.app` in AWS Route 53 (or your DNS provider)
- [ ] Verify domain and set up SES for `noreply@tenanto.app` and `unsubscribe@tenanto.app`
- [ ] Update `FROM_EMAIL` in `apps/server/src/ses/ses.ts` once domain is verified
- [ ] Test OTP and password-reset emails end-to-end

## Product Domain

- [ ] Define new product domain features and add initial feature migrations (v11+)
- [ ] Build out the home page in `apps/web` with real content

## Deployment

- [ ] Update GitHub Actions secrets: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- [ ] Update deploy SSH secrets (`SSH_PRIVATE_KEY`, `PROD_SERVER_USER`, `PROD_SERVER_IP`)
- [ ] Create `/root/tenanto/` directory on production server
- [ ] Copy `.env` files to production server (`apps/server/.env`, `apps/web/.env`, root `.env`)
- [ ] Run `docker compose up -d` on production server for the first time

## Auth / OAuth

- [ ] Update Google OAuth credentials (client IDs) in Google Cloud Console for `tenanto.app` domain
- [ ] Update Apple Sign-In bundle ID from `com.postscrypt.app` to `com.tenanto.app` (or remove if not needed)
- [ ] Update `GOOGLE_IOS_CLIENT_ID` and `GOOGLE_ANDROID_CLIENT_ID` in server `.env`

## Mobile App

- [ ] Decide on mobile app presence — restore `apps/mobile` if Expo is needed
- [ ] Register new App Store app with bundle ID `com.tenanto.app`
- [ ] Register new Play Store app with package ID `com.tenanto.app`
- [ ] Add `APP_STORE_URL` and `PLAY_STORE_URL` constants once registered

## Monitoring / Observability

- [ ] Set up Datadog services with names `tenanto-server` and `tenanto-admin`
- [ ] Update `DATADOG_API_KEY` and related keys in server `.env`
- [ ] Decide on proxy/Datadog RUM setup — restore `apps/proxy` if needed

## Misc

- [ ] Run `bun install` to update `bun.lock` with the new root package name `tenanto`
- [ ] Update `DISCORD_SUPPORT_WEBHOOK_URL` to a new Discord webhook for the tenanto project
- [ ] Review and remove any remaining `postscrypt` or `locklet` references: `rg -i "locklet|postscrypt" --type ts`
