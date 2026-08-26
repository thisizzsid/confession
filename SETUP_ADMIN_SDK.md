# How to Fix Firebase Admin "Could not load the default credentials" Error

The error occurs because the server (your local machine or Vercel) doesn't have the permission to send notifications or access the database as an Admin. You need a **Service Account Key**.

## Step 1: Generate the Key
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project (`emesispro`).
3. Click the ⚙️ (Gear icon) -> **Project Settings**.
4. Go to the **Service accounts** tab.
5. Click **Generate new private key**.
6. Confirm by clicking **Generate key**. This will download a JSON file.

## Step 2: Install the Key (Choose Option A or B)

### Option A: Local Development (Easiest for localhost)
1. Rename the downloaded file to `serviceAccountKey.json`.
2. Move it to the **root folder** of this project (same level as `package.json`).
   - *Note: This file is already in `.gitignore`, so it won't be pushed to GitHub.*

### Option B: Using Environment Variables (Best for Vercel/Production)
1. Open the downloaded JSON file and copy its entire content.
2. In your `.env.local` file (create it if missing), add:
   ```env
   FIREBASE_SERVICE_ACCOUNT_KEY='PASTE_THE_ENTIRE_JSON_CONTENT_HERE'
   ```
   *(Make sure it's all on one line or properly quoted)*.

3. **If deploying to Vercel**:
   - Go to your Vercel Project Settings -> Environment Variables.
   - Add `FIREBASE_SERVICE_ACCOUNT_KEY` with the JSON content as the value.

## Step 3: Restart Server
Stop your local server (Ctrl+C) and run `npm run dev` again. The error should be gone.

## Required Vercel Variables
For the admin notification panel, add these in Vercel Project Settings -> Environment Variables:

```env
FIREBASE_SERVICE_ACCOUNT_KEY=<entire service-account JSON value>
ADMIN_PASSWORD=<strong admin password>
ADMIN_SESSION_SECRET=<long random session secret>
MAIL_HOST=<SMTP host>
MAIL_PORT=465
MAIL_USER=<SMTP username>
MAIL_PASS=<SMTP password>
MAIL_TO=<admin email>
```

After saving the variables, redeploy. The Firebase web configuration alone cannot authorize the Admin SDK or send FCM messages.
