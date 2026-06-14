# Code Conventions & Patterns

## Business Logic
- **Database First:** Critical business rules must reside in the database via RPCs (SECURITY DEFINER), Triggers, and Policies (RLS). The frontend acts as an orchestrator for the UI.
- **State consistency:** Database enums and status values are the single source of truth.

## Frontend Architecture
- **Component Organization:** Components are grouped by domain.
- **Hooks & Utils:** Centralize authentication, form logic, data fetching, and validation logic in hooks and utils.
- **Security:** Ensure RLS policies and helper functions are robust to prevent cross-unit data exposure.

## Commits & Source Control
- Follow conventional commits if applicable, and ensure changes account for multiple flows (authenticated, anonymous, cron, webhook).
