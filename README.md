# Badminton Court Monolith

Monolith project for badminton court reception, booking coordination, and court operations.

## Stack

- Backend: NestJS + TypeORM
- Frontend: React + Vite
- Database: Supabase Postgres
- Containers: Docker Compose

## Core features

- Admin site for reception, waiting list, court assignment, payment follow-up, and match tracking
- Customer site for self-service registration, QR deposit payment, webhook confirmation, and expiry handling
- Responsive UI optimized for phones, tablets, and laptops

## Project structure

```text
apps/
  api/           NestJS backend
  web/           Admin React frontend
  customer-web/  Customer React frontend
```

## Environment setup

1. Copy [/.env.example](C:/Users/Admin/Documents/New%20project/.env.example) to [/.env](C:/Users/Admin/Documents/New%20project/.env)
2. Copy [apps/api/.env.example](C:/Users/Admin/Documents/New%20project/apps/api/.env.example) to [apps/api/.env](C:/Users/Admin/Documents/New%20project/apps/api/.env)
3. Fill in:

- `DATABASE_URL` with your Supabase connection string
- `DATABASE_SSL=true`
- `DATABASE_SSL_REJECT_UNAUTHORIZED=false`
- `PAYMENT_CALLBACK_URL` with your real public API callback URL
- Cloudinary credentials
- Bank account / webhook settings in `apps/api/.env`

Important:

- For Supabase pooler, the connection string typically uses host `pooler.supabase.com` and port `6543`
- During initial setup you can keep `TYPEORM_SYNCHRONIZE=true`
- After the schema stabilizes, switch `TYPEORM_SYNCHRONIZE=false`

## Local development

1. Install dependencies:

```bash
npm run install:all
```

2. Run the backend:

```bash
npm run dev:api
```

3. Run the admin frontend in another terminal:

```bash
npm run dev:web
```

4. Run the customer frontend in another terminal:

```bash
npm run dev:customer
```

Admin web: `http://localhost:5173`

Backend: `http://localhost:3000/api`

Customer web: `http://localhost:5174`

## Full stack with Docker

```bash
docker compose up --build
```

Docker now runs:

- `api`
- `web`
- `customer-web`

It does not run PostgreSQL locally anymore. All data is stored in Supabase through `DATABASE_URL`.

## Deployment notes

- Set the real public host/IP in [/.env](C:/Users/Admin/Documents/New%20project/.env)
- Point your bank webhook to `PAYMENT_CALLBACK_URL`
- Rebuild after env changes:

```bash
docker compose down
docker compose up --build -d
```

## Business flow included

- Admin staff can receive bookings, manage waiting customers, assign courts, and track play sessions
- Customer bookings from `customer-web` only enter the waiting list after deposit confirmation
- Deposit payment can be confirmed through bank webhook callbacks
- QR deposit orders can expire automatically after a configured countdown
- Customer and admin flows share the same backend and Supabase database

## Notes

- The backend seeds starter data on first boot
- Supabase is still PostgreSQL under the hood, so TypeORM works normally through the external connection string
- For production, replace `synchronize` with explicit migrations
