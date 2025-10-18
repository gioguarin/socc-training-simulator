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
const User = require("./models/User");
const Scenario = require("./models/Scenario");
const GameSession = require("./models/GameSession");
const { authenticateToken } = require("./middleware/auth");
const { initializeDatabase } = require("./database/init");

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
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
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

// Session configuration
app.use(
  session({
    store: new SQLiteStore({ db: "sessions.db", dir: "./data" }),
    secret:
      process.env.SESSION_SECRET || "your-session-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

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
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication token required"));
    }

    // Verify JWT token (simplified - in production use proper JWT verification)
    // For now, accept any token and create a mock user
    const mockUser = {
      id: 1,
      email: "user@company.com",
      name: "Authenticated User",
      role: "trainee",
    };

    socket.user = mockUser;
    next();
  } catch (error) {
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

    if (game) {
      try {
        // Save message to database
        await GameSession.saveChatMessage(game.id, socket.user.id, message);

        // Broadcast message to both players in the game
        game.players.forEach((player) => {
          io.to(player.id).emit("message-received", {
            from: socket.id,
            message,
            timestamp,
            role: game.players.find((p) => p.id === socket.id)?.role,
          });
        });
      } catch (error) {
        console.error("Save message error:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
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

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

function getRandomScenario() {
  const difficulty = Math.random() < 0.7 ? "common" : "uncommon";
  const scenarioList = scenarios[difficulty];
  return scenarioList[Math.floor(Math.random() * scenarioList.length)];
}

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();

    // Load scenarios
    await loadScenarios();

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
