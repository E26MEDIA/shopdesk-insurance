# Deploy E26 Admin to Vercel (no Node.js on your PC)

Use this guide to put the admin panel online at **https://insurance.e26media.com**.  
You only need a browser — **no Node.js on your Windows PC**.

Database is already on **Neon** (done). You only deploy the website.

---

## Part 1 — Vercel account (5 minutes)

1. Open **https://vercel.com**
2. Click **Sign Up** → **Continue with GitHub**
3. Authorize Vercel to access GitHub
4. Use the free **Hobby** plan

---

## Part 2 — Import the project

1. In Vercel dashboard → **Add New…** → **Project**
2. Find repo: **`E26MEDIA/shopdesk-insurance`** (or your fork)
3. **Important — before Deploy**, click **Edit** next to Root Directory:
   - Set Root Directory to: **`admin`**
4. Framework Preset: **Next.js** (auto-detected)
5. **Do not deploy yet** — add environment variables first (Part 3)

---

## Part 3 — Environment variables

In Vercel → Project → **Settings** → **Environment Variables**

Add each of these (copy from your `admin/.env` or Neon console):

| Name | Value |
|------|--------|
| `DATABASE_URL` | Your Neon connection string (from Copy snippet) |
| `AUTH_SECRET` | Any long random string (32+ characters) |
| `LICENSE_SIGNING_PRIVATE_KEY` | From seed output (keep secret) |
| `LICENSE_SIGNING_PUBLIC_KEY` | From seed output |
| `NEXT_PUBLIC_APP_URL` | `https://insurance.e26media.com` |
| `SEED_ADMIN_EMAIL` | `admin@e26media.com` (optional) |
| `SEED_ADMIN_PASSWORD` | Your chosen password (optional) |

**Private key format in Vercel:** paste the full value including quotes, or paste PEM with real newlines.

Apply to: **Production**, **Preview**, **Development**

---

## Part 4 — Deploy

1. Click **Deploy**
2. Wait 2–5 minutes
3. Vercel gives a URL like: `https://shopdesk-insurance-xxx.vercel.app`
4. Test login on that URL first

**Health check:**  
`https://your-app.vercel.app/api/health` → `{"status":"ok"}`

**Login:**  
`admin@e26media.com` / `ChangeMeNow!123` (or your seed password)

---

## Part 5 — Custom domain `insurance.e26media.com`

### In Vercel

1. Project → **Settings** → **Domains**
2. Add: **`insurance.e26media.com`**
3. Vercel shows DNS instructions (usually a **CNAME**)

### In your domain DNS (where e26media.com is managed)

Add record:

| Type | Name | Value |
|------|------|--------|
| **CNAME** | `insurance` | `cname.vercel-dns.com` |

*(Use the exact value Vercel shows — it may differ slightly.)*

Wait 5–30 minutes for DNS. Vercel will issue **HTTPS** automatically.

---

## Part 6 — Update desktop app (later)

When building ShopDesk for customers, set:

```
E26_LICENSE_API_URL=https://insurance.e26media.com/api/v1
```

Rebuild installer: `npm run desktop:dist`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails on Prisma | Ensure Root Directory = `admin` |
| Login works on Vercel URL but not custom domain | Wait for DNS; check CNAME |
| Database error | Check `DATABASE_URL` in Vercel env vars |
| 500 on login | Verify `AUTH_SECRET` and signing keys are set |

---

## What you do NOT need

- ❌ Node.js on your PC (only Vercel builds in the cloud)
- ❌ `npm run dev` on localhost
- ❌ `db:push` again (database already set up on Neon)

---

## Quick checklist

- [ ] Vercel account + GitHub connected
- [ ] Import repo, Root Directory = `admin`
- [ ] All env vars added
- [ ] Deploy succeeded
- [ ] Login works on `.vercel.app` URL
- [ ] Domain `insurance.e26media.com` added
- [ ] DNS CNAME set
- [ ] HTTPS green lock in browser

---

Need help? Send a screenshot of Vercel deploy logs or the Domains page.
