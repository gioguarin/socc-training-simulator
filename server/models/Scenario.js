const { getDatabase } = require('../database/init');
const User = require('./User');

class Scenario {
    static create(title, category, difficulty, callerScript, falseInfo, responderGoals, submittedBy) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = `
                INSERT INTO scenarios (title, category, difficulty, caller_script, false_info, responder_goals, submitted_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                RETURNING *
            `;

            const goalsJson = JSON.stringify(responderGoals);

            db.get(sql, [title, category, difficulty, callerScript, falseInfo, goalsJson, submittedBy], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    // Log the scenario creation
                    User.logAudit(submittedBy, 'CREATE_SCENARIO', 'scenario', row.id, { title, category });
                    resolve(row);
                }
            });
        });
    }

    static getApprovedScenarios() {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = 'SELECT * FROM scenarios WHERE is_approved = 1 ORDER BY created_at DESC';
            db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Parse responder_goals JSON
                    const scenarios = rows.map(row => ({
                        ...row,
                        responder_goals: JSON.parse(row.responder_goals)
                    }));
                    resolve(scenarios);
                }
            });
        });
    }

    static getPendingScenarios() {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = `
                SELECT s.*, u.name as submitted_by_name
                FROM scenarios s
                JOIN users u ON s.submitted_by = u.id
                WHERE s.is_approved = 0
                ORDER BY s.created_at DESC
            `;
            db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const scenarios = rows.map(row => ({
                        ...row,
                        responder_goals: JSON.parse(row.responder_goals)
                    }));
                    resolve(scenarios);
                }
            });
        });
    }

    static approveScenario(scenarioId, approvedBy) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = `
                UPDATE scenarios
                SET is_approved = 1, approved_by = ?, updated_at = datetime('now')
                WHERE id = ?
                RETURNING *
            `;

            db.get(sql, [approvedBy, scenarioId], (err, row) => {
                if (err) {
                    reject(err);
                } else if (row) {
                    // Log the approval
                    User.logAudit(approvedBy, 'APPROVE_SCENARIO', 'scenario', scenarioId, { title: row.title });
                    resolve({
                        ...row,
                        responder_goals: JSON.parse(row.responder_goals)
                    });
                } else {
                    reject(new Error('Scenario not found'));
                }
            });
        });
    }

    static rejectScenario(scenarioId, rejectedBy, reason = '') {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = 'DELETE FROM scenarios WHERE id = ? AND is_approved = 0';

            db.run(sql, [scenarioId], function(err) {
                if (err) {
                    reject(err);
                } else if (this.changes > 0) {
                    // Log the rejection
                    User.logAudit(rejectedBy, 'REJECT_SCENARIO', 'scenario', scenarioId, { reason });
                    resolve({ deleted: true });
                } else {
                    reject(new Error('Scenario not found or already approved'));
                }
            });
        });
    }

    static getByCategory(category) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = 'SELECT * FROM scenarios WHERE category = ? AND is_approved = 1 ORDER BY created_at DESC';
            db.all(sql, [category], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const scenarios = rows.map(row => ({
                        ...row,
                        responder_goals: JSON.parse(row.responder_goals)
                    }));
                    resolve(scenarios);
                }
            });
        });
    }

    static getCategories() {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const sql = 'SELECT DISTINCT category FROM scenarios WHERE is_approved = 1 ORDER BY category';
            db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => row.category));
                }
            });
        });
    }
}

module.exports = Scenario;