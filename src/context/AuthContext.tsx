import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, UserRole } from '../types';

interface AuthContextType {
    user: User | null;
    users: User[];
    isAdmin: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    updateUser: (user: User) => Promise<{ success: boolean; error?: string }>;
    createUser: (data: { name: string; email: string; role: string }) => Promise<{ success: boolean; error?: string }>;
    canEditEvent: (eventCreatedBy?: string) => boolean;
    canManageCalendars: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'calendar_auth_session';

function parseUser(data: Record<string, unknown>): User {
    return {
        id: data.id as string,
        name: data.name as string,
        email: data.email as string,
        role: data.role as UserRole,
        avatarUrl: data.avatarUrl as string | undefined,
        createdAt: typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt as Date,
    };
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        const saved = sessionStorage.getItem(SESSION_KEY);
        if (saved) {
            return JSON.parse(saved, (key, value) => {
                if (key === 'createdAt') return new Date(value);
                return value;
            });
        }
        return null;
    });
    const [users, setUsers] = useState<User[]>([]);

    // Restore session from API on mount
    useEffect(() => {
        fetch('/api/router.php?route=auth/me', {
            headers: { 'Content-Type': 'application/json' },
        })
            .then(res => res.json())
            .then(data => {
                if (data && !data.error && data.id) {
                    const u = parseUser(data);
                    setUser(u);
                    sessionStorage.setItem(SESSION_KEY, JSON.stringify(u));
                }
            })
            .catch(() => {});
    }, []);

    // Load users list when logged in
    useEffect(() => {
        if (user) {
            fetch('/api/router.php?route=users', {
                headers: { 'Content-Type': 'application/json' },
            })
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setUsers(data.map((u: Record<string, unknown>) => parseUser(u)));
                    }
                })
                .catch(() => {});
        } else {
            setUsers([]);
        }
    }, [user]);

    const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const res = await fetch('/api/router.php?route=auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();

            if (!res.ok || data.error) {
                return { success: false, error: data.error || 'Erro no login' };
            }

            const u = parseUser(data);
            setUser(u);
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(u));
            return { success: true };
        } catch {
            return { success: false, error: 'Erro ao conectar com o servidor' };
        }
    }, []);

    const logout = useCallback(() => {
        fetch('/api/router.php?route=auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }).catch(() => {});

        setUser(null);
        setUsers([]);
        sessionStorage.removeItem(SESSION_KEY);
    }, []);

    const updateUser = useCallback(async (updatedUser: User): Promise<{ success: boolean; error?: string }> => {
        try {
            const res = await fetch(`/api/router.php?route=users/${updatedUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: updatedUser.name,
                    role: updatedUser.role,
                    avatarUrl: updatedUser.avatarUrl,
                }),
            });
            const data = await res.json();

            if (!res.ok || data.error) {
                return { success: false, error: data.error || 'Erro ao atualizar usuário' };
            }

            const mapped = parseUser(data);
            setUsers(prev => prev.map(u => u.id === mapped.id ? mapped : u));

            if (user?.id === mapped.id) {
                setUser(mapped);
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(mapped));
            }

            return { success: true };
        } catch {
            return { success: false, error: 'Erro ao atualizar usuário' };
        }
    }, [user]);

    const createUser = useCallback(async (data: { name: string; email: string; role: string }): Promise<{ success: boolean; error?: string }> => {
        try {
            const res = await fetch('/api/router.php?route=users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const responseData = await res.json();

            if (!res.ok || responseData.error) {
                return { success: false, error: responseData.error || 'Erro ao cadastrar usuário' };
            }

            const mapped = parseUser(responseData);
            setUsers(prev => [...prev, mapped]);

            return { success: true };
        } catch {
            return { success: false, error: 'Erro ao cadastrar usuário' };
        }
    }, []);

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
        updateUser,
        createUser,
        canEditEvent,
        canManageCalendars,
    }), [user, users, isAdmin, login, logout, updateUser, createUser, canEditEvent, canManageCalendars]);

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
