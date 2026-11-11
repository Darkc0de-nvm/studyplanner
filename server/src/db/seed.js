'use strict';
const { randomBytes } = require('crypto');
const argon2 = require('argon2');
const pool = require('./pool');
const { resolveBaseDate, addDays, clampToWeekEnd } = require('./seedDates');

/**
 * Creates the demo user together with three disciplines and seven tasks.
 * Everything runs in a single transaction so a failure cannot leave a
 * half-seeded account behind.
 */
async function seed(options = {}) {
  const email = options.email || process.env.SEED_EMAIL || `demo_${randomBytes(4).toString('hex')}@example.com`;
  const password = options.password || process.env.SEED_PASSWORD || randomBytes(8).toString('hex') + 'A1!';
  const name = options.name || process.env.SEED_NAME || 'Demo User';
  const credentialsGenerated = !options.password && !process.env.SEED_PASSWORD;
  const baseDate = resolveBaseDate(options.baseDate ?? process.env.SEED_BASE_DATE);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (existing.length > 0) {
      await client.query('ROLLBACK');
      console.log(`Demo user already exists: ${email}`);
      return { created: false, email };
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const { rows: [user] } = await client.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [email.toLowerCase(), name, passwordHash]
    );

    const disciplines = [
      { name: 'Архітектура комп’ютера', colorIndex: 1 },
      { name: 'Web-дизайн', colorIndex: 2 },
      { name: 'Бази даних', colorIndex: 3 },
    ];

    const discIds = [];
    for (const d of disciplines) {
      const { rows: [disc] } = await client.query(
        'INSERT INTO disciplines (user_id, name, color_index) VALUES ($1, $2, $3) RETURNING id',
        [user.id, d.name, d.colorIndex]
      );
      discIds.push(disc.id);
    }

    // Base date comes from SEED_BASE_DATE (or today) and is shifted in UTC so
    // DST and local offsets cannot change the seeded deadline groups.
    const [archId, webId, dbId] = discIds;
    const description = 'Додати скриншоти виконання, схему алгоритму та висновки. Здати до практичного заняття через Moodle.';

    // 7 tasks mirroring the Lab 4 client seed exactly:
    // offsets -2, -3, -4, 0, +2 (clamped to week end), +9, +12.
    const tasks = [
      { title: 'Оформити звіт з лабораторної роботи №3', description, disciplineId: archId, deadline: addDays(baseDate, -2), done: false },
      { title: 'Додати інтерактивні елементи на головну сторінку', description, disciplineId: webId, deadline: addDays(baseDate, -3), done: false },
      { title: 'Скласти конспект за темою «Кеш-пам’ять»', description, disciplineId: archId, deadline: addDays(baseDate, -4), done: true },
      { title: 'Виконати нормоконтроль лекційного матеріалу', description: '', disciplineId: dbId, deadline: baseDate, done: false },
      { title: 'Підготувати презентацію до захисту проєкту', description, disciplineId: archId, deadline: clampToWeekEnd(addDays(baseDate, 2)), done: false },
      { title: 'Оновити базу даних для фінального проєкту', description, disciplineId: dbId, deadline: addDays(baseDate, 9), done: false },
      { title: 'Підготувати підсумковий звіт за курсовий проєкт', description, disciplineId: archId, deadline: addDays(baseDate, 12), done: false },
    ];

    for (const t of tasks) {
      await client.query(
        `INSERT INTO tasks (user_id, discipline_id, title, description, deadline, done, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [user.id, t.disciplineId, t.title, t.description, t.deadline, t.done, t.done ? new Date() : null]
      );
    }

    await client.query('COMMIT');

    if (credentialsGenerated) {
      console.log('\n🌱 Demo user created:');
      console.log(`   Email:    ${email}`);
      console.log(`   Password: ${password}`);
      console.log('   (These credentials are only shown once — save them now)\n');
    } else {
      console.log(`\n🌱 Demo user created: ${email}`);
    }

    return { created: true, email };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seed()
    .then(() => pool.end())
    .catch(async (err) => {
      console.error('Seed error:', err.message);
      await pool.end().catch(() => {});
      process.exit(1);
    });
}

module.exports = { seed };
