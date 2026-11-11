# RIJUAN'S LIBRARY

A private PDF/PPT library with separate Admin and Guest access codes.

## Features
- Owner profile photo and title: SAJJAT SABBIR RIJUAN
- Admin code: upload, download, delete files
- Guest code: view and download only
- Files are served only after login; no public file links
- Search, mobile-friendly layout
- Allowed: PDF, PPT, PPTX (50 MB max per file)

## Run locally
1. Install Node.js 20 or newer.
2. In this folder run `npm install`.
3. Set environment variables (never put real codes in source files):
   - `ADMIN_CODE` = your private owner code
   - `GUEST_CODE` = the shared guest code
   - `SESSION_SECRET` = a long random secret (at least 32 random characters)
   - `NODE_ENV` = `production` when deployed behind HTTPS
4. Run `npm start`.
5. Open `http://localhost:3000`.

Example for macOS/Linux:
```bash
export ADMIN_CODE='choose-a-long-private-admin-code'
export GUEST_CODE='choose-a-different-guest-code'
export SESSION_SECRET='replace-with-a-long-random-secret-string'
npm start
```

PowerShell:
```powershell
$env:ADMIN_CODE="choose-a-long-private-admin-code"
$env:GUEST_CODE="choose-a-different-guest-code"
$env:SESSION_SECRET="replace-with-a-long-random-secret-string"
npm start
```

## Add your owner photo
The supplied owner image is included as `public/owner.jpg`. You can replace it with another square or portrait JPG, keeping the same filename.

## Publish online
This project needs a Node.js host that supports persistent disk storage (or attach a persistent volume). Deploy this folder to a Node.js hosting service, set the three environment variables in its dashboard, and enable HTTPS. Set `DATA_DIR` to the mounted persistent volume path if the host provides one. Do not use a host that deletes local files on every redeploy/restart unless you connect persistent object storage.

## Important security / deployment notes
- Keep Admin Code, Guest Code and SESSION_SECRET private. Do not paste them into the HTML or commit them to Git.
- Use HTTPS. The session cookie is HttpOnly and SameSite=Strict.
- Login attempts are rate-limited.
- For production with multiple app instances, replace Express's default in-memory session store with a persistent session store such as Redis.
- Back up the `data/uploads` folder regularly.
- Anyone who has the Guest Code can download every file in the library. Share it only with people you trust.
- This starter uses one shared Guest Code and one Admin Code. Rotate them by changing the host environment variables and restarting the app.
