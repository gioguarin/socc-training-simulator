const { getDatabase } = require('../database/init');
const User = require('./User');
const crypto = require('crypto');

class InviteCode {
    static generate() {
        // Generate cryptographically secure random code (10 characters, alphanumeric)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';

        // Use cryptographically secure random bytes instead of Math.random()
        const randomBytes = crypto.randomBytes(10);

        for (let i = 0; i < 10; i++) {
            code += chars.charAt(randomBytes[i] % chars.length);
        }

        return code;
    }

    static async create(email, role = 'trainee', department = null, createdBy = null, expiresInDays = 30) {
        const code = this.generate();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = `
                INSERT INTO invite_codes (code, email, role, department, expires_at, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
                RETURNING *
            `;

            db.get(sql, [code, email, role, department, expiresAt.toISOString(), createdBy], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    static async validate(code) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = `
                SELECT * FROM invite_codes
                WHERE code = ? AND is_used = 0 AND expires_at > datetime('now')
            `;

            db.get(sql, [code], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    static async markUsed(codeId, userId) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = `
                UPDATE invite_codes
                SET is_used = 1, used_by = ?, used_at = datetime('now')
                WHERE id = ?
            `;

            db.run(sql, [userId, codeId], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    }

    static async getAllCodes() {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = `
                SELECT ic.*, u.name as created_by_name, u2.name as used_by_name
                FROM invite_codes ic
                LEFT JOIN users u ON ic.created_by = u.id
                LEFT JOIN users u2 ON ic.used_by = u2.id
                ORDER BY ic.created_at DESC
            `;

            db.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    static async deleteCode(codeId) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            // Check if code is used
            const checkSql = 'SELECT is_used FROM invite_codes WHERE id = ?';
            db.get(checkSql, [codeId], (err, row) => {
                if (err) reject(err);
                else if (!row) reject(new Error('Invite code not found'));
                else if (row.is_used) reject(new Error('Cannot delete used invite code'));
                else {
                    // Delete the code
                    db.run('DELETE FROM invite_codes WHERE id = ?', [codeId], function(err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes });
                    });
                }
            });
        });
    }

    static async hasUnusedAdminCode() {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = `
                SELECT COUNT(*) as count FROM invite_codes
                WHERE role = 'admin' AND is_used = 0 AND expires_at > datetime('now')
            `;

            db.get(sql, [], (err, row) => {
                if (err) reject(err);
                else resolve(row.count > 0);
            });
        });
    }
}

module.exports = InviteCode;