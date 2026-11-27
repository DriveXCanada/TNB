# Vantage Security Consulting – Process Serving

A web app for running a process serving business in Nova Scotia: jobs, service attempts from the field, affidavits, employees with permissions, and a client portal.

## Features

- **Jobs** – client (details filled in from your client list), client job number, court case number, plaintiff (filled in from the client), defendant, date filed, court date, court and county, party to serve (filled in from the defendant) with email and phone, service and alternate addresses, documents, assigned server, attempt due date, instructions.
- **Job page** – client / server / status summary; service attempts (expand for notes, GPS, photos; edit); affidavits; recipient, instructions, documents, court case; printable field sheet; archive.
- **Attempts** – Personal Service, Unsuccessful or Bad Address. Date and time fill in automatically and can be changed for attempts logged later. Description presets, GPS, photos/uploads, "add new address". Personal service marks the job **Served**; otherwise the status reads "N Attempts".
- **Affidavits** – New Affidavit opens an editable form pre-filled from the job (Affidavit of Service or Non-Service, picked automatically). Save stores it on the job and downloads the PDF; print, download or edit later. Templates: Standard, or Nova Scotia Form 31.05 style. **Check the wording before swearing it.**
- **Employees** – Owner, Admin, Limited, Contact or Custom permissions; license number and expiry, address, default server. You set each employee's password; they can change it under **My Account**.
- **Client portal** (`/portal`) – on a client's page, add logins with a **name and PIN**. Clients sign in with those, see only their own company's jobs, the attempts marked visible, and affidavits marked visible, and can change their PIN. A login locks for 15 minutes after 5 wrong PINs; setting a new PIN unlocks it.
- **Tracking link** – each job also has a no-login tracking page you can share; it shows only visible attempts.

The app sends no email. Billing is handled in Square, so there is no invoicing.

## Run locally

```bash
cp .env.example .env          # set DATABASE_URL to a Postgres database
npm install
npx prisma migrate dev        # creates the tables
npm run dev                   # http://localhost:3000
```

On first visit you'll be asked to create the Owner account.

## Deploy to Railway

1. New Project → Deploy from GitHub repo → this repo.
2. + New → Database → PostgreSQL.
3. App service Variables:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `APP_URL` = your public address, e.g. `https://www.yourdomain.com` (used in tracking links)
   - `APP_TIMEZONE` = `America/Halifax` (default)
4. Settings → Networking → add your domain (or Generate Domain).
5. Deploy. Migrations run on start. The app keeps its tables in their own Postgres schema, `tnb`, so it works even if the database already has tables in `public` (which otherwise causes Prisma error P3005). Set `DB_SCHEMA` to use another name.

## Tech

Next.js 15 (App Router, server actions), PostgreSQL via Prisma, Tailwind CSS 4, pdf-lib for PDFs.
