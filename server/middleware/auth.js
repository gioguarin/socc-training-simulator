const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Validate JWT_SECRET is properly configured
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

if (!JWT_SECRET) {
    console.error('\n' + '='.repeat(70));
    console.error('SECURITY ERROR: JWT_SECRET environment variable is required.');
    console.error('Set a strong secret (min 32 characters) in your .env file.');
    console.error('Generate one using:');
    console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.error('='.repeat(70) + '\n');
    throw new Error('JWT_SECRET is required');
}

if (JWT_SECRET.length < 32) {
    console.error('\n' + '='.repeat(70));
    console.error('SECURITY ERROR: JWT_SECRET must be at least 32 characters long.');
    console.error(`Current length: ${JWT_SECRET.length}`);
    console.error('Generate a strong secret using:');
    console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.error('='.repeat(70) + '\n');
    throw new Error('JWT_SECRET too short');
}

// Check if using placeholder values
const weakSecrets = [
    'your-secret-key',
    'change-in-production',
    'your-super-secret',
    'secret',
    'password',
    'test'
];

if (weakSecrets.some(weak => JWT_SECRET.toLowerCase().includes(weak))) {
    console.error('\n' + '='.repeat(70));
    console.error('SECURITY ERROR: JWT_SECRET appears to be a placeholder value.');
    console.error('Generate a strong random secret using:');
    console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.error('='.repeat(70) + '\n');
    throw new Error('JWT_SECRET is a placeholder value');
}

console.log('✓ JWT_SECRET validated successfully');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Middleware to check if user has required role
const requireRole = (requiredRole) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const roleHierarchy = { trainee: 1, trainer: 2, admin: 3 };
        const userRole = req.user.role || 'trainee';
        const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
        const userRoleLevel = roleHierarchy[userRole] || 0;

        if (userRoleLevel < requiredRoleLevel) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: requiredRole,
                current: userRole
            });
        }

        next();
    };
};

// Generate JWT token for authenticated user
const generateToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

// OAuth callback handler
const handleOAuthCallback = async (oauthProfile) => {
    try {
        // Extract user info from OAuth profile
        const oauthId = oauthProfile.id || oauthProfile.sub;
        const email = oauthProfile.email || oauthProfile.emails?.[0]?.value;
        const name = oauthProfile.displayName || oauthProfile.name?.givenName + ' ' + oauthProfile.name?.familyName;
        const department = oauthProfile.department || null;

        if (!oauthId || !email || !name) {
            throw new Error('Incomplete OAuth profile data');
        }

        // Create or update user
        const user = await User.create(oauthId, email, name, department);

        // Generate JWT token
        const token = generateToken(user);

        return { user, token };
    } catch (error) {
        console.error('OAuth callback error:', error);
        throw error;
    }
};

module.exports = {
    authenticateToken,
    requireRole,
    generateToken,
    handleOAuthCallback
};