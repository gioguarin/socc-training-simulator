const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const Scenario = require('../models/Scenario');

const router = express.Router();

// Get all approved scenarios
router.get('/', async (req, res) => {
  try {
    const scenarios = await Scenario.getApprovedScenarios();
    res.json(scenarios);
  } catch (error) {
    console.error('Get scenarios error:', error);
    res.status(500).json({ error: 'Failed to get scenarios' });
  }
});

// Get scenarios by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const scenarios = await Scenario.getByCategory(category);
    res.json(scenarios);
  } catch (error) {
    console.error('Get scenarios by category error:', error);
    res.status(500).json({ error: 'Failed to get scenarios' });
  }
});

// Get all available categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Scenario.getCategories();
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// Submit a new scenario (authenticated users)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, category, difficulty, callerScript, falseInfo, responderGoals } = req.body;
    const submittedBy = req.user.id;

    // Validate required fields
    if (!title || !category || !callerScript || !responderGoals) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate responderGoals is an array
    if (!Array.isArray(responderGoals) || responderGoals.length === 0) {
      return res.status(400).json({ error: 'Responder goals must be a non-empty array' });
    }

    const scenario = await Scenario.create(
      title,
      category,
      difficulty || 'medium',
      callerScript,
      falseInfo,
      responderGoals,
      submittedBy
    );

    res.status(201).json(scenario);
  } catch (error) {
    console.error('Create scenario error:', error);
    res.status(500).json({ error: 'Failed to create scenario' });
  }
});

// Admin routes for scenario management

// Get pending scenarios (admin/trainer only)
router.get('/pending', authenticateToken, requireRole('trainer'), async (req, res) => {
  try {
    const scenarios = await Scenario.getPendingScenarios();
    res.json(scenarios);
  } catch (error) {
    console.error('Get pending scenarios error:', error);
    res.status(500).json({ error: 'Failed to get pending scenarios' });
  }
});

// Approve a scenario (admin/trainer only)
router.post('/:id/approve', authenticateToken, requireRole('trainer'), async (req, res) => {
  try {
    const { id } = req.params;
    const approvedBy = req.user.id;

    const scenario = await Scenario.approveScenario(id, approvedBy);
    res.json({ message: 'Scenario approved successfully', scenario });
  } catch (error) {
    console.error('Approve scenario error:', error);

    if (error.message === 'Scenario not found') {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    res.status(500).json({ error: 'Failed to approve scenario' });
  }
});

// Reject a scenario (admin/trainer only)
router.post('/:id/reject', authenticateToken, requireRole('trainer'), async (req, res) => {
  try {
    const { id } = req.params;
    const rejectedBy = req.user.id;
    const { reason } = req.body;

    await Scenario.rejectScenario(id, rejectedBy, reason);
    res.json({ message: 'Scenario rejected and deleted' });
  } catch (error) {
    console.error('Reject scenario error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    res.status(500).json({ error: 'Failed to reject scenario' });
  }
});

// Update a scenario (admin only)
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, difficulty, callerScript, falseInfo, responderGoals } = req.body;

    // This would require additional methods in the Scenario model
    // For now, return not implemented
    res.status(501).json({ error: 'Scenario update not implemented yet' });
  } catch (error) {
    console.error('Update scenario error:', error);
    res.status(500).json({ error: 'Failed to update scenario' });
  }
});

// Delete a scenario (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // This would require additional methods in the Scenario model
    // For now, return not implemented
    res.status(501).json({ error: 'Scenario deletion not implemented yet' });
  } catch (error) {
    console.error('Delete scenario error:', error);
    res.status(500).json({ error: 'Failed to delete scenario' });
  }
});

module.exports = router;