# RR CDO Editable QR Manager

A standalone mobile-friendly editable QR application. The permanent QR points to `/q/main`; administrators can change the published page content in Supabase without changing or reprinting the QR.

## Features
- One permanent QR code with downloadable PNG.
- Public page shows latest published content.
- Supabase Auth administrator sign-in at `/admin`.
- Editable text, numeric values, links, and images.
- Dedicated public image bucket, 5 MB upload limit.
- Separate `editable_qr_codes` and `editable_qr_admins` tables. Existing Packing Monitor tables are not modified.
- RLS restricts edits and uploads to allowlisted admin user IDs.

## Supabase setup
1. In the Supabase project, open SQL Editor and run all of `supabase/setup.sql`.
2. Go to Authentication > Users and create an administrator email/password account. Disable public sign-ups if not needed.
3. Copy that user's UUID and run this in SQL Editor, replacing the placeholder:
   `insert into public.editable_qr_admins (user_id) values ('PASTE-AUTH-USER-UUID-HERE');`
4. Copy the Project URL and publishable key (or legacy anon key) from Project Settings > API. Never use the service_role or secret key in browser code.

## Local development
Install Node.js 20 or newer, then:
```bash
npm install
cp .env.example .env
```
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`, then run `npm run dev`.

## Render deployment
Create a Render Static Site connected to this repository:
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Rewrite: source `/*`, destination `/index.html`, action `Rewrite`

After deployment, visit `/admin` to sign in. The dashboard generates a QR for `/q/main`. Download and print it once. Do not change the slug `main` after printing.

## Security
The QR page is public by design. Do not publish confidential or personal information. The browser uses only the Supabase publishable/anon key; RLS is the security boundary. Images are publicly readable because the QR page displays them. Revoke an admin by deleting their row from `editable_qr_admins` and disabling their Auth account.
