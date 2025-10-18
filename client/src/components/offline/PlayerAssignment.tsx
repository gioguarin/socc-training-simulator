import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './PlayerAssignment.css';

interface PlayerAssignment {
    playerName: string;
    role: 'caller' | 'responder';
    sessionName: string;
    pairedWith: string;
    pairedRole: string;
    scenario: {
        title: string;
        description?: string;
        callerScript?: string;
        falseInfo?: string;
        responderGoals?: string[];
    };
    accessCode: string;
}

const PlayerAssignment: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [assignment, setAssignment] = useState<PlayerAssignment | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [accessCode, setAccessCode] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const code = searchParams.get('code');
        if (code) {
            setAccessCode(code);
            fetchAssignment(code);
        } else {
            setIsLoading(false);
        }
    }, [searchParams]);

    const fetchAssignment = async (code: string) => {
        try {
            const response = await axios.get(`http://localhost:3001/api/offline/assignment/${code}`);
            setAssignment(response.data);
        } catch (error: any) {
            console.error('Failed to fetch assignment:', error);
            setError(error.response?.data?.error || 'Invalid access code');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitCode = (e: React.FormEvent) => {
        e.preventDefault();
        if (accessCode.trim()) {
            navigate(`/offline/assignment?code=${accessCode.trim().toUpperCase()}`);
            window.location.reload();
        }
    };

    const copyAssignment = () => {
        if (!assignment) return;

        let text = `
╔════════════════════════════════════════════════════════════════╗
║                  SOCC TRAINING ASSIGNMENT                      ║
╚════════════════════════════════════════════════════════════════╝

SESSION: ${assignment.sessionName}
YOUR NAME: ${assignment.playerName}

YOUR ROLE: ${assignment.role.toUpperCase()}
PAIRED WITH: ${assignment.pairedWith} (${assignment.pairedRole})

SCENARIO: ${assignment.scenario.title}
`;

        if (assignment.role === 'caller' && assignment.scenario.callerScript) {
            text += `
─────────────────────────────────────────────────────────────────
CALLER SCRIPT:
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
            text += `
─────────────────────────────────────────────────────────────────
YOUR GOALS:
`;
            assignment.scenario.responderGoals.forEach((goal, index) => {
                text += `${index + 1}. ${goal}\n`;
            });
        }

        text += `
─────────────────────────────────────────────────────────────────
ACCESS CODE: ${assignment.accessCode}
`;

        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (isLoading) {
        return (
            <div className="assignment-page">
                <div className="assignment-container">
                    <div className="loading-spinner">
                        <div className="spinner"></div>
                        <p>Loading assignment...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="assignment-page">
                <div className="assignment-container">
                    <div className="error-card">
                        <div className="error-icon">⚠️</div>
                        <h2>Invalid Access Code</h2>
                        <p>{error}</p>
                        <form onSubmit={handleSubmitCode} className="code-form">
                            <input
                                type="text"
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                                placeholder="Enter your access code"
                                maxLength={8}
                            />
                            <button type="submit">View Assignment</button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    if (!assignment) {
        return (
            <div className="assignment-page">
                <div className="assignment-container">
                    <div className="welcome-card">
                        <h1>SOCC Training Assignment</h1>
                        <p>Enter your access code to view your training assignment</p>
                        <form onSubmit={handleSubmitCode} className="code-form">
                            <input
                                type="text"
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                                placeholder="ACCESS CODE"
                                maxLength={8}
                                autoFocus
                            />
                            <button type="submit">View Assignment</button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="assignment-page">
            <div className="assignment-container">
                <div className="assignment-card">
                    <header className="assignment-header">
                        <h1>SOCC TRAINING ASSIGNMENT</h1>
                        <div className="access-code-display">
                            Access Code: <span>{assignment.accessCode}</span>
                        </div>
                    </header>

                    <section className="session-info">
                        <div className="info-row">
                            <span className="label">Session:</span>
                            <span className="value">{assignment.sessionName}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Your Name:</span>
                            <span className="value">{assignment.playerName}</span>
                        </div>
                    </section>

                    <section className="role-section">
                        <div className={`role-badge-large role-${assignment.role}`}>
                            <div className="role-title">YOUR ROLE</div>
                            <div className="role-name">
                                {assignment.role === 'caller' ? 'CALLER' : 'SOCC INCIDENT RESPONDER'}
                            </div>
                        </div>
                    </section>

                    <section className="pairing-section">
                        <div className="pairing-info">
                            <div className="label">PAIRED WITH</div>
                            <div className="paired-name">{assignment.pairedWith}</div>
                            <div className="paired-role">
                                ({assignment.pairedRole === 'caller' ? 'Caller' : 'Responder'})
                            </div>
                        </div>
                    </section>

                    <section className="scenario-section">
                        <h2>SCENARIO: {assignment.scenario.title}</h2>
                        {assignment.scenario.description && (
                            <p className="scenario-description">{assignment.scenario.description}</p>
                        )}

                        {assignment.role === 'caller' && assignment.scenario.callerScript && (
                            <div className="caller-info">
                                <div className="info-box">
                                    <h3>Your Script</h3>
                                    <p className="script-text">{assignment.scenario.callerScript}</p>
                                </div>
                                {assignment.scenario.falseInfo && (
                                    <div className="info-box warning">
                                        <h3>False Information to Use</h3>
                                        <p className="script-text">{assignment.scenario.falseInfo}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {assignment.role === 'responder' && assignment.scenario.responderGoals && (
                            <div className="responder-info">
                                <h3>Your Goals</h3>
                                <ul className="goals-list">
                                    {assignment.scenario.responderGoals.map((goal, index) => (
                                        <li key={index}>
                                            <span className="goal-icon">✓</span>
                                            {goal}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>

                    <div className="actions">
                        <button onClick={copyAssignment} className="copy-button">
                            {copied ? '✓ Copied to Clipboard!' : 'Copy Assignment'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerAssignment;
