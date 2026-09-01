# Insurance Desk — Customer Website

Public marketing website for **Insurance Desk by E26**. Separate Next.js app — does not affect the desktop app or admin panel.

## Development

```bash
cd website
npm install
npm run dev
```

Open [http://localhost:3002](http://localhost:3002).

## Environment variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_INSURANCE_DESK_DOWNLOAD_URL` | Direct URL to the Windows `.exe` installer |
| `NEXT_PUBLIC_INSURANCE_DESK_VERSION` | Display version (default `0.1.0`) |
| `NEXT_PUBLIC_DOWNLOAD_API_URL` | Optional fallback — fetches download URL from admin API |
| `NEXT_PUBLIC_GOOGLE_FORM_ACTION_URL` | Google Form `formResponse` URL |
| `NEXT_PUBLIC_GOOGLE_FORM_ENTRY_*` | Google Form field entry IDs |

### Google Form setup

1. Create a Google Form with the required fields.
2. Open form → ⋮ → Get pre-filled link → fill sample values → copy URL.
3. Extract entry IDs from the URL (`entry.123456789`).
4. Set `NEXT_PUBLIC_GOOGLE_FORM_ACTION_URL` to `https://docs.google.com/forms/d/e/FORM_ID/formResponse`.

### Download setup

Either set `NEXT_PUBLIC_INSURANCE_DESK_DOWNLOAD_URL` to a public file URL (e.g. Google Drive direct link), or set `NEXT_PUBLIC_DOWNLOAD_API_URL` to the admin panel download API:

```
NEXT_PUBLIC_DOWNLOAD_API_URL=https://shopdesk-insurance-phi.vercel.app/api/v1/download
```

## Deploy (Vercel)

1. Import the repo on Vercel.
2. Set **Root Directory** to `website`.
3. Add environment variables from `.env.example`.
4. Deploy.

Suggested domain: `insurance.e26media.com`

## Build

```bash
npm run build
npm run start
```
