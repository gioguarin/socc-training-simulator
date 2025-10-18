const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/socc-training.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let dbInstance = null;

async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        // Ensure data directory exists
        const dataDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        dbInstance = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
                reject(err);
                return;
            }
            console.log('Connected to SQLite database.');
        });

        // Enable foreign keys
        dbInstance.run('PRAGMA foreign_keys = ON');

        // Initialize schema
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);

        let completed = 0;
        const totalStatements = statements.length;

        statements.forEach((statement, index) => {
            if (!statement.trim()) return;

            dbInstance.run(statement.trim(), (err) => {
                if (err) {
                    console.error(`Error executing statement ${index + 1}:`, err.message);
                    reject(err);
                    return;
                }
                completed++;
                if (completed === totalStatements) {
                    console.log('Database schema initialized successfully.');
                    resolve(dbInstance);
                }
            });
        });
    });
}

function getDatabase() {
    if (!dbInstance) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return dbInstance;
}

module.exports = {
    initializeDatabase,
    getDatabase
};