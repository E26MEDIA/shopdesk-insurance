# Deploying E26 Insurance Admin at insurance.e26media.com

## What you need to provide

1. **PostgreSQL database** (Neon, Supabase, Railway, or your own VPS)
2. **Domain DNS** pointing to your host
3. **SSL certificate** (automatic on Vercel/Railway; or Let's Encrypt on VPS)
4. **Environment variables** from `admin/.env.example`

## Step 1 — Database

Create a PostgreSQL database and note the connection string:

```
DATABASE_URL=postgresql://...
```

## Step 2 — Deploy admin panel

From the `admin/` folder:

```bash
cd admin
npm install
cp .env.example .env
# Edit .env with DATABASE_URL, AUTH_SECRET, etc.
npm run db:push
npm run db:seed
```

The seed command prints **Ed25519 signing keys**. Copy both:

- `LICENSE_SIGNING_PRIVATE_KEY` → admin `.env` (server only, never commit)
- `LICENSE_SIGNING_PUBLIC_KEY` → admin `.env` AND desktop build env

Default super admin (change immediately after first login):

- Email: `admin@e26media.com`
- Password: `ChangeMeNow!123`

### Hosting options

**Vercel / Railway / Render**

- Root directory: `admin`
- Build: `npm run build`
- Start: `npm start`
- Add all env vars in dashboard

**VPS (Node)**

```bash
cd admin && npm run build && npm start
# Use PM2 or systemd; put Nginx/Caddy in front with HTTPS
```

## Step 3 — DNS

Create a DNS record for `insurance.e26media.com`:

| Type | Name | Value |
|------|------|-------|
| CNAME | insurance | your-host.example.com |

Or A record to your server IP.

## Step 4 — HTTPS

Enable HTTPS on your host. Set secure cookies (automatic when `NODE_ENV=production`).

## Step 5 — Desktop app

When building ShopDesk for customers, set (see `desktop.env.example`):

```
E26_LICENSE_API_URL=https://insurance.e26media.com/api/v1
LICENSE_SIGNING_PUBLIC_KEY=<public key from seed>
```

Rebuild installer:

```bash
npm install
npm run desktop:dist
```

Distribute `dist-desktop/ShopDesk-Setup-0.1.0.exe` to customers.

## Step 6 — Business workflow

1. Log in to https://insurance.e26media.com
2. Create **Shop**
3. Create **License** (choose edition, devices, validity)
4. Copy license key — shown once
5. Send installer + license key to customer
6. Customer installs, enters the verification key in the installer, and activates on first launch

## Step 7 — Device replacement

1. Admin → **Devices** → **Deactivate** old PC
2. Customer activates on new PC with same license key

## Health check

```
GET https://insurance.e26media.com/api/health
→ { "status": "ok" }
```

## Backups

- Enable daily PostgreSQL backups on your provider
- Customer business data stays on their PC — back up `E:\insurance desk` and AppData separately

## Security checklist

- [ ] Change default admin password
- [ ] Never commit `.env` or private signing key
- [ ] Use strong `AUTH_SECRET`
- [ ] HTTPS only in production
- [ ] Restrict admin panel access (VPN or IP allowlist optional)
