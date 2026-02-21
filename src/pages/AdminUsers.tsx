import { useState } from 'react';
import { X, ShieldCheck, UserCircle, MagnifyingGlass, Plus, FloppyDisk, XCircle } from '@phosphor-icons/react';
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
    const { users, updateUser, createUser, user: currentUser, isAdmin } = useAuth();
    const { showToast } = useToast();

    const [search, setSearch] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const newRole = 'admin';

    if (!isOpen) return null;

    const filteredUsers = users.filter(u => {
        if (!search) return true;
        const q = search.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });

    const handleToggleRole = async (u: typeof users[0]) => {
        if (u.id === currentUser?.id) return;
        const newRole = u.role === 'admin' ? 'user' : 'admin';
        const result = await updateUser({ ...u, role: newRole });
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

    const handleCreateUser = async () => {
        if (!newName.trim() || !newEmail.trim()) {
            showToast('Nome e e-mail são obrigatórios', 'error');
            return;
        }
        const fullEmail = newEmail.includes('@') ? newEmail : `${newEmail}@ebserh.gov.br`;
        const result = await createUser({ name: newName.trim(), email: fullEmail, role: newRole });
        if (result.success) {
            showToast(`Usuário ${newName.trim()} cadastrado com sucesso`, 'success');
            setNewName('');
            setNewEmail('');
            setShowAddForm(false);
        } else {
            showToast(result.error || 'Erro ao cadastrar usuário', 'error');
        }
    };

    const handleCancelAdd = () => {
        setNewName('');
        setNewEmail('');
        setShowAddForm(false);
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
                    {isAdmin && (
                        <button
                            className={styles.addBtn}
                            onClick={() => setShowAddForm(!showAddForm)}
                            title="Cadastrar usuário"
                        >
                            <Plus size={18} />
                        </button>
                    )}
                </div>

                {showAddForm && (
                    <div className={styles.addForm}>
                        <div className={styles.addFormRow}>
                            <div className={styles.addFormField}>
                                <label>Nome</label>
                                <input
                                    type="text"
                                    placeholder="Nome completo"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                />
                            </div>
                            <div className={styles.addFormField}>
                                <label>E-mail</label>
                                <div className={styles.emailInputGroup}>
                                    <input
                                        type="text"
                                        placeholder="usuario"
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                    />
                                    <span className={styles.emailSuffix}>@ebserh.gov.br</span>
                                </div>
                            </div>
                        </div>
                        <div className={styles.addFormRow}>
                            <div className={styles.addFormActions}>
                                <button
                                    className={styles.addFormIconBtn}
                                    onClick={handleCancelAdd}
                                    title="Cancelar"
                                >
                                    <XCircle size={20} />
                                </button>
                                <button
                                    className={`${styles.addFormIconBtn} ${styles.addFormIconSave}`}
                                    onClick={handleCreateUser}
                                    title="Salvar"
                                >
                                    <FloppyDisk size={20} />
                                </button>
                            </div>
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
                                    <td data-label="Usuário">
                                        <div className={styles.userCell}>
                                            <div className={`${styles.avatar} ${u.role === 'admin' ? styles.avatarAdmin : ''}`}>
                                                {u.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className={styles.userName}>{u.name}</span>
                                        </div>
                                    </td>
                                    <td className={styles.emailCell} data-label="E-mail">{u.email}</td>
                                    <td data-label="Perfil">
                                        <span className={`${styles.badge} ${u.role === 'admin' ? styles.badgeAdmin : styles.badgeUser}`}>
                                            {u.role === 'admin' ? (
                                                <><ShieldCheck size={14} /> Admin</>
                                            ) : (
                                                <><UserCircle size={14} /> Usuário</>
                                            )}
                                        </span>
                                    </td>
                                    <td className={styles.dateCell} data-label="Cadastro">
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
