const express = require('express');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2').Strategy;
const { getDatabase } = require('../database/init');
const { handleOAuthCallback, generateToken } = require('../middleware/auth');
const User = require('../models/User');
const InviteCode = require('../models/InviteCode');

const router = express.Router();

// Register with invite code
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, inviteCode } = req.body;

        // Validate input
        if (!name || !email || !password || !inviteCode) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        // Validate invite code
        const invite = await InviteCode.validate(inviteCode.toUpperCase());
        if (!invite) {
            return res.status(400).json({ error: 'Invalid or expired invite code' });
        }

        // Check if email matches invite (if specified)
        if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
            return res.status(400).json({ error: 'Email does not match invite code' });
        }

        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user with invite code details
        const oauthId = `invite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const user = await User.create(oauthId, email, name, invite.department, hashedPassword);

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

// Login with email/password
router.post('/login', async (req, res) => {
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

    // Set token in cookie for client-side access
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Redirect to frontend with success
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`);
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
router.get('/me', async (req, res) => {
    try {
        // User should be set by JWT authentication middleware
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

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