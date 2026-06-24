const db = require('./db/database');
const bcrypt = require('bcryptjs');

const demoUsers = [
  { username: 'admin', email: 'admin@TodoApp.com', password: 'admin123', role: 'admin' },
  { username: 'user1', email: 'user1@TodoApp.com', password: 'user123', role: 'viewer' },
  { username: 'user2', email: 'user2@TodoApp.com', password: 'user123', role: 'viewer' },
  { username: 'user3', email: 'user3@TodoApp.com', password: 'user123', role: 'viewer' },
  { username: 'user4', email: 'user4@TodoApp.com', password: 'user123', role: 'viewer' },
];

function seedDatabase() {
  console.log('Starting database seeding...');

  demoUsers.forEach((user) => {
    const hashedPassword = bcrypt.hashSync(user.password, 10);

    db.run(
      `INSERT OR IGNORE INTO users (username, email, password, role, status, approved_at, plain_password)
       VALUES (?, ?, ?, ?, 'approved', CURRENT_TIMESTAMP, ?)`,
      [user.username, user.email, hashedPassword, user.role, user.password],
      (err) => {
        if (err) {
          console.error(`Error adding user ${user.username}:`, err.message);
        } else {
          console.log(`✓ User '${user.username}' added successfully`);
        }
      }
    );
  });

  console.log('Database seeding completed!');
  process.exit(0);
}

seedDatabase();
