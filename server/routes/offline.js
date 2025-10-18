const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const OfflineSession = require('../models/OfflineSession');
const Scenario = require('../models/Scenario');

const router = express.Router();

/**
 * Get player assignment by access code (public endpoint)
 * GET /api/offline/assignment/:accessCode
 * No authentication required - uses access code
 * MUST BE BEFORE authenticateToken middleware
 */
router.get('/assignment/:accessCode', async (req, res) => {
    try {
        const { accessCode } = req.params;

        const assignment = await OfflineSession.getPlayerAssignment(accessCode);

        // Get scenario details if assigned
        let scenario = null;
        if (assignment.scenario_id) {
            const scenarios = await Scenario.getApprovedScenarios();
            scenario = scenarios.find(s => s.id === assignment.scenario_id);
        }

        res.json({
            playerName: assignment.player_name,
            role: assignment.role,
            sessionName: assignment.session_name,
            pairedWith: assignment.paired_player_name,
            pairedRole: assignment.paired_role,
            scenario: scenario || {
                title: 'Random Scenario',
                description: 'A scenario will be assigned during the training session'
            },
            accessCode: assignment.access_code
        });
    } catch (error) {
        if (error.message === 'Invalid access code') {
            return res.status(404).json({ error: 'Invalid access code' });
        }
        console.error('Get assignment error:', error);
        res.status(500).json({ error: 'Failed to get assignment' });
    }
});

// All routes below require authentication
router.use(authenticateToken);

/**
 * Create a new offline session
 * POST /api/offline/sessions
 * Requires: trainer or admin role
 */
router.post('/sessions', requireRole(['trainer', 'admin']), async (req, res) => {
    try {
        const { sessionName } = req.body;

        if (!sessionName || sessionName.trim().length === 0) {
            return res.status(400).json({ error: 'Session name is required' });
        }

        if (sessionName.length > 100) {
            return res.status(400).json({ error: 'Session name must be 100 characters or less' });
        }

        const session = await OfflineSession.create(
            sessionName.trim(),
            req.user.id
        );

        res.status(201).json({
            message: 'Offline session created successfully',
            session
        });
    } catch (error) {
        console.error('Create offline session error:', error);
        res.status(500).json({ error: 'Failed to create offline session' });
    }
});

/**
 * Get all sessions created by the current user
 * GET /api/offline/sessions
 * Requires: trainer or admin role
 */
router.get('/sessions', requireRole(['trainer', 'admin']), async (req, res) => {
    try {
        const sessions = await OfflineSession.getByCreator(req.user.id);
        res.json({ sessions });
    } catch (error) {
        console.error('Get offline sessions error:', error);
        res.status(500).json({ error: 'Failed to get offline sessions' });
    }
});

/**
 * Get a specific session with players
 * GET /api/offline/sessions/:id
 * Requires: trainer or admin role
 */
router.get('/sessions/:id', requireRole(['trainer', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;

        const session = await OfflineSession.getById(id);

        // Verify user owns this session
        if (session.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const players = await OfflineSession.getPlayers(id);

        res.json({
            session,
            players
        });
    } catch (error) {
        if (error.message === 'Session not found') {
            return res.status(404).json({ error: 'Session not found' });
        }
        console.error('Get offline session error:', error);
        res.status(500).json({ error: 'Failed to get offline session' });
    }
});

/**
 * Add a player to a session
 * POST /api/offline/sessions/:id/players
 * Requires: trainer or admin role
 */
router.post('/sessions/:id/players', requireRole(['trainer', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { playerName } = req.body;

        if (!playerName || playerName.trim().length === 0) {
            return res.status(400).json({ error: 'Player name is required' });
        }

        if (playerName.length > 100) {
            return res.status(400).json({ error: 'Player name must be 100 characters or less' });
        }

        // Verify session exists and user owns it
        const session = await OfflineSession.getById(id);
        if (session.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (session.status !== 'preparing') {
            return res.status(400).json({ error: 'Cannot add players to a session that has already started' });
        }

        const player = await OfflineSession.addPlayer(id, playerName.trim());

        res.status(201).json({
            message: 'Player added successfully',
            player
        });
    } catch (error) {
        if (error.message === 'Session not found') {
            return res.status(404).json({ error: 'Session not found' });
        }
        console.error('Add player error:', error);
        res.status(500).json({ error: 'Failed to add player' });
    }
});

/**
 * Remove a player from a session
 * DELETE /api/offline/players/:playerId
 * Requires: trainer or admin role
 */
router.delete('/players/:playerId', requireRole(['trainer', 'admin']), async (req, res) => {
    try {
        const { playerId } = req.params;

        await OfflineSession.removePlayer(playerId);

        res.json({ message: 'Player removed successfully' });
    } catch (error) {
        console.error('Remove player error:', error);
        res.status(500).json({ error: 'Failed to remove player' });
    }
});

/**
 * Start a session - pair up players and assign roles
 * POST /api/offline/sessions/:id/start
 * Requires: trainer or admin role
 */
router.post('/sessions/:id/start', requireRole(['trainer', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { scenarioId } = req.body;

        // Verify session exists and user owns it
        const session = await OfflineSession.getById(id);
        if (session.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (session.status !== 'preparing') {
            return res.status(400).json({ error: 'Session has already been started' });
        }

        // Verify scenario exists if provided
        let scenario = null;
        if (scenarioId) {
            const scenarios = await Scenario.getApprovedScenarios();
            scenario = scenarios.find(s => s.id === scenarioId);
            if (!scenario) {
                return res.status(404).json({ error: 'Scenario not found' });
            }
        }

        const pairs = await OfflineSession.startSession(id, scenarioId);

        // Get updated players with assignments
        const players = await OfflineSession.getPlayers(id);

        res.json({
            message: 'Session started successfully',
            pairs: players,
            scenario
        });
    } catch (error) {
        if (error.message.includes('Need at least 2 players')) {
            return res.status(400).json({ error: 'Need at least 2 players to start session' });
        }
        if (error.message.includes('Need an even number')) {
            return res.status(400).json({ error: 'Need an even number of players for pairing' });
        }
        if (error.message === 'Session not found') {
            return res.status(404).json({ error: 'Session not found' });
        }
        console.error('Start session error:', error);
        res.status(500).json({ error: 'Failed to start session' });
    }
});

/**
 * Complete a session
 * POST /api/offline/sessions/:id/complete
 * Requires: trainer or admin role
 */
router.post('/sessions/:id/complete', requireRole(['trainer', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;

        // Verify session exists and user owns it
        const session = await OfflineSession.getById(id);
        if (session.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        await OfflineSession.completeSession(id);

        res.json({ message: 'Session completed successfully' });
    } catch (error) {
        if (error.message === 'Session not found') {
            return res.status(404).json({ error: 'Session not found' });
        }
        console.error('Complete session error:', error);
        res.status(500).json({ error: 'Failed to complete session' });
    }
});

/**
 * Delete a session
 * DELETE /api/offline/sessions/:id
 * Requires: trainer or admin role
 */
router.delete('/sessions/:id', requireRole(['trainer', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;

        // Verify session exists and user owns it
        const session = await OfflineSession.getById(id);
        if (session.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        await OfflineSession.deleteSession(id);

        res.json({ message: 'Session deleted successfully' });
    } catch (error) {
        if (error.message === 'Session not found') {
            return res.status(404).json({ error: 'Session not found' });
        }
        if (error.message.includes('Can only delete')) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Delete session error:', error);
        res.status(500).json({ error: 'Failed to delete session' });
    }
});

module.exports = router;
