const { getDatabase } = require('../database/init');
const User = require('./User');

class GameSession {
    static create(sessionId, scenarioId = null) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = 'INSERT INTO game_sessions (session_id, scenario_id) VALUES (?, ?) RETURNING *';
            db.get(sql, [sessionId, scenarioId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    static addParticipant(gameSessionId, userId, role) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = `
                INSERT INTO game_participants (game_session_id, user_id, role)
                VALUES (?, ?, ?)
                RETURNING *
            `;

            db.get(sql, [gameSessionId, userId, role], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    // Log participation
                    User.logAudit(userId, 'JOIN_GAME', 'game_session', gameSessionId, { role });
                    resolve(row);
                }
            });
        });
    }

    static endSession(sessionId, endedBy = null) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = `
                UPDATE game_sessions
                SET status = 'completed', ended_at = datetime('now')
                WHERE session_id = ?
                RETURNING *
            `;

            db.get(sql, [sessionId], (err, row) => {
                if (err) {
                    reject(err);
                } else if (row) {
                    // Update participant departure times
                    this.updateParticipantDeparture(sessionId);

                    // Log session end
                    if (endedBy) {
                        User.logAudit(endedBy, 'END_GAME', 'game_session', row.id, { sessionId });
                    }

                    resolve(row);
                } else {
                    reject(new Error('Session not found'));
                }
            });
        });
    }

    static updateParticipantDeparture(sessionId) {
        const db = getDatabase();
        const sql = `
            UPDATE game_participants
            SET left_at = datetime('now')
            WHERE game_session_id = (SELECT id FROM game_sessions WHERE session_id = ?)
            AND left_at IS NULL
        `;

        db.run(sql, [sessionId], (err) => {
            if (err) {
                console.error('Failed to update participant departure:', err);
            }
        });
    }

    static recordPerformance(gameSessionId, userId, score, feedback = null) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = `
                UPDATE game_participants
                SET performance_score = ?, feedback = ?, left_at = datetime('now')
                WHERE game_session_id = ? AND user_id = ?
                RETURNING *
            `;

            db.get(sql, [score, feedback, gameSessionId, userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    // Log performance recording
                    User.logAudit(userId, 'RECORD_PERFORMANCE', 'game_participant', row.id, { score, feedback });
                    resolve(row);
                }
            });
        });
    }

    static getUserParticipationHistory(userId, limit = 50) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = `
                SELECT
                    gs.session_id,
                    gs.started_at,
                    gs.ended_at,
                    gp.role,
                    gp.performance_score,
                    gp.feedback,
                    s.title as scenario_title,
                    s.category as scenario_category
                FROM game_sessions gs
                JOIN game_participants gp ON gs.id = gp.game_session_id
                LEFT JOIN scenarios s ON gs.scenario_id = s.id
                WHERE gp.user_id = ?
                ORDER BY gs.started_at DESC
                LIMIT ?
            `;

            db.all(sql, [userId, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    static getSessionDetails(sessionId) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = `
                SELECT
                    gs.*,
                    s.title as scenario_title,
                    s.category as scenario_category,
                    json_group_array(
                        json_object(
                            'user_id', gp.user_id,
                            'role', gp.role,
                            'performance_score', gp.performance_score,
                            'feedback', gp.feedback,
                            'user_name', u.name,
                            'user_email', u.email
                        )
                    ) as participants
                FROM game_sessions gs
                LEFT JOIN scenarios s ON gs.scenario_id = s.id
                LEFT JOIN game_participants gp ON gs.id = gp.game_session_id
                LEFT JOIN users u ON gp.user_id = u.id
                WHERE gs.session_id = ?
                GROUP BY gs.id
            `;

            db.get(sql, [sessionId], (err, row) => {
                if (err) {
                    reject(err);
                } else if (row) {
                    resolve({
                        ...row,
                        participants: JSON.parse(row.participants).filter(p => p.user_id !== null)
                    });
                } else {
                    reject(new Error('Session not found'));
                }
            });
        });
    }

    static saveChatMessage(gameSessionId, userId, message) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = 'INSERT INTO chat_messages (game_session_id, user_id, message) VALUES (?, ?, ?)';
            db.run(sql, [gameSessionId, userId, message], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    static getSessionChat(sessionId) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = `
                SELECT
                    cm.message,
                    cm.timestamp,
                    u.name as user_name,
                    gp.role
                FROM chat_messages cm
                JOIN users u ON cm.user_id = u.id
                JOIN game_participants gp ON cm.user_id = gp.user_id AND cm.game_session_id = gp.game_session_id
                WHERE cm.game_session_id = (SELECT id FROM game_sessions WHERE session_id = ?)
                ORDER BY cm.timestamp ASC
            `;

            db.all(sql, [sessionId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}

module.exports = GameSession;