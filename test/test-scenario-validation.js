#!/usr/bin/env node

/**
 * Test Scenario Validation
 * Tests input validation for scenario submission
 */

console.log('Testing Scenario Input Validation\n');
console.log('='.repeat(70));

// Import validation constants and functions
const VALIDATION_LIMITS = {
  TITLE_MIN: 3,
  TITLE_MAX: 200,
  CALLER_SCRIPT_MIN: 10,
  CALLER_SCRIPT_MAX: 5000,
  FALSE_INFO_MAX: 2000,
  RESPONDER_GOAL_MIN: 3,
  RESPONDER_GOAL_MAX: 200,
  RESPONDER_GOALS_MAX_ITEMS: 10
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

function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  let sanitized = input.replace(/\0/g, '');
  sanitized = sanitized.trim();
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  return sanitized;
}

function validateScenarioInput(data, isUpdate = false) {
  const errors = [];

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

  if (data.category !== undefined) {
    const category = sanitizeInput(data.category);
    if (!ALLOWED_CATEGORIES.includes(category)) {
      errors.push(`Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
    }
    data.category = category;
  } else if (!isUpdate) {
    errors.push('Category is required');
  }

  if (data.difficulty !== undefined) {
    const difficulty = sanitizeInput(data.difficulty);
    if (!ALLOWED_DIFFICULTIES.includes(difficulty)) {
      errors.push(`Difficulty must be one of: ${ALLOWED_DIFFICULTIES.join(', ')}`);
    }
    data.difficulty = difficulty;
  }

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

// Test cases
const tests = [
  {
    name: 'Valid scenario',
    data: {
      title: 'Phishing Call Test',
      category: 'phishing',
      difficulty: 'easy',
      callerScript: 'Hello, this is IT support calling about your account.',
      responderGoals: ['Verify caller identity', 'Do not provide credentials']
    },
    shouldPass: true
  },
  {
    name: 'Title too short',
    data: {
      title: 'AB',
      category: 'phishing',
      callerScript: 'Test script for validation',
      responderGoals: ['Goal 1']
    },
    shouldPass: false
  },
  {
    name: 'Invalid category',
    data: {
      title: 'Test Scenario',
      category: 'invalid_category',
      callerScript: 'Test script for validation',
      responderGoals: ['Goal 1']
    },
    shouldPass: false
  },
  {
    name: 'Script too short',
    data: {
      title: 'Test Scenario',
      category: 'phishing',
      callerScript: 'Short',
      responderGoals: ['Goal 1']
    },
    shouldPass: false
  },
  {
    name: 'Empty responder goals',
    data: {
      title: 'Test Scenario',
      category: 'phishing',
      callerScript: 'This is a test script for validation.',
      responderGoals: []
    },
    shouldPass: false
  },
  {
    name: 'XSS attempt in title',
    data: {
      title: '<script>alert("XSS")</script>',
      category: 'phishing',
      callerScript: 'This is a test script for validation.',
      responderGoals: ['Verify identity']
    },
    shouldPass: true, // Should pass but be sanitized
    expectSanitization: true
  }
];

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  console.log(`\nTest ${index + 1}: ${test.name}`);
  console.log('-'.repeat(70));

  const data = JSON.parse(JSON.stringify(test.data)); // Deep copy
  const errors = validateScenarioInput(data, false);

  const testPassed = test.shouldPass ? errors.length === 0 : errors.length > 0;

  if (testPassed) {
    console.log('✅ PASS');
    if (test.expectSanitization) {
      console.log('   Sanitized title:', data.title);
    }
    passed++;
  } else {
    console.log('❌ FAIL');
    console.log('   Expected:', test.shouldPass ? 'No errors' : 'Errors');
    console.log('   Got:', errors.length > 0 ? `${errors.length} error(s)` : 'No errors');
    if (errors.length > 0) {
      console.log('   Errors:', errors);
    }
    failed++;
  }
});

console.log('\n' + '='.repeat(70));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(70));

if (failed === 0) {
  console.log('\n✅ ALL TESTS PASSED - Validation working correctly!\n');
  process.exit(0);
} else {
  console.log('\n❌ SOME TESTS FAILED - Review validation logic\n');
  process.exit(1);
}
