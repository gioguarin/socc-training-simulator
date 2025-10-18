const { getDatabase } = require('../database/init');
const crypto = require('crypto');

class OfflineSession {
    /**
     * Create a new offline session
     */
    static async create(sessionName, createdBy, scenarioId = null) {
        const db = getDatabase();

        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO offline_sessions (session_name, created_by, scenario_id, status)
                VALUES (?, ?, ?, 'preparing')
            `;

            db.run(sql, [sessionName, createdBy, scenarioId], function(err) {
                if (err) reject(err);
                else {
                    db.get('SELECT * FROM offline_sessions WHERE id = ?', [this.lastID], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                }
            });
        });
    }

    /**
     * Get all sessions created by a user
     */
    static async getByCreator(userId) {
        const db = getDatabase();

        return new Promise((resolve, reject) => {
            const sql = `
                SELECT
                    os.*,
                    u.name as creator_name,
                    COUNT(op.id) as player_count
                FROM offline_sessions os
                LEFT JOIN users u ON os.created_by = u.id
                LEFT JOIN offline_players op ON os.id = op.session_id
                WHERE os.created_by = ?
                GROUP BY os.id
                ORDER BY os.created_at DESC
            `;

            db.all(sql, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    /**
     * Get session by ID
     */
    static async getById(sessionId) {
        const db = getDatabase();

        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM offline_sessions WHERE id = ?';

            db.get(sql, [sessionId], (err, row) => {
                if (err) reject(err);
                else if (!row) reject(new Error('Session not found'));
                else resolve(row);
            });
        });
    }

    /**
     * Add a player to the session
     */
    static async addPlayer(sessionId, playerName) {
        const db = getDatabase();

        // Generate unique access code
        const accessCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO offline_players (session_id, player_name, access_code)
                VALUES (?, ?, ?)
            `;

            db.run(sql, [sessionId, playerName, accessCode], function(err) {
                if (err) reject(err);
                else {
                    db.get('SELECT * FROM offline_players WHERE id = ?', [this.lastID], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                }
            });
        });
    }

    /**
     * Remove a player from the session
     */
    static async removePlayer(playerId) {
        const db = getDatabase();

        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM offline_players WHERE id = ?';

            db.run(sql, [playerId], function(err) {
                if (err) reject(err);
                else resolve({ deleted: this.changes });
            });
        });
    }

    /**
     * Get all players in a session
     */
    static async getPlayers(sessionId) {
        const db = getDatabase();

        return new Promise((resolve, reject) => {
            const sql = `
                SELECT
                    op.*,
                    paired.player_name as paired_player_name
                FROM offline_players op
                LEFT JOIN offline_players paired ON op.paired_with = paired.id
                WHERE op.session_id = ?
                ORDER BY op.created_at ASC
            `;

            db.all(sql, [sessionId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    /**
     * Start the session - pair up players and assign roles
     */
    static async startSession(sessionId, scenarioId) {
        const db = getDatabase();

        // Get all players
        const players = await this.getPlayers(sessionId);

        if (players.length < 2) {
            throw new Error('Need at least 2 players to start session');
        }

        if (players.length % 2 !== 0) {
            throw new Error('Need an even number of players for pairing');
        }

        // Shuffle players for random pairing
        const shuffled = [...players].sort(() => Math.random() - 0.5);

        // Pair up players
        const pairs = [];
        for (let i = 0; i < shuffled.length; i += 2) {
            const player1 = shuffled[i];
            const player2 = shuffled[i + 1];

            // Randomly assign roles
            const roles = Math.random() < 0.5
                ? ['caller', 'responder']
                : ['responder', 'caller'];

            pairs.push({
                player1: { ...player1, role: roles[0] },
                player2: { ...player2, role: roles[1] }
            });
        }

        // Update database with pairings
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                try {
                    // Update session status
                    db.run(
                        'UPDATE offline_sessions SET status = ?, started_at = CURRENT_TIMESTAMP, scenario_id = ? WHERE id = ?',
                        ['active', scenarioId, sessionId]
                    );

                    // Update player pairings and roles
                    pairs.forEach(pair => {
                        db.run(
                            'UPDATE offline_players SET role = ?, paired_with = ? WHERE id = ?',
                            [pair.player1.role, pair.player2.id, pair.player1.id]
                        );
                        db.run(
                            'UPDATE offline_players SET role = ?, paired_with = ? WHERE id = ?',
                            [pair.player2.role, pair.player1.id, pair.player2.id]
                        );
                    });

                    db.run('COMMIT', (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            reject(err);
                        } else {
                            resolve(pairs);
                        }
                    });
                } catch (error) {
                    db.run('ROLLBACK');
                    reject(error);
                }
            });
        });
    }

    /**
     * Get player assignment by access code
     */
    static async getPlayerAssignment(accessCode) {
        const db = getDatabase();

        return new Promise((resolve, reject) => {
            const sql = `
                SELECT
                    op.*,
                    os.scenario_id,
                    os.session_name,
                    paired.player_name as paired_player_name,
                    paired.role as paired_role
                FROM offline_players op
                JOIN offline_sessions os ON op.session_id = os.id
                LEFT JOIN offline_players paired ON op.paired_with = paired.id
                WHERE op.access_code = ?
            `;

            db.get(sql, [accessCode], (err, row) => {
                if (err) reject(err);
                else if (!row) reject(new Error('Invalid access code'));
                else {
                    // Mark as viewed
                    db.run('UPDATE offline_players SET assignment_viewed = 1 WHERE id = ?', [row.id]);
                    resolve(row);
                }
            });
        });
    }

    /**
     * Complete a session
     */
    static async completeSession(sessionId) {
        const db = getDatabase();

        return new Promise((resolve, reject) => {
            const sql = 'UPDATE offline_sessions SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?';

            db.run(sql, ['completed', sessionId], function(err) {
                if (err) reject(err);
                else resolve({ updated: this.changes });
            });
        });
    }

    /**
     * Delete a session (only if in preparing status)
     */
    static async deleteSession(sessionId) {
        const db = getDatabase();

        return new Promise((resolve, reject) => {
            // Check status first
            db.get('SELECT status FROM offline_sessions WHERE id = ?', [sessionId], (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    reject(new Error('Session not found'));
                } else if (row.status !== 'preparing') {
                    reject(new Error('Can only delete sessions in preparing status'));
                } else {
                    db.run('DELETE FROM offline_sessions WHERE id = ?', [sessionId], function(err) {
                        if (err) reject(err);
                        else resolve({ deleted: this.changes });
                    });
                }
            });
        });
    }
}

module.exports = OfflineSession;
