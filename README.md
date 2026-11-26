# TNB Process Serving

A web app for running a process serving business: jobs, service attempts, field logging from a phone, affidavits of service, and live tracking links for clients.

## Features

- **Jobs** – recipient, service and alternate addresses, court, file number, title of proceeding, documents to serve (with uploads), client and client reference, priority, due date, fee and instructions.
- **Team and roles** – *Admins* (office) manage everything. *Servers* sign in and see only the jobs assigned to them.
- **Field mode** (`/field`) – phone-first screens. Servers tap **Navigate** to open Google Maps, then log attempts with:
  - big outcome buttons (personal, substituted, corporate, posted, not home, refused, bad address…)
  - automatic GPS capture with accuracy
  - camera photos, resized on the phone before upload
  - the details of the person served (name, relationship, physical description)
- **Live client tracking** – every job gets a private link (`/track/<token>`) for your client. It updates live, about every 15 seconds, as attempts are logged, and shows only attempts marked “share with client”. Photos are optional (see Settings). You can disable a link or issue a new one at any time. If SMTP is configured, the client’s email and the job’s notify emails also get a message for each shared attempt.
- **Affidavit of Service PDF** – set up for Nova Scotia by default. It follows Civil Procedure Rule 31.05 and Form 31.05: delivery by a non-party, where and how the documents were delivered, how the server identified the person, an Exhibit "A" true copy of the documents, earlier attempts, and the "Sworn to [or Affirmed] … before me" block with signature, print name and official capacity lines. In Nova Scotia, substituted and posted delivery are labelled as needing a court order (Rule 31.10). Other provinces get a generic layout. **Compare the output with the current official Form 31.05 before you swear it.**

Billing is not included: invoices are handled in Square. The fee field on each job is only for reference.

## Run locally

```bash
cp .env.example .env          # set DATABASE_URL to a Postgres database
npm install
npx prisma migrate dev        # creates the tables
npm run dev                   # http://localhost:3000
```

On first visit, you’ll be asked to create the admin account.

## Deploy to Railway

1. Push this repo to GitHub.
2. In Railway, open **New Project → Deploy from GitHub repo** and pick this repo.
3. In the same project, choose **+ New → Database → PostgreSQL**.
4. In the app service’s **Variables**, add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (a reference to the database)
   - `APP_URL` = your public URL, for example `https://tnb.up.railway.app`. Used in tracking links.
   - `APP_TIMEZONE` = defaults to `America/Halifax`
   - Optional email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
5. Under **Settings → Networking**, click **Generate Domain**.
6. Deploy. Migrations run automatically on start. The app keeps its tables in their own Postgres schema, `tnb`, so it works even if the database already has tables in `public` (which otherwise causes Prisma error P3005). Set `DB_SCHEMA` to use a different schema name. Open the URL and create your master account.

Photos and documents are stored in the Postgres database, so no separate file storage is needed.

## Tech

Next.js 15 (App Router, server actions), PostgreSQL via Prisma, Tailwind CSS 4, pdf-lib for PDFs, nodemailer for optional email.
