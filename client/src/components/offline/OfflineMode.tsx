import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import './OfflineMode.css';

interface OfflineSession {
    id: number;
    session_name: string;
    status: 'preparing' | 'active' | 'completed';
    player_count: number;
    created_at: string;
    scenario_id?: string;
}

interface Player {
    id: number;
    player_name: string;
    access_code: string;
    role: 'caller' | 'responder' | null;
    paired_with: number | null;
    paired_player_name?: string;
}

interface SessionDetails {
    session: OfflineSession;
    players: Player[];
}

interface Scenario {
    id: string;
    title: string;
    description: string;
}

const OfflineMode: React.FC = () => {
    const { user, logout } = useAuth();
    const [sessions, setSessions] = useState<OfflineSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<SessionDetails | null>(null);
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newSessionName, setNewSessionName] = useState('');
    const [newPlayerName, setNewPlayerName] = useState('');
    const [selectedScenario, setSelectedScenario] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    useEffect(() => {
        fetchSessions();
        fetchScenarios();
    }, []);

    const fetchSessions = async () => {
        try {
            const response = await axios.get('http://localhost:3001/api/offline/sessions');
            setSessions(response.data.sessions);
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
            setError('Failed to load sessions');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchScenarios = async () => {
        try {
            const response = await axios.get('http://localhost:3001/api/scenarios');
            // The API returns an array directly, not wrapped in a scenarios property
            setScenarios(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Failed to fetch scenarios:', error);
        }
    };

    const fetchSessionDetails = async (sessionId: number) => {
        try {
            const response = await axios.get(`http://localhost:3001/api/offline/sessions/${sessionId}`);
            setSelectedSession(response.data);
        } catch (error) {
            console.error('Failed to fetch session details:', error);
            setError('Failed to load session details');
        }
    };

    const handleCreateSession = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!newSessionName.trim()) {
            setError('Session name is required');
            return;
        }

        try {
            await axios.post('http://localhost:3001/api/offline/sessions', {
                sessionName: newSessionName.trim()
            });
            setNewSessionName('');
            setShowCreateForm(false);
            fetchSessions();
        } catch (error: any) {
            console.error('Failed to create session:', error);
            setError(error.response?.data?.error || 'Failed to create session');
        }
    };

    const handleAddPlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!selectedSession) return;

        if (!newPlayerName.trim()) {
            setError('Player name is required');
            return;
        }

        try {
            await axios.post(`http://localhost:3001/api/offline/sessions/${selectedSession.session.id}/players`, {
                playerName: newPlayerName.trim()
            });
            setNewPlayerName('');
            fetchSessionDetails(selectedSession.session.id);
        } catch (error: any) {
            console.error('Failed to add player:', error);
            setError(error.response?.data?.error || 'Failed to add player');
        }
    };

    const handleRemovePlayer = async (playerId: number) => {
        if (!window.confirm('Are you sure you want to remove this player?')) {
            return;
        }

        try {
            await axios.delete(`http://localhost:3001/api/offline/players/${playerId}`);
            if (selectedSession) {
                fetchSessionDetails(selectedSession.session.id);
            }
        } catch (error: any) {
            console.error('Failed to remove player:', error);
            setError(error.response?.data?.error || 'Failed to remove player');
        }
    };

    const handleStartSession = async () => {
        if (!selectedSession) return;

        if (selectedSession.players.length < 2) {
            setError('Need at least 2 players to start session');
            return;
        }

        if (selectedSession.players.length % 2 !== 0) {
            setError('Need an even number of players to start session');
            return;
        }

        setError(null);

        try {
            await axios.post(`http://localhost:3001/api/offline/sessions/${selectedSession.session.id}/start`, {
                scenarioId: selectedScenario || undefined
            });
            fetchSessionDetails(selectedSession.session.id);
            fetchSessions();
        } catch (error: any) {
            console.error('Failed to start session:', error);
            setError(error.response?.data?.error || 'Failed to start session');
        }
    };

    const handleCompleteSession = async () => {
        if (!selectedSession) return;

        if (!window.confirm('Are you sure you want to mark this session as completed?')) {
            return;
        }

        try {
            await axios.post(`http://localhost:3001/api/offline/sessions/${selectedSession.session.id}/complete`);
            fetchSessionDetails(selectedSession.session.id);
            fetchSessions();
        } catch (error: any) {
            console.error('Failed to complete session:', error);
            setError(error.response?.data?.error || 'Failed to complete session');
        }
    };

    const handleDeleteSession = async (sessionId: number) => {
        if (!window.confirm('Are you sure you want to delete this session? This cannot be undone.')) {
            return;
        }

        try {
            await axios.delete(`http://localhost:3001/api/offline/sessions/${sessionId}`);
            setSessions(sessions.filter(s => s.id !== sessionId));
            if (selectedSession?.session.id === sessionId) {
                setSelectedSession(null);
            }
        } catch (error: any) {
            console.error('Failed to delete session:', error);
            setError(error.response?.data?.error || 'Failed to delete session');
        }
    };

    const copyAccessCode = async (code: string, playerName: string) => {
        try {
            // Fetch the full assignment details
            const response = await axios.get(`http://localhost:3001/api/offline/assignment/${code}`);
            const assignment = response.data;

            // Format the assignment with all details
            let text = `╔════════════════════════════════════════════════════════════════╗
║                  SOCC TRAINING ASSIGNMENT                      ║
╚════════════════════════════════════════════════════════════════╝

SESSION: ${assignment.sessionName}
PLAYER: ${assignment.playerName}
ACCESS CODE: ${code}

─────────────────────────────────────────────────────────────────
YOUR ROLE: ${assignment.role.toUpperCase()}
PAIRED WITH: ${assignment.pairedWith} (${assignment.pairedRole})
─────────────────────────────────────────────────────────────────

SCENARIO: ${assignment.scenario.title}
`;

            if (assignment.scenario.description) {
                text += `${assignment.scenario.description}\n\n`;
            }

            if (assignment.role === 'caller' && assignment.scenario.callerScript) {
                text += `─────────────────────────────────────────────────────────────────
YOUR SCRIPT:
${assignment.scenario.callerScript}
`;

                if (assignment.scenario.falseInfo) {
                    text += `
FALSE INFORMATION TO USE:
${assignment.scenario.falseInfo}
`;
                }
            }

            if (assignment.role === 'responder' && assignment.scenario.responderGoals) {
                text += `─────────────────────────────────────────────────────────────────
YOUR GOALS:
`;
                assignment.scenario.responderGoals.forEach((goal: string, index: number) => {
                    text += `${index + 1}. ${goal}\n`;
                });
            }

            text += `
╚════════════════════════════════════════════════════════════════╝
`;

            navigator.clipboard.writeText(text).then(() => {
                setCopiedCode(code);
                setTimeout(() => setCopiedCode(null), 2000);
            });
        } catch (error) {
            console.error('Failed to fetch assignment:', error);
            setError('Failed to copy assignment details');
        }
    };

    const copyAllAssignments = async () => {
        if (!selectedSession) return;

        try {
            // Fetch all assignment details
            const assignmentPromises = selectedSession.players.map(player =>
                axios.get(`http://localhost:3001/api/offline/assignment/${player.access_code}`)
            );

            const responses = await Promise.all(assignmentPromises);

            const text = responses.map((response, index) => {
                const assignment = response.data;
                let assignmentText = `╔════════════════════════════════════════════════════════════════╗
║                  SOCC TRAINING ASSIGNMENT ${index + 1}                     ║
╚════════════════════════════════════════════════════════════════╝

SESSION: ${assignment.sessionName}
PLAYER: ${assignment.playerName}
ACCESS CODE: ${assignment.accessCode}

─────────────────────────────────────────────────────────────────
ROLE: ${assignment.role.toUpperCase()}
PAIRED WITH: ${assignment.pairedWith} (${assignment.pairedRole})
─────────────────────────────────────────────────────────────────

SCENARIO: ${assignment.scenario.title}
`;

                if (assignment.scenario.description) {
                    assignmentText += `${assignment.scenario.description}\n\n`;
                }

                if (assignment.role === 'caller' && assignment.scenario.callerScript) {
                    assignmentText += `─────────────────────────────────────────────────────────────────
SCRIPT:
${assignment.scenario.callerScript}
`;

                    if (assignment.scenario.falseInfo) {
                        assignmentText += `
FALSE INFORMATION TO USE:
${assignment.scenario.falseInfo}
`;
                    }
                }

                if (assignment.role === 'responder' && assignment.scenario.responderGoals) {
                    assignmentText += `─────────────────────────────────────────────────────────────────
GOALS:
`;
                    assignment.scenario.responderGoals.forEach((goal: string, idx: number) => {
                        assignmentText += `${idx + 1}. ${goal}\n`;
                    });
                }

                assignmentText += `
╚════════════════════════════════════════════════════════════════╝
`;

                return assignmentText;
            }).join('\n\n\n');

            navigator.clipboard.writeText(text).then(() => {
                alert('All assignments copied to clipboard!');
            });
        } catch (error) {
            console.error('Failed to fetch assignments:', error);
            setError('Failed to copy all assignments');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    const getStatusBadge = (status: string) => {
        const statusClass = `status-badge status-${status}`;
        return <span className={statusClass}>{status}</span>;
    };

    return (
        <div className="offline-mode">
            <header className="offline-header">
                <div className="header-content">
                    <h1>Offline Training Mode</h1>
                    <p>Manage in-person and manual training sessions</p>
                </div>
                <button onClick={logout} className="logout-btn">Logout</button>
            </header>

            {error && (
                <div className="error-banner">
                    {error}
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            <div className="offline-content">
                <div className="sessions-panel">
                    <div className="panel-header">
                        <h2>Training Sessions</h2>
                        <button
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            className="create-btn"
                        >
                            {showCreateForm ? 'Cancel' : '+ New Session'}
                        </button>
                    </div>

                    {showCreateForm && (
                        <form onSubmit={handleCreateSession} className="create-session-form">
                            <input
                                type="text"
                                value={newSessionName}
                                onChange={(e) => setNewSessionName(e.target.value)}
                                placeholder="Session Name (e.g., Friday Training - June 2025)"
                                maxLength={100}
                                required
                            />
                            <button type="submit" className="submit-btn">Create Session</button>
                        </form>
                    )}

                    {isLoading ? (
                        <div className="loading">Loading sessions...</div>
                    ) : sessions.length === 0 ? (
                        <div className="empty-state">
                            <p>No sessions yet. Create your first training session!</p>
                        </div>
                    ) : (
                        <div className="sessions-list">
                            {sessions.map((session) => (
                                <div
                                    key={session.id}
                                    className={`session-item ${selectedSession?.session.id === session.id ? 'selected' : ''}`}
                                    onClick={() => fetchSessionDetails(session.id)}
                                >
                                    <div className="session-info">
                                        <h3>{session.session_name}</h3>
                                        <div className="session-meta">
                                            {getStatusBadge(session.status)}
                                            <span className="player-count">{session.player_count} players</span>
                                            <span className="session-date">{formatDate(session.created_at)}</span>
                                        </div>
                                    </div>
                                    {session.status === 'preparing' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteSession(session.id);
                                            }}
                                            className="delete-session-btn"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="session-details-panel">
                    {selectedSession ? (
                        <>
                            <div className="details-header">
                                <div>
                                    <h2>{selectedSession.session.session_name}</h2>
                                    {getStatusBadge(selectedSession.session.status)}
                                </div>
                                {selectedSession.session.status === 'active' && (
                                    <button onClick={handleCompleteSession} className="complete-btn">
                                        Mark as Completed
                                    </button>
                                )}
                            </div>

                            {selectedSession.session.status === 'preparing' && (
                                <>
                                    <div className="add-player-section">
                                        <h3>Add Players</h3>
                                        <form onSubmit={handleAddPlayer} className="add-player-form">
                                            <input
                                                type="text"
                                                value={newPlayerName}
                                                onChange={(e) => setNewPlayerName(e.target.value)}
                                                placeholder="Player Name"
                                                maxLength={100}
                                            />
                                            <button type="submit" className="add-btn">Add Player</button>
                                        </form>
                                    </div>

                                    {selectedSession.players.length >= 2 && (
                                        <div className="start-session-section">
                                            <h3>Start Session</h3>
                                            <div className="scenario-select">
                                                <label>Select Scenario (optional):</label>
                                                <select
                                                    value={selectedScenario}
                                                    onChange={(e) => setSelectedScenario(e.target.value)}
                                                >
                                                    <option value="">Random Scenario</option>
                                                    {scenarios.map((scenario) => (
                                                        <option key={scenario.id} value={scenario.id}>
                                                            {scenario.title}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button
                                                onClick={handleStartSession}
                                                className="start-btn"
                                                disabled={selectedSession.players.length < 2 || selectedSession.players.length % 2 !== 0}
                                            >
                                                Start Session & Pair Players
                                            </button>
                                            {selectedSession.players.length % 2 !== 0 && (
                                                <p className="warning">Need an even number of players to start</p>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="players-section">
                                <div className="players-header">
                                    <h3>Players ({selectedSession.players.length})</h3>
                                    {selectedSession.players.length > 0 && (
                                        <button onClick={copyAllAssignments} className="copy-all-btn">
                                            Copy All Assignments
                                        </button>
                                    )}
                                </div>

                                {selectedSession.players.length === 0 ? (
                                    <div className="empty-state">
                                        <p>No players added yet. Add players to get started!</p>
                                    </div>
                                ) : (
                                    <div className="players-grid">
                                        {selectedSession.players.map((player) => (
                                            <div key={player.id} className="player-card">
                                                <div className="player-info">
                                                    <h4>{player.player_name}</h4>
                                                    <div className="player-details">
                                                        <span className="access-code">
                                                            Code: <strong>{player.access_code}</strong>
                                                        </span>
                                                        {player.role && (
                                                            <>
                                                                <span className={`role-badge role-${player.role}`}>
                                                                    {player.role}
                                                                </span>
                                                                {player.paired_player_name && (
                                                                    <span className="paired-with">
                                                                        Paired with: {player.paired_player_name}
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="player-actions">
                                                    <button
                                                        onClick={() => copyAccessCode(player.access_code, player.player_name)}
                                                        className="copy-btn"
                                                    >
                                                        {copiedCode === player.access_code ? '✓ Copied' : 'Copy Assignment'}
                                                    </button>
                                                    {selectedSession.session.status === 'preparing' && (
                                                        <button
                                                            onClick={() => handleRemovePlayer(player.id)}
                                                            className="remove-btn"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="empty-state-large">
                            <h3>Select a session</h3>
                            <p>Choose a session from the list to view details and manage players</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OfflineMode;
