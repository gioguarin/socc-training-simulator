import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'trainer' | 'trainee';
    department?: string;
}

interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string, inviteCode: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
    error: string | null;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Check for stored token on app load
        const token = localStorage.getItem('auth_token');
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            // Validate token and get user info
            fetchUserProfile();
        } else {
            setIsLoading(false);
        }
    }, []);

    const fetchUserProfile = async () => {
        try {
            const response = await axios.get('http://localhost:3001/api/auth/me');
            setUser(response.data);
        } catch (error) {
            // Token invalid, clear it
            localStorage.removeItem('auth_token');
            delete axios.defaults.headers.common['Authorization'];
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, password: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.post('http://localhost:3001/api/auth/login', { email, password });
            const { user, token } = response.data;

            localStorage.setItem('auth_token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            setUser(user);
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || 'Login failed';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (name: string, email: string, password: string, inviteCode: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.post('http://localhost:3001/api/auth/register', {
                name,
                email,
                password,
                inviteCode
            });
            const { user, token } = response.data;

            localStorage.setItem('auth_token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            setUser(user);
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || 'Registration failed';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
        setError(null);
    };

    const clearError = () => setError(null);

    const value: AuthContextType = {
        user,
        login,
        register,
        logout,
        isLoading,
        error,
        clearError
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};