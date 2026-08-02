# ShopDesk — Insurance + PUC

Simple shop software for vehicle insurance and PUC.

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
