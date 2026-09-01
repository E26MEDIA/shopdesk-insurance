# Run Insurance Desk website + admin locally

Everything is in **one app** under the `admin/` folder.

## On your Windows PC

1. Open the project folder in terminal (where you extracted the repo).
2. Go to admin:

```bash
cd admin
npm install
```

3. Copy environment file:

```bash
copy .env.example .env
```

4. Set at minimum `DATABASE_URL` (Neon PostgreSQL) in `.env`.
   For a quick UI preview only, you can skip DB — but admin login and download API need the database.

5. Start the server:

```bash
npm run dev
```

6. Open in your browser:

| URL | What |
|-----|------|
| **http://localhost:3001** | Customer website (home page) |
| **http://localhost:3001/download** | Download .exe page |
| **http://localhost:3001/admin/login** | Admin login (create shops) |
| **http://localhost:3001/admin/dashboard** | Admin dashboard |

## Production domain

Deploy the `admin/` folder to Vercel with root directory `admin`.

Point **insurance.e26media.com** to that Vercel project.

| URL | What |
|-----|------|
| `https://insurance.e26media.com/` | Customer website |
| `https://insurance.e26media.com/download` | Download page |
| `https://insurance.e26media.com/admin/login` | Admin panel |
| `https://insurance.e26media.com/api/v1/*` | Desktop app licensing API |

## Google Form

Add Google Form env vars to `admin/.env` — see `.env.example`.

## Download .exe

1. Build `.exe` on Windows: `npm run desktop:dist:win` (from project root)
2. Upload to Google Drive
3. In admin → **Download** (`/admin/software`), paste the direct link
4. Customers download from `/download` or the homepage download section
