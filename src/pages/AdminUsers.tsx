import { useState } from 'react';
import { X, ShieldCheck, UserCircle, MagnifyingGlass } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import styles from './AdminUsers.module.css';

interface AdminUsersProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AdminUsers({ isOpen, onClose }: AdminUsersProps) {
    const { users, updateUser, user: currentUser } = useAuth();
    const { showToast } = useToast();

    const [search, setSearch] = useState('');

    if (!isOpen) return null;

    const filteredUsers = users.filter(u => {
        if (!search) return true;
        const q = search.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });

    const handleToggleRole = (u: typeof users[0]) => {
        if (u.id === currentUser?.id) return;
        const newRole = u.role === 'admin' ? 'user' : 'admin';
        const result = updateUser({ ...u, role: newRole });
        if (result.success) {
            showToast(
                newRole === 'admin'
                    ? `${u.name} promovido a administrador`
                    : `${u.name} removido do grupo de administradores`,
                'success'
            );
        } else {
            showToast(result.error || 'Erro ao alterar perfil', 'error');
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Gerenciar Administradores</h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.toolbar}>
                    <div className={styles.searchBox}>
                        <MagnifyingGlass size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou e-mail..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Usuário</th>
                                <th>E-mail</th>
                                <th>Perfil</th>
                                <th>Cadastro</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(u => (
                                <tr key={u.id} className={u.id === currentUser?.id ? styles.currentRow : ''}>
                                    <td>
                                        <div className={styles.userCell}>
                                            <div className={`${styles.avatar} ${u.role === 'admin' ? styles.avatarAdmin : ''}`}>
                                                {u.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className={styles.userName}>{u.name}</span>
                                        </div>
                                    </td>
                                    <td className={styles.emailCell}>{u.email}</td>
                                    <td>
                                        <span className={`${styles.badge} ${u.role === 'admin' ? styles.badgeAdmin : styles.badgeUser}`}>
                                            {u.role === 'admin' ? (
                                                <><ShieldCheck size={14} /> Admin</>
                                            ) : (
                                                <><UserCircle size={14} /> Usuário</>
                                            )}
                                        </span>
                                    </td>
                                    <td className={styles.dateCell}>
                                        {format(u.createdAt, "dd/MM/yyyy", { locale: ptBR })}
                                    </td>
                                    <td>
                                        <div className={styles.actions}>
                                            {u.id !== currentUser?.id && (
                                                <button
                                                    className={styles.actionBtn}
                                                    onClick={() => handleToggleRole(u)}
                                                    title={u.role === 'admin' ? 'Remover admin' : 'Tornar admin'}
                                                >
                                                    {u.role === 'admin' ? <UserCircle size={16} /> : <ShieldCheck size={16} />}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                        <div className={styles.empty}>Nenhum usuário encontrado</div>
                    )}
                </div>

                <div className={styles.footer}>
                    {users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}
                </div>
            </div>
        </div>
    );
}
