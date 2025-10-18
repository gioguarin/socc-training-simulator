const { getDatabase } = require('../database/init');

class User {
    static create(oauthId, email, name, department = null, passwordHash = null) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = `
                INSERT INTO users (oauth_id, email, name, department, password_hash, last_login)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(oauth_id) DO UPDATE SET
                    email = excluded.email,
                    name = excluded.name,
                    department = excluded.department,
                    last_login = datetime('now'),
                    updated_at = datetime('now')
                RETURNING *
            `;

            db.get(sql, [oauthId, email, name, department, passwordHash], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    static findByOAuthId(oauthId) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = 'SELECT * FROM users WHERE oauth_id = ? AND is_active = 1';
            db.get(sql, [oauthId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    static findByEmail(email) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = 'SELECT * FROM users WHERE email = ? AND is_active = 1';
            db.get(sql, [email], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    static findById(id) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = 'SELECT * FROM users WHERE id = ? AND is_active = 1';
            db.get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    static updateRole(userId, role, updatedBy) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = `
                UPDATE users
                SET role = ?, updated_at = datetime('now')
                WHERE id = ?
                RETURNING *
            `;

            db.get(sql, [role, userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    // Log the role change
                    this.logAudit(updatedBy, 'UPDATE_ROLE', 'user', userId, { newRole: role });
                    resolve(row);
                }
            });
        });
    }

    static getAllUsers() {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = 'SELECT id, email, name, department, role, last_login, created_at FROM users WHERE is_active = 1 ORDER BY name';
            db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    static logAudit(userId, action, resourceType, resourceId, details = {}) {
        const db = getDatabase();
        const sql = `
            INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
            VALUES (?, ?, ?, ?, ?)
        `;

        db.run(sql, [userId, action, resourceType, resourceId, JSON.stringify(details)], (err) => {
            if (err) {
                console.error('Failed to log audit event:', err);
            }
        });
    }
}

module.exports = User;