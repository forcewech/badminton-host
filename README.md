# Badminton Court Monolith

Monolith project for badminton court reception, booking coordination, and court operations.

## Stack

- Backend: NestJS + TypeORM
- Frontend: React + Vite
- Database: PostgreSQL
- Containers: Docker Compose

## Core features

- Customer reception: booking intake, deposit confirmation, check-in, and court directions
- Court management: court schedule overview, court conflict prevention, and equipment checklist
- Responsive UI optimized for phones, tablets, and laptops

## Project structure

```text
apps/
  api/   NestJS backend
  web/   React frontend
```

## Local development

1. Copy `.env.example` to `.env` if you need custom values.
2. Install dependencies:

```bash
npm run install:all
```

3. Start PostgreSQL with Docker:

```bash
docker compose up -d postgres
```

4. Run the backend:

```bash
npm run dev:api
```

5. Run the frontend in another terminal:

```bash
npm run dev:web
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:3000/api`

## Full stack with Docker

```bash
docker compose up --build
```

## Business flow included

- Staff can create a booking with customer details, time slot, court, and deposit amount
- The API blocks overlapping bookings on the same court and day
- Staff can confirm deposits before arrival
- Check-in requires the deposit to be marked as paid when a deposit is required
- Staff can review court directions and equipment status from the same interface

## Notes

- The backend seeds a few courts and equipment records on first boot
- TypeORM uses `synchronize: true` for quick setup; switch to migrations before production
