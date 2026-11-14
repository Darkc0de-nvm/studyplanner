# Звіт про виконання Фази 0: Вимоги, архітектура та технічні рішення

## 1. Що було виконано

У межах Фази 0 підготовлено повний комплекс архітектурної, аналітичної та технічної документації для трансформації навчального веб-застосунку StudyPlanner у full-stack проект відповідно до вимог Лабораторної роботи №5:

1. **Збереження початкового завдання:**
   - `docs/prompts/00-initial.md`: точний первинний текст промпта збережено дослівно (verbatim) без змін.
2. **Специфікація вимог:**
   - `docs/requirements.md`: сформульовано 55 функціональних критеріїв приймання (`AC-01` .. `AC-55`), розбитих на логічні блоки (автентифікація, CRUD завдань, дисципліни, пошук та фільтрація, синхронізація календаря, інтерфейсні стани, видалення акаунта, демо-режим), та 24 нефункціональні вимоги (безпека OWASP, доступність WCAG 2.2 AA, бюджет продуктивності Web Vitals, сумісність із Chrome/Firefox, якість коду, вимоги до розгортання та тестування).
3. **Архітектура системи:**
   - `docs/architecture.md`: спроектовано монолітну Single-Origin архітектуру (Express роздає як API, так і статичний клієнт), розроблено Mermaid sequence diagram для життєвого циклу автентифікованого запиту, структуру файлів та папок майбутнього проекту, конфігурацію середовищ (12-Factor App) із валідацією при старті (fail-fast), стандартизований JSON-формат помилок, дизайн безпеки (argon2id, серверні сесії в БД, cookie `HttpOnly; SameSite=Lax; Secure`, багаторівневий захист від CSRF, лімітування запитів, заголовки Helmet та CSP), структуроване логування без секретів, обґрунтування залежностей у `package.json` та аналітику вибору платформи хостингу.
4. **Специфікація REST API:**
   - `docs/api.md`: повний опис 14 кінцевих точок із HTTP-методами, схемами запитів/відповідей, правилами суворої валідації полів через Zod, кодами відповідей та форматом стандартизованих помилок.
5. **Модель даних та реляційна схема:**
   - `docs/data-model.md`: схема таблиць PostgreSQL (`users`, `sessions`, `disciplines`, `tasks`, `migrations`), первинні ключі UUIDv4, обмеження цілісності, каскадне видалення зв'язаних сутностей (`ON DELETE CASCADE`), захист від видалення використовуваних дисциплін (`ON DELETE RESTRICT`), B-Tree індекси для оптимізації вибірок, Mermaid ER-діаграма та концепція ідемпотентного раннера міграцій чистого SQL.
6. **Комплексний тест-план:**
   - `docs/test-plan.md`: матриця відповідності тестів критеріям приймання AC (модульні та інтеграційні тести API на `supertest`), 10 наскрізних E2E сценаріїв для Playwright у Chromium та Firefox, перевірки безпеки (npm audit, CSRF, брутфорс, session fixation, gitleaks), доступності (axe-core, навігація з клавіатури, контрастність, 200% zoom) та швидкодії (Lighthouse бюджети, розміри ресурсів, перевірка планів виконання запитів через EXPLAIN).
7. **Журнал взаємодії з ШІ та каталог ризиків:**
   - `docs/ai-log.md`: таблиця взаємодії, детальний опис згенерованих матеріалів Фази 0, ідентифіковані дефекти/ризики та таблиця заходів зі зменшення ризиків ШІ-коду.

---

## 2. Як було перевірено

- **Перевірка наявності та цілісності файлів:** Усі створені файли перевірено на відповідність шляхів файлової системи на Windows.
- **Валідація Mermaid-діаграм:** Схеми у `docs/architecture.md` (sequenceDiagram) та `docs/data-model.md` (erDiagram) перевірено на синтаксичну коректність відповідно до специфікації Mermaid.js.
- **Повнота покриття вимог:** Усі 55 критеріїв приймання мають пряме відображення у тест-плані та специфікаціях API/моделі даних.
- **Відсутність секретів:** У жодному документі немає збережених секретів або облікових даних.

---

## 3. Відомі обмеження

1. **Дослідження тарифів хостингу:** Дані щодо умов використання Render Free та Neon зафіксовано станом на листопад 2026 року; перед безпосереднім розгортанням у Фазі 4 рекомендується повторно звірити актуальні ліміти провайдерів.
2. **Компіляція argon2 на Windows:** Якщо у середовищі студента виникнуть проблеми з компіляцією native C++ addon для `argon2`, передбачено архітектурний fallback на `bcrypt`/`bcryptjs`.
3. **Холодний старт безкоштовного сервера:** Безкоштовний тариф Render має паузу запуску ~30-50 секунд після 15 хвилин простою, що вирішується зовнішнім cron-пінгом `/api/health`.

---

## 4. Пропонований коміт (Proposed Commit)

> [!NOTE]
> Відповідно до робочих правил (Working Rules), агент не виконує дій `git add`, `git commit`, `git push`. Усі зміни залишено у робочому дереві для перевірки користувачем.

**Список файлів для включення у коміт:**

```
docs/prompts/00-initial.md
docs/requirements.md
docs/architecture.md
docs/api.md
docs/data-model.md
docs/test-plan.md
docs/ai-log.md
docs/phases/phase0.md
```

**Пропоноване повідомлення коміту:**

```text
docs: complete Phase 0 requirements, architecture, and specifications

- Add 00-initial.md verbatim prompt for Lab 5
- Add comprehensive requirements (AC-01..AC-55 and NFR-01..NFR-24)
- Add system architecture with Single-Origin design, Mermaid request flow, and security design
- Add hosting evaluation (Render + Neon vs Railway vs Fly.io; rationale against SQLite)
- Add REST API specification with input schemas, error formats, and response codes
- Add relational PostgreSQL data model with constraints, indexes, ER diagram, and migration strategy
- Add test plan covering API test suites, Playwright E2E scenarios, security, a11y, and perf
- Initialize AI interaction log and AI-generated code risk mitigation catalog
- Add Phase 0 summary report
```
