const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const Scenario = require('../models/Scenario');

const router = express.Router();

// Input validation constants
const VALIDATION_LIMITS = {
  TITLE_MIN: 3,
  TITLE_MAX: 200,
  CALLER_SCRIPT_MIN: 10,
  CALLER_SCRIPT_MAX: 5000,
  FALSE_INFO_MAX: 2000,
  RESPONDER_GOAL_MIN: 3,
  RESPONDER_GOAL_MAX: 200,
  RESPONDER_GOALS_MAX_ITEMS: 10,
  REJECT_REASON_MIN: 10,
  REJECT_REASON_MAX: 500
};

const ALLOWED_CATEGORIES = [
  'phishing',
  'password_reset',
  'social_engineering',
  'ransomware',
  'account_verification',
  'tech_support',
  'other'
];

const ALLOWED_DIFFICULTIES = ['easy', 'medium', 'hard'];

// Input sanitization helper
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Basic XSS prevention - escape HTML special characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized;
}

// Validation helper
function validateScenarioInput(data, isUpdate = false) {
  const errors = [];

  // Title validation
  if (data.title !== undefined) {
    const title = sanitizeInput(data.title);
    if (!title || title.length < VALIDATION_LIMITS.TITLE_MIN) {
      errors.push(`Title must be at least ${VALIDATION_LIMITS.TITLE_MIN} characters`);
    }
    if (title.length > VALIDATION_LIMITS.TITLE_MAX) {
      errors.push(`Title must not exceed ${VALIDATION_LIMITS.TITLE_MAX} characters`);
    }
    data.title = title;
  } else if (!isUpdate) {
    errors.push('Title is required');
  }

  // Category validation
  if (data.category !== undefined) {
    const category = sanitizeInput(data.category);
    if (!ALLOWED_CATEGORIES.includes(category)) {
      errors.push(`Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
    }
    data.category = category;
  } else if (!isUpdate) {
    errors.push('Category is required');
  }

  // Difficulty validation
  if (data.difficulty !== undefined) {
    const difficulty = sanitizeInput(data.difficulty);
    if (!ALLOWED_DIFFICULTIES.includes(difficulty)) {
      errors.push(`Difficulty must be one of: ${ALLOWED_DIFFICULTIES.join(', ')}`);
    }
    data.difficulty = difficulty;
  }

  // Caller script validation
  if (data.callerScript !== undefined) {
    const callerScript = sanitizeInput(data.callerScript);
    if (!callerScript || callerScript.length < VALIDATION_LIMITS.CALLER_SCRIPT_MIN) {
      errors.push(`Caller script must be at least ${VALIDATION_LIMITS.CALLER_SCRIPT_MIN} characters`);
    }
    if (callerScript.length > VALIDATION_LIMITS.CALLER_SCRIPT_MAX) {
      errors.push(`Caller script must not exceed ${VALIDATION_LIMITS.CALLER_SCRIPT_MAX} characters`);
    }
    data.callerScript = callerScript;
  } else if (!isUpdate) {
    errors.push('Caller script is required');
  }

  // False info validation (optional field)
  if (data.falseInfo !== undefined && data.falseInfo !== null) {
    const falseInfo = sanitizeInput(data.falseInfo);
    if (falseInfo.length > VALIDATION_LIMITS.FALSE_INFO_MAX) {
      errors.push(`False info must not exceed ${VALIDATION_LIMITS.FALSE_INFO_MAX} characters`);
    }
    data.falseInfo = falseInfo;
  }

  // Responder goals validation
  if (data.responderGoals !== undefined) {
    if (!Array.isArray(data.responderGoals)) {
      errors.push('Responder goals must be an array');
    } else {
      if (data.responderGoals.length === 0) {
        errors.push('At least one responder goal is required');
      }
      if (data.responderGoals.length > VALIDATION_LIMITS.RESPONDER_GOALS_MAX_ITEMS) {
        errors.push(`Maximum ${VALIDATION_LIMITS.RESPONDER_GOALS_MAX_ITEMS} responder goals allowed`);
      }

      // Validate each goal
      const sanitizedGoals = [];
      data.responderGoals.forEach((goal, index) => {
        const sanitizedGoal = sanitizeInput(goal);
        if (!sanitizedGoal || sanitizedGoal.length < VALIDATION_LIMITS.RESPONDER_GOAL_MIN) {
          errors.push(`Goal ${index + 1} must be at least ${VALIDATION_LIMITS.RESPONDER_GOAL_MIN} characters`);
        }
        if (sanitizedGoal.length > VALIDATION_LIMITS.RESPONDER_GOAL_MAX) {
          errors.push(`Goal ${index + 1} must not exceed ${VALIDATION_LIMITS.RESPONDER_GOAL_MAX} characters`);
        }
        sanitizedGoals.push(sanitizedGoal);
      });

      data.responderGoals = sanitizedGoals;
    }
  } else if (!isUpdate) {
    errors.push('Responder goals are required');
  }

  return errors;
}

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
    let { category } = req.params;

    // Validate category parameter
    category = sanitizeInput(category);
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: 'Invalid category',
        allowedCategories: ALLOWED_CATEGORIES
      });
    }

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
    const data = {
      title: req.body.title,
      category: req.body.category,
      difficulty: req.body.difficulty || 'medium',
      callerScript: req.body.callerScript,
      falseInfo: req.body.falseInfo,
      responderGoals: req.body.responderGoals
    };

    // Validate and sanitize input
    const validationErrors = validateScenarioInput(data, false);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    const submittedBy = req.user.id;

    const scenario = await Scenario.create(
      data.title,
      data.category,
      data.difficulty,
      data.callerScript,
      data.falseInfo,
      data.responderGoals,
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
    let { reason } = req.body;

    // Validate rejection reason
    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    reason = sanitizeInput(reason);

    if (reason.length < VALIDATION_LIMITS.REJECT_REASON_MIN) {
      return res.status(400).json({
        error: `Rejection reason must be at least ${VALIDATION_LIMITS.REJECT_REASON_MIN} characters`
      });
    }

    if (reason.length > VALIDATION_LIMITS.REJECT_REASON_MAX) {
      return res.status(400).json({
        error: `Rejection reason must not exceed ${VALIDATION_LIMITS.REJECT_REASON_MAX} characters`
      });
    }

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
    const data = {
      title: req.body.title,
      category: req.body.category,
      difficulty: req.body.difficulty,
      callerScript: req.body.callerScript,
      falseInfo: req.body.falseInfo,
      responderGoals: req.body.responderGoals
    };

    // Validate and sanitize input (isUpdate = true allows partial updates)
    const validationErrors = validateScenarioInput(data, true);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

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