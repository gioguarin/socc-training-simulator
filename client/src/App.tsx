import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import './App.css';

export interface Player {
  id: string;
  name: string;
  role: 'responder' | 'caller' | null;
  gameId: string | null;
}

export interface Scenario {
  id: string;
  title: string;
  callerScript: string;
  falseInfo: string;
  responderGoals: string[];
}

export interface GameState {
  gameId: string;
  role: 'responder' | 'caller';
  opponent: string;
  scenario: Scenario;
}

// Component to handle authenticated app routing
const AppRoutes: React.FC = () => {
    const { user } = useAuth();

    return (
        <Routes>
            {/* Public routes */}
            <Route path="/login" element={
                user ? <Navigate to="/dashboard" replace /> : <Login />
            } />
            <Route path="/register" element={
                user ? <Navigate to="/dashboard" replace /> : <Register />
            } />

            {/* Protected routes */}
            <Route path="/dashboard" element={
                <ProtectedRoute>
                    <UserDashboard />
                </ProtectedRoute>
            } />

            <Route path="/lobby" element={
                <ProtectedRoute>
                    <Lobby />
                </ProtectedRoute>
            } />

            <Route path="/game/:gameId" element={
                <ProtectedRoute>
                    <GameRoom />
                </ProtectedRoute>
            } />

            {/* Admin routes */}
            <Route path="/admin/*" element={
                <ProtectedRoute requiredRole="admin">
                    <AdminDashboard />
                </ProtectedRoute>
            } />

            {/* Default redirect */}
            <Route path="/" element={
                <Navigate to={user ? "/dashboard" : "/login"} replace />
            } />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="app">
                    <AppRoutes />
                </div>
            </Router>
        </AuthProvider>
    );
}

export default App;