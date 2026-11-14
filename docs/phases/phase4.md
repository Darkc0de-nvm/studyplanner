# Фаза 4: production-розгортання

**Статус:** заплановано, ще не виконано.

## Мета

Розгорнути перевірену версію StudyPlanner як same-origin production сервіс з HTTPS і керованою PostgreSQL, після чого задокументувати URL та результати перевірок.

## Передумови

- [ ] Завершити перегляд поточних змін у робочому дереві.
- [ ] Повторно виконати CI/фінальний набір перевірок на тому самому коді, який буде розгорнуто.
- [ ] Зафіксувати перевірену версію в `main`.
- [ ] Звірити актуальні тарифи, ліміти й умови Render та Neon.

## План виконання

- [ ] Створити production PostgreSQL у Neon і зберегти TLS connection string як секрет.
- [ ] Створити Render Web Service з коренем репозиторію, `npm ci --prefix server` і `npm start --prefix server`.
- [ ] Налаштувати production environment variables, HTTPS, secure session cookie та health check `/api/health`.
- [ ] Застосувати міграції до production database; не запускати seed без окремої потреби.
- [ ] Перевірити health endpoint, auth/session, task/discipline CRUD, headers, логи й основні сторінки.
- [ ] Перевірити та задокументувати безпечний відкат.
- [ ] Записати production URL, дату, версію коміту й результати у цьому звіті та README.

## Критерії завершення

Фазу можна позначити завершеною, коли service працює за HTTPS із коректною БД і сесіями, проходить документований smoke-check, а URL і фактичні результати зафіксовані. Поки критерії не виконані, не вказувати проєкт як production-deployed.

Детальна процедура: [`../deployment.md`](../deployment.md). Архітектурні вимоги: NFR-23 і NFR-24 у [`../requirements.md`](../requirements.md).
