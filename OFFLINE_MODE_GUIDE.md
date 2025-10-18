# Offline Mode Guide

## Overview

Offline Mode allows admins and trainers to create manual training sessions for in-person or remote training events. Instead of automatic online matchmaking, trainers can manually add player names, start the session, and distribute full assignment details via copy/paste. Each player receives their complete assignment including role, partner information, and scenario details without needing to access a URL.

## Key Features

- **Manual Player Management**: Add player names before the session
- **Automatic Pairing**: System randomly pairs players and assigns roles
- **Unique Access Codes**: Each player gets a unique 8-character cryptographic access code
- **Full Assignment Copy**: Copy complete assignment details (no URLs needed)
  - Includes role, partner, scenario title, scripts (for callers), and goals (for responders)
  - Formatted for easy distribution via text, email, or messaging
  - Individual or bulk copy of all assignments
- **Session Tracking**: Track session status (preparing, active, completed)
- **Role Assignment**: Automatically assigns caller/responder roles
- **Scenario Selection**: Optionally select a specific training scenario
- **Public Assignment View**: Players can also access assignments via URL using their access code (optional)

---

## API Endpoints

All endpoints require authentication. Offline mode endpoints require `trainer` or `admin` role.

### 1. Create Offline Session

```bash
POST /api/offline/sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "sessionName": "Security Team Training - June 2025"
}
```

**Response:**
```json
{
  "message": "Offline session created successfully",
  "session": {
    "id": 1,
    "session_name": "Security Team Training - June 2025",
    "created_by": 3,
    "status": "preparing",
    "created_at": "2025-10-18T10:00:00.000Z"
  }
}
```

---

### 2. Get All Sessions

```bash
GET /api/offline/sessions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "sessions": [
    {
      "id": 1,
      "session_name": "Security Team Training",
      "status": "preparing",
      "player_count": 4,
      "created_at": "2025-10-18T10:00:00.000Z"
    }
  ]
}
```

---

### 3. Get Session Details

```bash
GET /api/offline/sessions/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "session": {
    "id": 1,
    "session_name": "Security Team Training",
    "status": "preparing",
    "created_at": "2025-10-18T10:00:00.000Z"
  },
  "players": [
    {
      "id": 1,
      "player_name": "Alice Johnson",
      "access_code": "A1B2C3D4",
      "role": null,
      "paired_with": null
    },
    {
      "id": 2,
      "player_name": "Bob Smith",
      "access_code": "E5F6G7H8",
      "role": null,
      "paired_with": null
    }
  ]
}
```

---

### 4. Add Player to Session

```bash
POST /api/offline/sessions/:id/players
Authorization: Bearer <token>
Content-Type: application/json

{
  "playerName": "Alice Johnson"
}
```

**Response:**
```json
{
  "message": "Player added successfully",
  "player": {
    "id": 1,
    "session_id": 1,
    "player_name": "Alice Johnson",
    "access_code": "A1B2C3D4",
    "role": null,
    "created_at": "2025-10-18T10:01:00.000Z"
  }
}
```

---

### 5. Start Session (Pair Players)

```bash
POST /api/offline/sessions/:id/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "scenarioId": "phishing-call"  // Optional
}
```

**Requirements:**
- Minimum 2 players
- Must have an even number of players
- Session must be in "preparing" status

**Response:**
```json
{
  "message": "Session started successfully",
  "pairs": [
    {
      "id": 1,
      "player_name": "Alice Johnson",
      "role": "responder",
      "access_code": "A1B2C3D4",
      "paired_with": 2,
      "paired_player_name": "Bob Smith"
    },
    {
      "id": 2,
      "player_name": "Bob Smith",
      "role": "caller",
      "access_code": "E5F6G7H8",
      "paired_with": 1,
      "paired_player_name": "Alice Johnson"
    }
  ]
}
```

---

### 6. Get Player Assignment (Public - No Auth)

```bash
GET /api/offline/assignment/:accessCode
```

**Response:**
```json
{
  "playerName": "Alice Johnson",
  "role": "responder",
  "sessionName": "Security Team Training",
  "pairedWith": "Bob Smith",
  "pairedRole": "caller",
  "scenario": {
    "title": "Phishing Call",
    "callerScript": "Hello, this is John from IT Support...",
    "falseInfo": "I'm calling from Microsoft...",
    "responderGoals": [
      "Verify caller's identity",
      "Don't share credentials"
    ]
  },
  "accessCode": "A1B2C3D4"
}
```

---

### 7. Remove Player

```bash
DELETE /api/offline/players/:playerId
Authorization: Bearer <token>
```

**Note:** Can only remove players before session starts

---

### 8. Complete Session

```bash
POST /api/offline/sessions/:id/complete
Authorization: Bearer <token>
```

---

### 9. Delete Session

```bash
DELETE /api/offline/sessions/:id
Authorization: Bearer <token>
```

**Note:** Can only delete sessions in "preparing" status

---

## Workflow Example

### Scenario: Training 6 People

1. **Create Session**
```bash
curl -X POST http://localhost:3001/api/offline/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionName": "Friday Training Session"}'
```

2. **Add Players** (repeat 6 times)
```bash
curl -X POST http://localhost:3001/api/offline/sessions/1/players \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"playerName": "Alice Johnson"}'

curl -X POST http://localhost:3001/api/offline/sessions/1/players \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"playerName": "Bob Smith"}'

# ... add 4 more players
```

3. **Start Session**
```bash
curl -X POST http://localhost:3001/api/offline/sessions/1/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scenarioId": "phishing-call"}'
```

4. **Get Player Assignments**
```bash
# Check session details to get all access codes
curl -X GET http://localhost:3001/api/offline/sessions/1 \
  -H "Authorization: Bearer $TOKEN"
```

5. **Share Assignments**
   - Click "Copy Assignment" for individual players
   - Or click "Copy All Assignments" to get all players at once
   - Share via text message, email, or any messaging platform
   - Players can also optionally visit: `/offline/assignment?code=A1B2C3D4`

6. **Complete Session**
```bash
curl -X POST http://localhost:3001/api/offline/sessions/1/complete \
  -H "Authorization: Bearer $TOKEN"
```

---

## Assignment Copy Format

When you click "Copy Assignment" for a player, the following text is copied to your clipboard:

```
╔════════════════════════════════════════════════════════════════╗
║                  SOCC TRAINING ASSIGNMENT                      ║
╚════════════════════════════════════════════════════════════════╝

SESSION: Friday Training Session
PLAYER: Alice Johnson
ACCESS CODE: A1B2C3D4

─────────────────────────────────────────────────────────────────
YOUR ROLE: RESPONDER
PAIRED WITH: Bob Smith (caller)
─────────────────────────────────────────────────────────────────

SCENARIO: Phishing Call

─────────────────────────────────────────────────────────────────
YOUR GOALS:
1. Verify caller's identity
2. Don't share credentials
3. Report suspicious activity

╚════════════════════════════════════════════════════════════════╝
```

**For Callers**, the assignment includes:
- Their script to follow
- False information to use during the call

**For Responders**, the assignment includes:
- Their goals/objectives for the call
- What they need to identify or prevent

You can paste this text into any messaging platform (Slack, Teams, Email, SMS) to share with players.

---

## Player Assignment Page (Optional)

When a player visits `/offline/assignment?code=A1B2C3D4`, they see:

```
===========================================
SOCC Training Assignment
===========================================

Session: Friday Training Session
Your Name: Alice Johnson

ROLE: SOCC Incident Responder
PAIRED WITH: Bob Smith (Caller)

SCENARIO: Phishing Call

YOUR GOALS:
✓ Verify caller's identity
✓ Don't share credentials
✓ Report suspicious activity

[Copy Assignment Button]
===========================================
```

---

## Database Schema

### offline_sessions
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| session_name | TEXT | Session name |
| created_by | INTEGER | User ID of creator |
| scenario_id | TEXT | Optional scenario ID |
| status | TEXT | preparing/active/completed |
| created_at | DATETIME | Creation timestamp |
| started_at | DATETIME | Start timestamp |
| completed_at | DATETIME | Completion timestamp |

### offline_players
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| session_id | INTEGER | FK to offline_sessions |
| player_name | TEXT | Player's name |
| role | TEXT | caller or responder |
| access_code | TEXT | Unique 8-char code |
| paired_with | INTEGER | FK to paired player |
| assignment_viewed | BOOLEAN | Viewed status |
| created_at | DATETIME | Creation timestamp |

---

## Security Features

1. **Access Control**: Only trainers and admins can create/manage sessions
2. **Unique Access Codes**: Cryptographically secure 8-character codes
3. **Input Validation**: Player names limited to 100 characters
4. **Session Status Validation**: Prevents modifications to active/completed sessions
5. **Ownership Verification**: Users can only modify their own sessions (unless admin)

---

## Best Practices

### For Trainers

1. **Create Session Early**: Create the session before the training event
2. **Collect Names**: Get all player names before adding them
3. **Even Numbers**: Ensure you have an even number of players
4. **Test Access Codes**: Verify at least one access code works before distributing
5. **Keep Records**: Note which access code belongs to which player
6. **Provide Instructions**: Tell players how to access their assignment

### For In-Person Training

1. Create session in advance
2. Print access codes and assignments
3. Hand out assignments privately
4. Use physical room separation for caller/responder
5. Provide scenario scripts to callers

### For Remote Training

1. Create session in advance
2. Send access codes via private message (email, chat)
3. Use breakout rooms for caller/responder separation
4. Share scenario scripts via screen share or document

---

## Troubleshooting

### "Need an even number of players"
- Solution: Add or remove one player to make the count even

### "Cannot add players to active session"
- Solution: Create a new session or wait for current session to complete

### "Invalid access code"
- Solution: Verify the code is correct (case-sensitive)
- Check session hasn't been deleted

### "Access denied"
- Solution: Ensure you're logged in as trainer or admin
- Verify you own the session (or are admin)

---

## Future Enhancements

Potential features for future versions:

1. **Bulk Player Import**: CSV upload for player names
2. **Custom Pairing**: Manual player pairing override
3. **Session Templates**: Save frequently-used configurations
4. **Real-time Status**: Track which players have viewed their assignment
5. **Session History**: Detailed logs of completed sessions
6. **Email Integration**: Auto-send access codes via email
7. **QR Codes**: Generate QR codes for quick access
8. **Multi-Scenario**: Assign different scenarios to different pairs

---

## Example Frontend Implementation

```typescript
// Create session
const createSession = async (sessionName: string) => {
  const response = await fetch('/api/offline/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ sessionName })
  });
  return response.json();
};

// Add player
const addPlayer = async (sessionId: number, playerName: string) => {
  const response = await fetch(`/api/offline/sessions/${sessionId}/players`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ playerName })
  });
  return response.json();
};

// Start session
const startSession = async (sessionId: number, scenarioId?: string) => {
  const response = await fetch(`/api/offline/sessions/${sessionId}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ scenarioId })
  });
  return response.json();
};

// Copy assignment text
const copyAssignment = (assignment: Assignment) => {
  const text = `
SOCC Training Assignment
Session: ${assignment.sessionName}
Name: ${assignment.playerName}
Role: ${assignment.role}
Paired with: ${assignment.pairedWith} (${assignment.pairedRole})
Access Code: ${assignment.accessCode}
`;
  navigator.clipboard.writeText(text);
};
```

---

## Testing

```bash
# Run tests
node test/test-offline-mode.js

# Test player pairing logic
# - Creates session with 4 players
# - Starts session
# - Verifies all players paired
# - Verifies roles assigned
# - Verifies access codes work
```

---

**Status**: ✅ Complete - Backend & Frontend Implemented
**Version**: 1.0.0
**Last Updated**: October 18, 2025

## Implementation Summary

✅ **Backend**: All API endpoints, models, and routes implemented
✅ **Frontend**: Full React/TypeScript interface for trainers and players
✅ **Copy Functionality**: Full assignment details copied (no URLs required)
✅ **Security**: Cryptographic access codes, role-based access control
✅ **Database**: Offline sessions and players tables with migrations
