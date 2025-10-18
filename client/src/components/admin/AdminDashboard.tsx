import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import './AdminDashboard.css';

interface InviteCode {
    id: number;
    code: string;
    email?: string;
    role: string;
    department?: string;
    is_used: boolean;
    used_by_name?: string;
    expires_at: string;
    created_at: string;
}

const AdminDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newCode, setNewCode] = useState({
        email: '',
        role: 'trainee',
        department: '',
        expiresInDays: 30
    });

    useEffect(() => {
        fetchInviteCodes();
    }, []);

    const fetchInviteCodes = async () => {
        try {
            const response = await axios.get('http://localhost:3001/api/admin/invite-codes');
            setInviteCodes(response.data);
        } catch (error) {
            console.error('Failed to fetch invite codes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateCode = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:3001/api/admin/invite-codes', newCode);
            setNewCode({ email: '', role: 'trainee', department: '', expiresInDays: 30 });
            setShowCreateForm(false);
            fetchInviteCodes();
        } catch (error) {
            console.error('Failed to create invite code:', error);
        }
    };

    const handleDeleteCode = async (codeId: number) => {
        if (window.confirm('Are you sure you want to delete this invite code?')) {
            try {
                await axios.delete(`http://localhost:3001/api/admin/invite-codes/${codeId}`);
                fetchInviteCodes();
            } catch (error) {
                console.error('Failed to delete invite code:', error);
            }
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    return (
        <div className="admin-dashboard">
            <header className="admin-header">
                <div className="header-content">
                    <h1>Admin Dashboard</h1>
                    <p>Manage users, scenarios, and invite codes</p>
                </div>
                <button onClick={logout} className="logout-btn">Logout</button>
            </header>

            <div className="admin-content">
                <div className="invite-codes-section">
                    <div className="section-header">
                        <h2>Invite Codes</h2>
                        <button
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            className="create-btn"
                        >
                            {showCreateForm ? 'Cancel' : 'Create Code'}
                        </button>
                    </div>

                    {showCreateForm && (
                        <form onSubmit={handleCreateCode} className="create-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Email (optional):</label>
                                    <input
                                        type="email"
                                        value={newCode.email}
                                        onChange={(e) => setNewCode({...newCode, email: e.target.value})}
                                        placeholder="user@company.com"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Role:</label>
                                    <select
                                        value={newCode.role}
                                        onChange={(e) => setNewCode({...newCode, role: e.target.value})}
                                    >
                                        <option value="trainee">Trainee</option>
                                        <option value="trainer">Trainer</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Department:</label>
                                    <input
                                        type="text"
                                        value={newCode.department}
                                        onChange={(e) => setNewCode({...newCode, department: e.target.value})}
                                        placeholder="IT Security"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Expires in (days):</label>
                                    <input
                                        type="number"
                                        value={newCode.expiresInDays}
                                        onChange={(e) => setNewCode({...newCode, expiresInDays: parseInt(e.target.value)})}
                                        min="1"
                                        max="365"
                                    />
                                </div>
                            </div>
                            <button type="submit" className="submit-btn">Create Invite Code</button>
                        </form>
                    )}

                    {isLoading ? (
                        <div className="loading">Loading invite codes...</div>
                    ) : (
                        <div className="codes-table">
                            <div className="table-header">
                                <span>Code</span>
                                <span>Email</span>
                                <span>Role</span>
                                <span>Status</span>
                                <span>Expires</span>
                                <span>Actions</span>
                            </div>
                            {inviteCodes.map((code) => (
                                <div key={code.id} className="table-row">
                                    <span className="code">{code.code}</span>
                                    <span>{code.email || 'Any'}</span>
                                    <span className={`role role-${code.role}`}>{code.role}</span>
                                    <span className={`status ${code.is_used ? 'used' : 'available'}`}>
                                        {code.is_used ? `Used by ${code.used_by_name}` : 'Available'}
                                    </span>
                                    <span>{formatDate(code.expires_at)}</span>
                                    <span>
                                        {!code.is_used && (
                                            <button
                                                onClick={() => handleDeleteCode(code.id)}
                                                className="delete-btn"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;