# Architecture

## System Design
- **Frontend SPA:** A Single Page Application built with React and Vite. It consumes backend services via Supabase client.
- **Backend-as-a-Service (BaaS):** Supabase handles Auth, Database (PostgreSQL), Row Level Security (RLS), and custom business logic via RPCs and Triggers.
- **Serverless Automation:** Supabase Edge Functions manage cron jobs, email queues, and background calculations (e.g., engagement scoring).

## Data Flow
- **Authentication:** Users authenticate via Supabase Auth. Client hook loads profiles and manages sessions.
- **Business Logic:** Critical business logic (funnel progression, scheduling, RLS) is pushed to the database layer via PostgreSQL RPCs and Triggers.
- **Public vs Authenticated Flow:** Public routes use secure RPCs with registration tokens, while authenticated routes respect RLS based on user profiles (admin, direcao, entrevistador, padrao).

## Access Control
- **RLS (Row Level Security):** Isolates data by school unit. Admins and central users can access multiple units; others are restricted to their assigned unit.
