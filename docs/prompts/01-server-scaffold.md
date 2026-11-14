# Промпт Фази 1: Серверний каркас, БД, REST API та тести

**Дата:** 04.11.2026  
**Модель / Інструмент:** Claude Sonnet 4.6 (Thinking) через Antigravity IDE  
**Ціль:** Реалізація бекенду для StudyPlanner Lab 5 — Express 4.x, PostgreSQL, міграції, безпека OWASP, Zod-валідація, сесії, сервіси, контролери, маршрути та тести з покриттям 85%+.

## Зміст завдання

You are implementing Phase 1 of StudyPlanner Lab 5: scaffold the Node.js/Express server, PostgreSQL database, migrations, REST API, security baseline, and API tests. The project is at d:\StudyPlanner. No client changes.

### Constraints & Architectural Decisions
- No git operations
- Windows PowerShell compatible scripts
- CJS (CommonJS, require/module.exports) for all server code
- Node.js >=22.0.0
- Real PostgreSQL (pg, connection pool, pure SQL migrations)
- Express 4.x, helmet, compression, cookie-parser, morgan, express-rate-limit
- argon2id password hashing
- Server-side sessions in `sessions` table, `sp_session` cookie (HttpOnly, SameSite=Lax, Secure in prod)
- CSRF protection: Content-Type JSON + Origin/Host verification for state-changing requests
- Zod schemas for all request validations (.strict())
- Vitest + supertest integration tests against test PostgreSQL
- Target line coverage: >= 85%
