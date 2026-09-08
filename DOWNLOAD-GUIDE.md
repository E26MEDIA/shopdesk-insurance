# How to put the real installer on the download page

Windows Defender and Chrome flag **unsigned** `.exe` installers. Build on **Windows**, then distribute the **`.zip`** the builder now creates next to the exe.

A real Insurance Desk installer is **~150–200 MB**.

---

## Step 1 — Build the installer (on a Windows PC)

```bash
cd shopdesk-insurance
git pull
npm install
npm run desktop:dist:win
```

You will get:

```
dist-desktop\ShopDesk-Setup-0.1.3.exe        (~150–200 MB)
dist-desktop\ShopDesk-Setup-0.1.3.zip        (same file, zipped for Chrome)
```

Do **not** upload a tiny stub file. If the exe is under ~50 MB, the build is broken.

The installer is a normal setup wizard (not one-click). Customers can choose the folder. The publisher shown in file properties is **E26 Media**.

---

## Step 2 — Upload the zip (not the raw exe)

1. Upload `ShopDesk-Setup-0.1.3.zip` to Dropbox — not `ShopDesk-Setup-0.1.3.exe.zip` (Chrome treats that name as malware)
2. Share → **Anyone with the link** → Copy link
3. Do not use the Dropbox preview page to “open” the zip — Dropbox cannot preview it. The share link is enough.

---

## Step 3 — Publish in admin

1. Go to **https://insurance.e26media.com/admin/login**
2. **Software** (left menu)
3. Version: `0.1.3` (must be higher than shops already running)
4. Paste the Dropbox **zip** share link
5. **Publish update**
6. Hard-refresh the Software page and confirm the zip URL is still there

Customers download from:

- https://insurance.e26media.com/download

They extract the zip, then run `ShopDesk-Setup-0.1.3.exe`.

---

## Windows Defender / SmartScreen

| What you see | What it means |
|--------------|----------------|
| “file contains a virus or potentially unwanted software” | Windows blocked an **unsigned** Electron/NSIS installer. Rebuilding with this builder reduces false-positive heuristics (one-click NSIS, missing publisher, `ELECTRON_RUN_AS_NODE`). It does **not** replace a code-signing certificate. |
| “Windows protected your PC” | SmartScreen on a new publisher. **More info** → **Run anyway** until the app has reputation or is signed. |

**Do not** tell customers to turn off Windows Defender.

To stop these warnings for good, buy an **Authenticode** certificate (~$200–500/year), then add it to the Windows CI build as `CSC_LINK` / `CSC_KEY_PASSWORD`.

---

## Do NOT host the .exe on Vercel/git

The installer is ~200 MB. Always use **Dropbox**, Google Drive, Vercel Blob, or GitHub Releases (private repo = team only).
