# Testing Practices

## Framework & Approach
- Detailed testing configuration is not explicitly prominent in `package.json` (no Jest/Vitest scripts out-of-the-box).
- However, SQL migrations and Edge functions may have integration test points.
- "TRACKING_SYSTEM_TEST.md" and "test-missed-interview-functionality.sql" indicate a strong reliance on database-level and functional manual testing.

## Database Testing
- Ensure new RPCs and Triggers are tested against multiple user roles (admin, anonymous) to verify RLS integrity.
