import { useState } from 'react';
import { X, Plus, PencilSimple, Trash, ShieldCheck, UserCircle, MagnifyingGlass } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import styles from './AdminUsers.module.css';
import type { User, UserRole } from '../types';

interface AdminUsersProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AdminUsers({ isOpen, onClose }: AdminUsersProps) {
    const { users, addUser, updateUser, deleteUser, user: currentUser } = useAuth();
    const { showToast } = useToast();

    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formRole, setFormRole] = useState<UserRole>('user');

    if (!isOpen) return null;

    const filteredUsers = users.filter(u => {
        if (!search) return true;
        const q = search.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });

    const openAddForm = () => {
        setEditingUser(null);
        setFormName('');
        setFormEmail('');
        setFormRole('user');
        setShowForm(true);
    };

    const openEditForm = (user: User) => {
        setEditingUser(user);
        setFormName(user.name);
        setFormEmail(user.email);
        setFormRole(user.role);
        setShowForm(true);
    };

    const handleSave = () => {
        if (!formName.trim()) {
            showToast('Nome é obrigatório', 'error');
            return;
        }
        if (!formEmail.trim()) {
            showToast('E-mail é obrigatório', 'error');
            return;
        }

        if (editingUser) {
            const result = updateUser({
                ...editingUser,
                name: formName.trim(),
                email: formEmail.trim().toLowerCase(),
                role: formRole,
            });
            if (result.success) {
                showToast('Usuário atualizado', 'success');
                setShowForm(false);
            } else {
                showToast(result.error || 'Erro ao atualizar', 'error');
            }
        } else {
            const result = addUser({
                name: formName.trim(),
                email: formEmail.trim(),
                role: formRole,
            });
            if (result.success) {
                showToast('Usuário cadastrado', 'success');
                setShowForm(false);
            } else {
                showToast(result.error || 'Erro ao cadastrar', 'error');
            }
        }
    };

    const handleDelete = (user: User) => {
        const result = deleteUser(user.id);
        if (result.success) {
            showToast(`${user.name} removido`, 'info');
        } else {
            showToast(result.error || 'Erro ao remover', 'error');
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Gerenciar Usuários</h2>
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
                    <button className={styles.addBtn} onClick={openAddForm}>
                        <Plus size={16} weight="bold" />
                        Novo Usuário
                    </button>
                </div>

                {showForm && (
                    <div className={styles.formCard}>
                        <h3 className={styles.formTitle}>
                            {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                        </h3>
                        <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                                <label>Nome completo</label>
                                <input
                                    type="text"
                                    className={styles.formInput}
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    placeholder="Nome do usuário"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>E-mail</label>
                                <input
                                    type="text"
                                    className={styles.formInput}
                                    value={formEmail}
                                    onChange={e => setFormEmail(e.target.value)}
                                    placeholder="usuario@ebserh.gov.br"
                                    disabled={!!editingUser}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Perfil</label>
                                <select
                                    className={styles.formSelect}
                                    value={formRole}
                                    onChange={e => setFormRole(e.target.value as UserRole)}
                                >
                                    <option value="user">Usuário</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>
                        </div>
                        <div className={styles.formActions}>
                            <button className={styles.saveBtn} onClick={handleSave}>
                                {editingUser ? 'Salvar Alterações' : 'Cadastrar'}
                            </button>
                            <button className={styles.cancelBtn} onClick={() => setShowForm(false)}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

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
                                            <button
                                                className={styles.actionBtn}
                                                onClick={() => openEditForm(u)}
                                                title="Editar"
                                            >
                                                <PencilSimple size={16} />
                                            </button>
                                            {u.id !== currentUser?.id && (
                                                <button
                                                    className={`${styles.actionBtn} ${styles.deleteAction}`}
                                                    onClick={() => handleDelete(u)}
                                                    title="Remover"
                                                >
                                                    <Trash size={16} />
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
