const express = require('express');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2').Strategy;
const rateLimit = require('express-rate-limit');
const { getDatabase } = require('../database/init');
const { handleOAuthCallback, generateToken, authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const InviteCode = require('../models/InviteCode');
const { validateEmail } = require('../utils/emailValidation');

const router = express.Router();

// Authentication-specific rate limiting
// Stricter limits for login/register to prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per 15 minutes
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all attempts, even successful ones
});

// Very strict rate limiter for repeated failed attempts
const strictAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 failed attempts per hour
  message: { error: 'Too many failed authentication attempts. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
});

// Check registration mode (for frontend to determine if invite code is required)
router.get('/registration-mode', (req, res) => {
    const allowOpenRegistration = process.env.ALLOW_OPEN_REGISTRATION === 'true';
    const requireInviteCodes = process.env.REQUIRE_INVITE_CODES !== 'false';

    res.json({
        allowOpenRegistration,
        requiresInviteCode: !allowOpenRegistration && requireInviteCodes,
        message: allowOpenRegistration
            ? 'Open registration enabled - invite code optional'
            : 'Invite code required for registration'
    });
});

// Register with invite code
router.post('/register', authLimiter, strictAuthLimiter, async (req, res) => {
    try {
        const { name, email, password, inviteCode } = req.body;

        // Check if open registration is allowed (for testing/development)
        const allowOpenRegistration = process.env.ALLOW_OPEN_REGISTRATION === 'true';

        // If no invite code provided and open registration is enabled, use simple registration
        if (!inviteCode && allowOpenRegistration) {
            return simpleRegistration(req, res);
        }

        // Validate input
        if (!name || !email || !password || !inviteCode) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Comprehensive email validation
        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) {
            return res.status(400).json({
                error: 'Invalid email',
                details: emailValidation.errors
            });
        }

        // Use normalized email
        const normalizedEmail = emailValidation.normalized;

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        // Validate invite code
        const invite = await InviteCode.validate(inviteCode.toUpperCase());
        if (!invite) {
            return res.status(400).json({ error: 'Invalid or expired invite code' });
        }

        // Check if email matches invite (if specified)
        if (invite.email && invite.email.toLowerCase() !== normalizedEmail) {
            // Use same error message to prevent invite code enumeration
            return res.status(400).json({ error: 'Invalid or expired invite code' });
        }

        // Check if user already exists
        const existingUser = await User.findByEmail(normalizedEmail);
        if (existingUser) {
            // Prevent user enumeration - use generic message
            return res.status(400).json({ error: 'Unable to complete registration' });
        }

        // Hash password
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user with invite code details
        const crypto = require('crypto');
        const oauthId = `invite-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        const user = await User.create(oauthId, normalizedEmail, name, invite.department, hashedPassword);

        // Update user role from invite
        if (invite.role !== 'trainee') {
            await User.updateRole(user.id, invite.role, null);
        }

        // Mark invite code as used and link to user
        await InviteCode.markUsed(invite.id, user.id);

        // Update user with invite code reference
        getDatabase().run('UPDATE users SET invite_code_id = ? WHERE id = ?', [invite.id, user.id]);

        // Generate JWT token
        const token = generateToken(user);

        res.status(201).json({
            message: 'Account created successfully',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: invite.role,
                department: invite.department
            },
            token
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Simple registration without invite code (for testing/development)
async function simpleRegistration(req, res) {
    try {
        const { name, email, password } = req.body;

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // Comprehensive email validation
        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) {
            return res.status(400).json({
                error: 'Invalid email',
                details: emailValidation.errors
            });
        }

        // Use normalized email
        const normalizedEmail = emailValidation.normalized;

        // Check password length
        const minPasswordLength = parseInt(process.env.MIN_PASSWORD_LENGTH) || 8;
        if (password.length < minPasswordLength) {
            return res.status(400).json({
                error: `Password must be at least ${minPasswordLength} characters long`
            });
        }

        // Check if user already exists
        const existingUser = await User.findByEmail(normalizedEmail);
        if (existingUser) {
            // Prevent user enumeration - use generic message
            return res.status(400).json({ error: 'Unable to complete registration' });
        }

        // Hash password
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user with default trainee role
        const crypto = require('crypto');
        const oauthId = `open-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        const user = await User.create(oauthId, normalizedEmail, name, 'Testing', hashedPassword);

        // Generate JWT token
        const token = generateToken(user);

        res.status(201).json({
            message: 'Account created successfully',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role || 'trainee',
                department: user.department
            },
            token
        });

    } catch (error) {
        console.error('Simple registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
}

// Login with email/password
router.post('/login', authLimiter, strictAuthLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user by email
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password for invite-based users
        if (user.password_hash) {
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        } else {
            return res.status(401).json({ error: 'Please use OAuth login for this account' });
        }

        // Update last login
        getDatabase().run('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?', [user.id]);

        // Generate JWT token
        const token = generateToken(user);

        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department
            },
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Configure OAuth2 Strategy (example with generic OAuth2 provider)
// In production, configure with your specific OAuth provider (Auth0, Okta, Azure AD, etc.)
passport.use(new OAuth2Strategy({
    authorizationURL: process.env.OAUTH_AUTH_URL || 'https://your-oauth-provider.com/oauth/authorize',
    tokenURL: process.env.OAUTH_TOKEN_URL || 'https://your-oauth-provider.com/oauth/token',
    clientID: process.env.OAUTH_CLIENT_ID || 'your-client-id',
    clientSecret: process.env.OAUTH_CLIENT_SECRET || 'your-client-secret',
    callbackURL: process.env.OAUTH_CALLBACK_URL || 'http://localhost:3001/auth/oauth/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const result = await handleOAuthCallback(profile);
      return done(null, result);
    } catch (error) {
      return done(error, null);
    }
  }
));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// OAuth login route
router.get('/oauth',
  passport.authenticate('oauth2')
);

// OAuth callback route
router.get('/oauth/callback',
  passport.authenticate('oauth2', { failureRedirect: '/login?error=oauth_failed' }),
  (req, res) => {
    // Successful authentication
    const { user, token } = req.user;

    // Set token in httpOnly cookie (NOT in URL)
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Allow cookie in OAuth redirects
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Redirect to frontend WITHOUT token in URL
    // Frontend will call /api/auth/token to retrieve the token
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?success=true`);
  }
);

// Logout route
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
    try {
        // User is set by authenticateToken middleware
        res.json({
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            department: req.user.department
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// Get token from httpOnly cookie (for OAuth callback)
// This allows the frontend to retrieve the token after OAuth redirect
router.get('/token', (req, res) => {
    try {
        const token = req.cookies.auth_token;

        if (!token) {
            return res.status(401).json({ error: 'No authentication token found' });
        }

        // Return token and clear the cookie (one-time use)
        res.clearCookie('auth_token');

        res.json({ token });
    } catch (error) {
        console.error('Get token error:', error);
        res.status(500).json({ error: 'Failed to retrieve token' });
    }
});

// Development route to simulate OAuth login (remove in production)
if (process.env.NODE_ENV !== 'production') {
  router.post('/dev-login', async (req, res) => {
    try {
      const { email, name, department } = req.body;

      // Create mock OAuth profile
      const mockProfile = {
        id: `dev-${email}`,
        email,
        displayName: name,
        department: department || 'IT'
      };

      const result = await handleOAuthCallback(mockProfile);
      res.json(result);
    } catch (error) {
      console.error('Dev login error:', error);
      res.status(500).json({ error: 'Dev login failed' });
    }
  });
}

module.exports = router;