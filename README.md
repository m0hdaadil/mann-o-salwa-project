# Mann O Salwa

QR table ordering website and owner dashboard for Mann O Salwa, Nizamabad.

## Run Locally

```bash
node server.mjs
```

Open:

- Customer site: `http://localhost:4173`
- Table QR example: `http://localhost:4173/menu?table=2`
- Admin dashboard: `http://localhost:4173/admin`

## Admin Login

- Email: `owner@mannosalwa.local`
- Password: `admin123`

Change these before production in `server.mjs` seed data or through a proper user setup flow.

## Features

- Mobile-first cafe website
- QR table detection through `?table=1`
- Searchable category menu
- Cart with quantity editing
- Direct order submission into local JSON storage
- Admin dashboard with live-refresh orders, menu editing, review moderation, analytics, settings, and table QR codes
- Local SVG QR generation through `/api/qr?table=1`
- Uploaded logo and menu reference images included in `public/assets`

## Production Notes

For production, replace local JSON storage with PostgreSQL, set a strong `JWT_SECRET`, put the app behind HTTPS, and move uploaded item/banner images to a permanent storage provider. Passwords are hashed in this build, and legacy plaintext local data is migrated automatically.
