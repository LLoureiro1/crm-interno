# Areas of Concern & Tech Debt

## Sensitive Areas
- **RLS Policies:** Errors here can expose data between school units or break anonymous public flows. It requires rigorous review on any change.
- **Status Synchronization:** Keeping `students.status`, `appointments.status`, interactions, and automations in sync is complex. Misalignment can cause silent regressions.
- **Timezones & Scheduling:** Dates, timezones, and past-time blocking for scheduling are error-prone and impact absence detection.
- **Contact Lists:** Changes to filters or status can affect the distribution load for dynamic contact lists.

## Known Challenges
- The architecture pushes heavy logic into PostgreSQL (RPCs, triggers). Developers must be proficient in PL/pgSQL to maintain business rules safely.
