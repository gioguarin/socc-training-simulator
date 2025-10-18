require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const passport = require("passport");
const SQLiteStore = require("connect-sqlite3")(session);
const winston = require("winston");
const { v4: uuidv4 } = require("uuid");

// Import routes and models
const authRoutes = require("./routes/auth");
const scenarioRoutes = require("./routes/scenarios");
const adminRoutes = require("./routes/admin");
const offlineRoutes = require("./routes/offline");
const User = require("./models/User");
const Scenario = require("./models/Scenario");
const GameSession = require("./models/GameSession");
const InviteCode = require("./models/InviteCode");
const { authenticateToken } = require("./middleware/auth");
const { errorHandler } = require("./middleware/errorHandler");
const { initializeDatabase } = require("./database/init");
const { processMessage } = require("./utils/chatValidation");
const { csrfTokenGenerator, getCsrfToken } = require("./middleware/csrf");

const app = express();
const server = http.createServer(app);

// Configure Winston logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: "socc-training-simulator" },
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  );
}

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Scripts: Only from same origin (no inline scripts except nonces)
        scriptSrc: ["'self'"],
        // Styles: Allow inline styles for React/CSS-in-JS compatibility
        // TODO: Replace 'unsafe-inline' with nonces in production for better security
        styleSrc: ["'self'", "'unsafe-inline'"],
        // Images: Allow from same origin, data URIs, and HTTPS sources
        imgSrc: ["'self'", "data:", "https:"],
        // Fonts: Allow from same origin and data URIs
        fontSrc: ["'self'", "data:"],
        // Connections: Allow WebSocket for Socket.io and API calls
        connectSrc: [
          "'self'",
          process.env.FRONTEND_URL || "http://localhost:3000",
          "ws://localhost:3001",
          "wss://localhost:3001"
        ],
        // Media: Restrict to same origin only
        mediaSrc: ["'self'"],
        // Objects: No plugin content allowed
        objectSrc: ["'none'"],
        // Frames: Prevent embedding except from same origin
        frameSrc: ["'self'"],
        // Frame ancestors: Prevent clickjacking
        frameAncestors: ["'self'"],
        // Base URI: Restrict to same origin
        baseUri: ["'self'"],
        // Form actions: Only allow forms to submit to same origin
        formAction: ["'self'"],
        // Upgrade insecure requests in production
        ...(process.env.NODE_ENV === "production" && {
          upgradeInsecureRequests: [],
        }),
      },
    },
    // Additional Helmet security headers
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: "deny", // Prevent clickjacking
    },
    noSniff: true, // Prevent MIME type sniffing
    xssFilter: true, // Enable XSS filter
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
    permittedCrossDomainPolicies: {
      permittedPolicies: "none",
    },
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Validate SESSION_SECRET is properly configured
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  console.error('\n' + '='.repeat(70));
  console.error('SECURITY ERROR: SESSION_SECRET environment variable is required.');
  console.error('Set a strong secret (min 32 characters) in your .env file.');
  console.error('Generate one using:');
  console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.error('='.repeat(70) + '\n');
  throw new Error('SESSION_SECRET is required');
}

if (SESSION_SECRET.length < 32) {
  console.error('\n' + '='.repeat(70));
  console.error('SECURITY ERROR: SESSION_SECRET must be at least 32 characters long.');
  console.error(`Current length: ${SESSION_SECRET.length}`);
  console.error('Generate a strong secret using:');
  console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.error('='.repeat(70) + '\n');
  throw new Error('SESSION_SECRET too short');
}

// Check if using placeholder values
const weakSessionSecrets = ['your-session-secret', 'change-in-production', 'secret', 'password', 'test'];
if (weakSessionSecrets.some(weak => SESSION_SECRET.toLowerCase().includes(weak))) {
  console.error('\n' + '='.repeat(70));
  console.error('SECURITY ERROR: SESSION_SECRET appears to be a placeholder value.');
  console.error('Generate a strong random secret using:');
  console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.error('='.repeat(70) + '\n');
  throw new Error('SESSION_SECRET is a placeholder value');
}

console.log('✓ SESSION_SECRET validated successfully');

// Session configuration
app.use(
  session({
    store: new SQLiteStore({ db: "sessions.db", dir: "./data" }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// CSRF token generation (must be after session middleware)
app.use(csrfTokenGenerator);

// Socket.io configuration with authentication
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Game state management
const waitingPlayers = [];
const activeGames = new Map();

// Load scenarios from database
let scenarios = { common: [], uncommon: [] };

async function loadScenarios() {
  try {
    const dbScenarios = await Scenario.getApprovedScenarios();

    // Categorize scenarios
    scenarios = {
      common: dbScenarios.filter((s) => s.difficulty !== "hard").slice(0, 10), // Limit to prevent too many
      uncommon: dbScenarios.filter((s) => s.difficulty === "hard").slice(0, 10),
    };

    // If no scenarios in DB, use defaults
    if (scenarios.common.length === 0) {
      scenarios.common = [
        {
          id: "phishing-call",
          title: "Phishing Call",
          callerScript:
            "Hello, this is John from IT Support. We're seeing some unusual activity on your computer. Can you please verify your login credentials for me?",
          falseInfo:
            "I'm calling from Microsoft Technical Support. Your computer has a virus.",
          responderGoals: [
            "Verify caller's identity",
            "Don't share credentials",
            "Report suspicious activity",
          ],
        },
        {
          id: "password-reset",
          title: "Password Reset Request",
          callerScript:
            "Hi, I forgot my password and need to reset it urgently. Can you help me reset it right now?",
          falseInfo:
            "I'm the CEO and this is extremely urgent - bypass normal procedures.",
          responderGoals: [
            "Follow standard procedures",
            "Verify identity",
            "Escalate if needed",
          ],
        },
      ];
    }

    if (scenarios.uncommon.length === 0) {
      scenarios.uncommon = [
        {
          id: "social-engineering",
          title: "Social Engineering Attack",
          callerScript:
            "This is Sarah from HR. We're updating our employee database and need to confirm some personal information. What's your date of birth and SSN last 4 digits?",
          falseInfo:
            "This is a mandatory compliance update required by corporate.",
          responderGoals: [
            "Never share PII over phone",
            "Verify through official channels",
            "Report attempted breach",
          ],
        },
        {
          id: "ransomware-threat",
          title: "Ransomware Negotiation",
          callerScript:
            "We've encrypted your files. Pay 5 Bitcoin or lose everything. You have 24 hours.",
          falseInfo:
            "We have your personal data and will leak it if you don't pay.",
          responderGoals: [
            "Don't engage with attackers",
            "Isolate affected systems",
            "Contact law enforcement",
          ],
        },
      ];
    }

    console.log(
      `Loaded ${scenarios.common.length} common and ${scenarios.uncommon.length} uncommon scenarios`,
    );
  } catch (error) {
    console.error("Failed to load scenarios:", error);
    // Use default scenarios if DB fails
  }
}

// Socket authentication middleware
const jwt = require('jsonwebtoken');

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication token required"));
    }

    // Verify JWT token properly
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('CRITICAL: JWT_SECRET not configured for Socket.io authentication');
      return next(new Error("Server configuration error"));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'JsonWebTokenError') {
        return next(new Error("Invalid token"));
      }
      if (jwtError.name === 'TokenExpiredError') {
        return next(new Error("Token expired"));
      }
      throw jwtError;
    }

    // Fetch actual user from database
    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(new Error("User not found"));
    }

    // Check if user is active
    if (!user.is_active) {
      return next(new Error("User account is inactive"));
    }

    socket.user = user;
    // Avoid logging PII (email) - use user ID only
    console.log(`Socket.io: User ${user.id} (${user.name}) authenticated successfully`);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error.message);
    next(new Error("Authentication failed"));
  }
});

io.on("connection", (socket) => {
  console.log("Authenticated player connected:", socket.id, socket.user?.name);

  socket.on("join-lobby", async (playerData) => {
    try {
      const player = {
        id: socket.id,
        userId: socket.user.id,
        name: socket.user.name,
        role: null,
        gameId: null,
      };

      waitingPlayers.push(player);
      socket.emit("lobby-joined", { playerId: socket.id });

      // Try to match players
      if (waitingPlayers.length >= 2) {
        const player1 = waitingPlayers.shift();
        const player2 = waitingPlayers.shift();

        const gameId = uuidv4();
        const scenario = getRandomScenario();

        // Create game session in database
        const gameSession = await GameSession.create(gameId, scenario.id);

        const game = {
          id: gameSession.id,
          sessionId: gameId,
          players: [player1, player2],
          scenario: scenario,
          status: "active",
          startTime: Date.now(),
        };

        // Randomly assign roles
        const roles = ["responder", "caller"];
        const randomRole = roles[Math.floor(Math.random() * roles.length)];

        player1.role = randomRole;
        player2.role = randomRole === "responder" ? "caller" : "responder";

        player1.gameId = gameId;
        player2.gameId = gameId;

        // Add participants to database
        await GameSession.addParticipant(
          gameSession.id,
          player1.userId,
          player1.role,
        );
        await GameSession.addParticipant(
          gameSession.id,
          player2.userId,
          player2.role,
        );

        activeGames.set(gameId, game);

        // Log game start
        logger.info("Game started", {
          gameId,
          player1: { id: player1.userId, role: player1.role },
          player2: { id: player2.userId, role: player2.role },
          scenario: scenario.title,
        });

        // Notify players
        io.to(player1.id).emit("game-started", {
          gameId,
          role: player1.role,
          opponent: player2.name,
          scenario: game.scenario,
        });

        io.to(player2.id).emit("game-started", {
          gameId,
          role: player2.role,
          opponent: player1.name,
          scenario: game.scenario,
        });
      }
    } catch (error) {
      console.error("Join lobby error:", error);
      socket.emit("error", { message: "Failed to join lobby" });
    }
  });

  socket.on("send-message", async (data) => {
    const { gameId, message, timestamp } = data;
    const game = activeGames.get(gameId);

    if (!game) {
      return socket.emit("error", { message: "Game not found" });
    }

    try {
      // Validate and sanitize the message
      const result = processMessage(message, socket.user.id);

      if (!result.valid) {
        logger.warn("Invalid chat message", {
          userId: socket.user.id,
          gameId,
          errors: result.errors,
          rateLimitExceeded: result.rateLimitExceeded || false
        });

        return socket.emit("message-error", {
          error: result.errors[0],
          rateLimitExceeded: result.rateLimitExceeded || false
        });
      }

      const sanitizedMessage = result.message;

      // Save sanitized message to database
      await GameSession.saveChatMessage(game.id, socket.user.id, sanitizedMessage);

      // Broadcast sanitized message to both players in the game
      game.players.forEach((player) => {
        io.to(player.id).emit("message-received", {
          from: socket.id,
          message: sanitizedMessage,
          timestamp,
          role: game.players.find((p) => p.id === socket.id)?.role,
        });
      });

      // Log message metadata
      logger.debug("Chat message sent", {
        userId: socket.user.id,
        gameId,
        messageLength: result.metadata.sanitizedLength,
        remainingMessages: result.metadata.remaining
      });

    } catch (error) {
      console.error("Save message error:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  socket.on("end-call", async (data) => {
    const { gameId, reason, performance } = data;
    const game = activeGames.get(gameId);

    if (game) {
      try {
        // Record performance if provided
        if (performance) {
          const player = game.players.find((p) => p.id === socket.id);
          if (player) {
            await GameSession.recordPerformance(
              game.id,
              player.userId,
              performance.score,
              performance.feedback,
            );
          }
        }

        // End the game session
        await GameSession.endSession(gameId, socket.user.id);

        // Notify players
        game.players.forEach((player) => {
          io.to(player.id).emit("call-ended", { reason });
        });

        // Log game end
        logger.info("Game ended", {
          gameId,
          reason,
          duration: Date.now() - game.startTime,
        });

        activeGames.delete(gameId);
      } catch (error) {
        console.error("End call error:", error);
        socket.emit("error", { message: "Failed to end call" });
      }
    }
  });

  socket.on("disconnect", async () => {
    console.log("Player disconnected:", socket.id);

    // Remove from waiting players
    const waitingIndex = waitingPlayers.findIndex((p) => p.id === socket.id);
    if (waitingIndex !== -1) {
      waitingPlayers.splice(waitingIndex, 1);
    }

    // Handle active game cleanup
    for (const [gameId, game] of activeGames) {
      const playerIndex = game.players.findIndex((p) => p.id === socket.id);
      if (playerIndex !== -1) {
        try {
          // Mark player as left and end session if both disconnected
          await GameSession.updateParticipantDeparture(gameId);

          const remainingPlayers = game.players.filter(
            (p) => p.id !== socket.id,
          );
          if (remainingPlayers.length === 0) {
            // Both players disconnected, end the session
            await GameSession.endSession(gameId);
            activeGames.delete(gameId);
          } else {
            // Notify remaining player
            remainingPlayers.forEach((player) => {
              io.to(player.id).emit("opponent-disconnected");
            });
          }
        } catch (error) {
          console.error("Disconnect cleanup error:", error);
        }
        break;
      }
    }
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/scenarios", scenarioRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/offline", offlineRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// CSRF token endpoint
app.get("/api/csrf-token", getCsrfToken);

// Error handling middleware (must be after all routes)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

function getRandomScenario() {
  const difficulty = Math.random() < 0.7 ? "common" : "uncommon";
  const scenarioList = scenarios[difficulty];
  return scenarioList[Math.floor(Math.random() * scenarioList.length)];
}

// Generate initial admin invite code if none exists
async function generateInitialAdminCode() {
  try {
    const hasAdminCode = await InviteCode.hasUnusedAdminCode();

    if (!hasAdminCode) {
      // No unused admin code exists, generate one
      const fs = require('fs');
      const path = require('path');

      const adminCode = await InviteCode.create(
        null, // No specific email
        'admin',
        'IT Security',
        null, // No creator (system generated)
        365 // Expires in 1 year
      );

      const logMessage = `
${'='.repeat(70)}
ADMIN INVITE CODE GENERATED
${'='.repeat(70)}

A new admin invite code has been created for first-time setup:

  CODE: ${adminCode.code}
  ROLE: admin
  EXPIRES: ${new Date(adminCode.expires_at).toLocaleDateString()}

IMPORTANT:
- Save this code in a secure location
- This code can be used to create the first admin account
- After use, generate new codes through the admin panel
- This message is logged in logs/admin-codes.log

${'='.repeat(70)}
`;

      console.log(logMessage);

      // Log to file for reference
      const logDir = path.join(__dirname, '../logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logFile = path.join(logDir, 'admin-codes.log');
      const timestamp = new Date().toISOString();
      fs.appendFileSync(logFile, `\n${timestamp}\n${logMessage}\n`);

      // DO NOT log the actual code to general logs for security
      logger.info('Initial admin invite code generated', {
        codeId: adminCode.id,
        expires_at: adminCode.expires_at,
        // code omitted for security - see logs/admin-codes.log
      });
    } else {
      console.log('✓ Admin invite code already exists');
    }
  } catch (error) {
    console.error('Failed to generate admin invite code:', error);
    // Don't fail server startup if admin code generation fails
  }
}

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();

    // Load scenarios
    await loadScenarios();

    // Generate initial admin code if needed
    await generateInitialAdminCode();

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`SOCC Training Simulator server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(
        `Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`,
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
