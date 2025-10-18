const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const GameSession = require('../models/GameSession');
const InviteCode = require('../models/InviteCode');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole('admin'));

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Update user role
router.put('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const updatedBy = req.user.id;

    if (!['admin', 'trainer', 'trainee'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.updateRole(id, role, updatedBy);
    res.json({ message: 'User role updated successfully', user });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Get system statistics
router.get('/stats', async (req, res) => {
  try {
    // This would require additional database queries
    // For now, return mock statistics
    const stats = {
      totalUsers: 150,
      activeUsers: 45,
      totalScenarios: 25,
      approvedScenarios: 20,
      pendingScenarios: 5,
      totalGameSessions: 320,
      completedSessions: 280,
      averageSessionDuration: 15, // minutes
      topCategories: [
        { category: 'Phishing', count: 45 },
        { category: 'Social Engineering', count: 32 },
        { category: 'Ransomware', count: 28 }
      ]
    };

    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Get recent game sessions
router.get('/sessions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    // This would require additional database queries
    // For now, return mock data
    const sessions = [
      {
        id: 1,
        sessionId: 'session-123',
        scenarioTitle: 'Phishing Call',
        status: 'completed',
        startedAt: '2024-01-15T10:30:00Z',
        endedAt: '2024-01-15T10:45:00Z',
        participants: [
          { name: 'John Doe', role: 'responder', score: 8 },
          { name: 'Jane Smith', role: 'caller', score: 9 }
        ]
      }
    ];

    res.json(sessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Get session details
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await GameSession.getSessionDetails(sessionId);
    res.json(session);
  } catch (error) {
    console.error('Get session details error:', error);

    if (error.message === 'Session not found') {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.status(500).json({ error: 'Failed to get session details' });
  }
});

// Get audit log
router.get('/audit', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    // This would require additional database queries
    // For now, return mock audit data
    const auditLog = [
      {
        id: 1,
        userId: 1,
        userName: 'John Doe',
        action: 'LOGIN',
        resourceType: 'user',
        resourceId: 1,
        details: {},
        timestamp: '2024-01-15T10:30:00Z',
        ipAddress: '192.168.1.100'
      },
      {
        id: 2,
        userId: 2,
        userName: 'Jane Smith',
        action: 'CREATE_SCENARIO',
        resourceType: 'scenario',
        resourceId: 5,
        details: { title: 'New Phishing Scenario' },
        timestamp: '2024-01-15T11:15:00Z',
        ipAddress: '192.168.1.101'
      }
    ];

    res.json({
      logs: auditLog,
      total: 150,
      limit,
      offset
    });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

// Export data (admin only)
router.get('/export/:type', async (req, res) => {
  try {
    const { type } = req.params;

    // This would implement data export functionality
    // For now, return not implemented
    res.status(501).json({ error: `${type} export not implemented yet` });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Invite Code Management

// Get all invite codes
router.get('/invite-codes', async (req, res) => {
    try {
        const codes = await InviteCode.getAllCodes();
        res.json(codes);
    } catch (error) {
        console.error('Get invite codes error:', error);
        res.status(500).json({ error: 'Failed to get invite codes' });
    }
});

// Create new invite code
router.post('/invite-codes', async (req, res) => {
    try {
        const { email, role, department, expiresInDays } = req.body;
        const createdBy = req.user.id;

        const inviteCode = await InviteCode.create(
            email,
            role || 'trainee',
            department,
            createdBy,
            expiresInDays || 30
        );

        res.status(201).json({
            message: 'Invite code created successfully',
            inviteCode: {
                id: inviteCode.id,
                code: inviteCode.code,
                email: inviteCode.email,
                role: inviteCode.role,
                department: inviteCode.department,
                expiresAt: inviteCode.expires_at
            }
        });
    } catch (error) {
        console.error('Create invite code error:', error);
        res.status(500).json({ error: 'Failed to create invite code' });
    }
});

// Delete invite code
router.delete('/invite-codes/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await InviteCode.deleteCode(id);

        res.json({ message: 'Invite code deleted successfully' });
    } catch (error) {
        console.error('Delete invite code error:', error);

        if (error.message.includes('not found')) {
            return res.status(404).json({ error: 'Invite code not found' });
        }
        if (error.message.includes('used')) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to delete invite code' });
    }
});

module.exports = router;