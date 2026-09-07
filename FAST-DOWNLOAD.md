# Fast download setup (replace slow Google Drive)

Google Drive is **slow** for large `.exe` files (~200 MB). Use one of these instead.

---

## Best option: Vercel Blob (fast, same as your website)

### One-time setup (~5 min)

1. Open **Vercel** → your project → **Storage** → **Create Database** → **Blob**
2. Name it e.g. `insurance-desk-files` → Create
3. Connect to your `shopdesk-insurance` project
4. Copy **`BLOB_READ_WRITE_TOKEN`** from Blob settings

### Add token to GitHub

1. GitHub → **E26MEDIA/shopdesk-insurance** → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
   - Name: `BLOB_READ_WRITE_TOKEN`
   - Value: paste token from Vercel

### Re-run the build

1. **Actions** → **Build Windows Installer** → **Run workflow**
2. When done, open the job log → find line:
   ```
   Fast download URL (paste in Admin → Download)
   ```
3. Copy that URL
4. **Admin → Download** → paste → **Save**

Downloads will be **much faster** than Google Drive.

---

## Quick option: Dropbox (no setup)

1. Upload `ShopDesk-Setup-0.1.3.zip` to Dropbox
2. Share link (anyone with the link)
3. Paste in Admin → Software

Example:
```
https://www.dropbox.com/s/xxxxx/ShopDesk-Setup-0.1.3.zip?dl=0
```

Usually faster than Google Drive.

---

## Why Google Drive is slow

Google limits speed on free direct downloads. Fine for testing, not good for customers.

---

## After you set a fast URL

Customers download from:
- https://insurance.e26media.com/download

No change for clients — only the file host changes.
