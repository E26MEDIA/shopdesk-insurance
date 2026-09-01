# ShopDesk — Insurance + PUC (E26 Insurance Desk)

Simple shop software for vehicle insurance and PUC.

## E26 Licensing (new)

This repo now includes:

- **Desktop app** (existing) — offline-first, local data on PC / `E:\insurance desk`
- **Admin panel** (`admin/`) — deploy to `https://insurance.e26media.com` for shops, licenses, devices

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for full setup.

Quick admin dev:

```bash
cd admin && cp .env.example .env
# Set DATABASE_URL, then:
npm install && npm run db:push && npm run db:seed && npm run dev
```

Open http://localhost:3001

## Online (browser)

```bash
npm install
npm run dev
```

Open http://localhost:3000 (or the port shown).  
Hosted demo: https://shopdesk-insurance.vercel.app

## Offline desktop (no internet)

Runs as a desktop app. Data + documents are saved **on this PC**.

```bash
npm install
npm run desktop
```

That opens the ShopDesk window. Look for **Offline desktop** in the header.  
Use **Data folder** to open where files are stored.

### Build installers (Mac / Windows)

```bash
npm run desktop:dist
```

Installers appear in `dist-desktop/`.

### Important

- Offline app = **this computer only** (another PC will not see the same files unless you copy the data folder).
- For multi-PC shared files, use cloud (Firebase) instead.
