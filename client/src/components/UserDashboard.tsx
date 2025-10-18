import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './UserDashboard.css';

interface TrainingSession {
    session_id: string;
    started_at: string;
    ended_at: string;
    role: 'responder' | 'caller';
    performance_score?: number;
    feedback?: string;
    scenario_title?: string;
    scenario_category?: string;
}

const UserDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [trainingHistory, setTrainingHistory] = useState<TrainingSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchTrainingHistory();
    }, []);

    const fetchTrainingHistory = async () => {
        try {
            const response = await axios.get('http://localhost:3001/api/admin/sessions?limit=10');
            setTrainingHistory(response.data);
        } catch (error) {
            console.error('Failed to fetch training history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <div className="header-content">
                    <h1>Welcome, {user?.name}</h1>
                    <div className="user-info">
                        <span className="role-badge role-{user?.role}">{user?.role}</span>
                        {user?.department && <span className="department">{user.department}</span>}
                    </div>
                </div>
                <button onClick={logout} className="logout-btn">Logout</button>
            </header>

            <div className="dashboard-content">
                <div className="quick-actions">
                    <h2>Quick Actions</h2>
                    <div className="action-buttons">
                        <Link to="/lobby" className="action-btn primary">
                            Join Training Lobby
                        </Link>
                        {user?.role === 'admin' && (
                            <Link to="/admin" className="action-btn secondary">
                                Admin Dashboard
                            </Link>
                        )}
                    </div>
                </div>

                <div className="training-history">
                    <h2>Recent Training Sessions</h2>
                    {isLoading ? (
                        <div className="loading">Loading training history...</div>
                    ) : trainingHistory.length > 0 ? (
                        <div className="sessions-list">
                            {trainingHistory.map((session) => (
                                <div key={session.session_id} className="session-card">
                                    <div className="session-header">
                                        <h3>{session.scenario_title || 'Training Session'}</h3>
                                        <span className="session-date">{formatDate(session.started_at)}</span>
                                    </div>
                                    <div className="session-details">
                                        <span className="role">Role: {session.role}</span>
                                        {session.scenario_category && (
                                            <span className="category">{session.scenario_category}</span>
                                        )}
                                        {session.performance_score && (
                                            <span className="score">Score: {session.performance_score}/10</span>
                                        )}
                                    </div>
                                    {session.feedback && (
                                        <div className="session-feedback">
                                            <strong>Feedback:</strong> {session.feedback}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="no-sessions">
                            <p>No training sessions yet.</p>
                            <Link to="/lobby" className="start-training-link">
                                Start your first training session
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;