import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { v4 as uuidv4 } from 'uuid';

const AUTH_STORAGE_KEY = 'calendar_auth';
const USERS_STORAGE_KEY = 'calendar_users';

const ADMIN_USER: User = {
    id: 'admin-001',
    name: 'Andre Gabriel',
    email: 'andre.gabriel@ebserh.gov.br',
    role: 'admin',
    createdAt: new Date('2024-01-01'),
};

interface AuthContextType {
    user: User | null;
    users: User[];
    isAdmin: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    addUser: (data: { name: string; email: string; role: UserRole }) => { success: boolean; error?: string };
    updateUser: (user: User) => { success: boolean; error?: string };
    deleteUser: (id: string) => { success: boolean; error?: string };
    canEditEvent: (eventCreatedBy?: string) => boolean;
    canManageCalendars: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function loadStoredUsers(): User[] {
    const saved = localStorage.getItem(USERS_STORAGE_KEY);
    if (saved) {
        return JSON.parse(saved, (key, value) => {
            if (key === 'createdAt') return new Date(value);
            return value;
        });
    }
    return [ADMIN_USER];
}

function saveUsers(users: User[]): void {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function loadStoredAuth(): User | null {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) {
        return JSON.parse(saved, (key, value) => {
            if (key === 'createdAt') return new Date(value);
            return value;
        });
    }
    return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(loadStoredAuth);
    const [users, setUsers] = useState<User[]>(loadStoredUsers);

    // Sync user state with latest users list (role changes, etc.)
    useEffect(() => {
        if (user) {
            const fresh = users.find(u => u.id === user.id);
            if (fresh && (fresh.role !== user.role || fresh.name !== user.name)) {
                setUser(fresh);
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(fresh));
            }
        }
    }, [users, user]);

    const login = useCallback(async (email: string, _password: string): Promise<{ success: boolean; error?: string }> => {
        let normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail.includes('@')) {
            normalizedEmail += '@ebserh.gov.br';
        }

        const existingUser = users.find(u => u.email.toLowerCase() === normalizedEmail);

        if (existingUser) {
            setUser(existingUser);
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(existingUser));
            return { success: true };
        }

        // For AD users not yet registered, only admin can pre-register them
        // But we auto-create on first login with 'user' role
        if (normalizedEmail.endsWith('@ebserh.gov.br')) {
            const namePart = normalizedEmail.split('@')[0].replace(/\./g, ' ');
            const capitalized = namePart.replace(/\b\w/g, c => c.toUpperCase());
            const newUser: User = {
                id: uuidv4(),
                name: capitalized,
                email: normalizedEmail,
                role: 'user',
                createdAt: new Date(),
            };
            const updatedUsers = [...users, newUser];
            setUsers(updatedUsers);
            saveUsers(updatedUsers);
            setUser(newUser);
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
            return { success: true };
        }

        return { success: false, error: 'E-mail deve pertencer ao domínio @ebserh.gov.br' };
    }, [users]);

    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem(AUTH_STORAGE_KEY);
    }, []);

    const addUser = useCallback((data: { name: string; email: string; role: UserRole }): { success: boolean; error?: string } => {
        let email = data.email.trim().toLowerCase();
        if (!email.includes('@')) {
            email += '@ebserh.gov.br';
        }

        if (users.some(u => u.email.toLowerCase() === email)) {
            return { success: false, error: 'Usuário já cadastrado com este e-mail' };
        }

        const newUser: User = {
            id: uuidv4(),
            name: data.name.trim(),
            email,
            role: data.role,
            createdAt: new Date(),
        };
        const updated = [...users, newUser];
        setUsers(updated);
        saveUsers(updated);
        return { success: true };
    }, [users]);

    const updateUser = useCallback((updatedUser: User): { success: boolean; error?: string } => {
        // Prevent removing the last admin
        if (updatedUser.role !== 'admin') {
            const otherAdmins = users.filter(u => u.id !== updatedUser.id && u.role === 'admin');
            if (otherAdmins.length === 0) {
                const original = users.find(u => u.id === updatedUser.id);
                if (original?.role === 'admin') {
                    return { success: false, error: 'Não é possível remover o último administrador' };
                }
            }
        }

        const updated = users.map(u => u.id === updatedUser.id ? updatedUser : u);
        setUsers(updated);
        saveUsers(updated);
        return { success: true };
    }, [users]);

    const deleteUser = useCallback((id: string): { success: boolean; error?: string } => {
        const target = users.find(u => u.id === id);
        if (!target) return { success: false, error: 'Usuário não encontrado' };
        if (target.role === 'admin') {
            const adminCount = users.filter(u => u.role === 'admin').length;
            if (adminCount <= 1) return { success: false, error: 'Não é possível excluir o último administrador' };
        }
        if (user?.id === id) return { success: false, error: 'Não é possível excluir seu próprio usuário' };

        const updated = users.filter(u => u.id !== id);
        setUsers(updated);
        saveUsers(updated);
        return { success: true };
    }, [users, user]);

    const isAdmin = user?.role === 'admin';

    const canEditEvent = useCallback((eventCreatedBy?: string) => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return eventCreatedBy === user.id;
    }, [user]);

    const canManageCalendars = useCallback(() => {
        return user?.role === 'admin';
    }, [user]);

    const value = useMemo<AuthContextType>(() => ({
        user,
        users,
        isAdmin,
        login,
        logout,
        addUser,
        updateUser,
        deleteUser,
        canEditEvent,
        canManageCalendars,
    }), [user, users, isAdmin, login, logout, addUser, updateUser, deleteUser, canEditEvent, canManageCalendars]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
