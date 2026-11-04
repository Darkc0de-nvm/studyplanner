'use strict';
const { randomBytes } = require('crypto');
const pool = require('./pool');
const argon2 = require('argon2');

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Clamp future date to end of same week (Sunday)
function clampToWeekEnd(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  const day = d.getDay(); // 0=Sun, 1=Mon...6=Sat
  if (day === 0) return isoDate; // already Sunday
  // Find next Sunday
  const daysToSun = 7 - day;
  return addDays(d, daysToSun);
}

async function seed() {
  // Credentials: from env or generated
  const email = process.env.SEED_EMAIL || `demo_${randomBytes(4).toString('hex')}@example.com`;
  const password = process.env.SEED_PASSWORD || randomBytes(8).toString('hex') + 'A1!';
  const name = process.env.SEED_NAME || 'Demo User';

  const client = await pool.connect();
  try {
    // Check if already seeded
    const { rows: existing } = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.length > 0) {
      console.log(`Demo user already exists: ${email}`);
      return;
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    // Create user
    const { rows: [user] } = await client.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [email.toLowerCase(), name, passwordHash]
    );

    // Create 3 disciplines
    const disciplines = [
      { name: 'Архітектура комп\'ютера', colorIndex: 1 },
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

    const today = new Date().toISOString().slice(0, 10);
    const [archId, webId, dbId] = discIds;

    // 7 seed tasks matching Lab 4 offsets: -2, -3, -4, 0, +2(clamped), +9, +12
    const tasks = [
      { title: 'Звіт з лабораторної роботи', description: 'Підготувати звіт відповідно до вимог кафедри', disciplineId: archId, deadline: addDays(today, -2), done: false },
      { title: 'Контрольна робота з Web-дизайну', description: 'Повторити теми: Flexbox, Grid, адаптивна верстка', disciplineId: webId, deadline: addDays(today, -3), done: false },
      { title: 'Звіт з практики', description: 'Скласти звіт за результатами практики', disciplineId: dbId, deadline: addDays(today, -4), done: false },
      { title: 'Скласти план проекту', description: 'Визначити технічний стек та архітектуру', disciplineId: archId, deadline: today, done: false },
      { title: 'Реферат з Web-дизайну', description: null, disciplineId: webId, deadline: clampToWeekEnd(addDays(today, 2)), done: false },
      { title: 'Курсова робота', description: 'Реалізація основних модулів системи', disciplineId: dbId, deadline: addDays(today, 9), done: false },
      { title: 'Підготовка до іспиту', description: 'Переглянути лекційний матеріал', disciplineId: archId, deadline: addDays(today, 12), done: true },
    ];

    for (const t of tasks) {
      await client.query(
        `INSERT INTO tasks (user_id, discipline_id, title, description, deadline, done, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [user.id, t.disciplineId, t.title, t.description, t.deadline, t.done, t.done ? new Date() : null]
      );
    }

    // Print credentials if generated (not in env)
    if (!process.env.SEED_EMAIL) {
      console.log('\n🌱 Demo user created:');
      console.log(`   Email:    ${email}`);
      console.log(`   Password: ${password}`);
      console.log('   (These credentials are only shown once — save them now)\n');
    } else {
      console.log(`\n🌱 Demo user created: ${email}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed error:', err.message);
  process.exit(1);
});
