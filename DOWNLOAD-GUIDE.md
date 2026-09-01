# How to put the real .exe on the download page

Chrome blocked the download because the file on the server was **not a real installer** (only 158 KB — a broken Linux build stub). A real ShopDesk installer is **~200 MB** and must be built on **Windows**.

---

## Step 1 — Build the real installer (on your Windows PC)

```bash
cd shopdesk-insurance
git pull
npm install
npm run desktop:dist:win
```

The real file will be:

```
dist-desktop\ShopDesk-Setup-0.1.0.exe   (~200 MB)
```

**Do not** use the small 158 KB file — that is incomplete.

---

## Step 2 — Upload to Google Drive

1. Upload `ShopDesk-Setup-0.1.0.exe` to Google Drive
2. Right-click → **Share** → **Anyone with the link** → Viewer
3. Copy the share link, e.g.  
   `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`
4. Convert to **direct download** link:

```
https://drive.google.com/uc?export=download&id=FILE_ID
```

Replace `FILE_ID` with the ID from the share URL.

---

## Step 3 — Set link in admin panel

1. Go to **https://insurance.e26media.com/admin/login**
2. Login → **Download** (left menu, under Software)
3. Paste the Google Drive direct link
4. Click **Save download link**

Customers can then download from:

- https://insurance.e26media.com/download
- Homepage download section

---

## Why Chrome said "Virus detected"

| Reason | Fix |
|--------|-----|
| File was only 158 KB (broken/incomplete) | Build on Windows — real file is ~200 MB |
| Not code-signed | Normal for new software; Google Drive often works better |
| New unknown .exe from a website | Use Google Drive link, or buy a code signing certificate later |

---

## Optional — Windows SmartScreen

When customers run the installer, Windows may show **"Windows protected your PC"**.

They click **More info** → **Run anyway**.

To remove this long-term, buy an **Authenticode code signing certificate** (~$200–500/year).

---

## Do NOT host the .exe on Vercel/git

The installer is ~200 MB. Vercel free plan limit is too small. Always use **Google Drive**, Dropbox, or GitHub Releases.
