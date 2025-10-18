const fs = require('fs');
const path = require('path');
const { initializeDatabase, getDatabase } = require('./init');

async function runMigrations() {
    console.log('Starting database migrations...');

    // Initialize database first
    await initializeDatabase();
    const db = getDatabase();

    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).sort();

    for (const file of migrationFiles) {
        if (file.endsWith('.sql')) {
            console.log(`Running migration: ${file}`);
            const migrationPath = path.join(migrationsDir, file);
            const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

            // Split by semicolon and execute each statement
            const statements = migrationSQL.split(';').filter(stmt => stmt.trim().length > 0);

            for (const statement of statements) {
                if (statement.trim()) {
                    await new Promise((resolve, reject) => {
                        db.run(statement.trim(), (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                }
            }
        }
    }

    console.log('All migrations completed successfully');
    db.close();
}

runMigrations().catch(console.error);