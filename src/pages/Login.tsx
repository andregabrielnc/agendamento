import { useState } from 'react';
import { Eye, EyeSlash, CircleNotch, GraduationCap, CalendarBlank, ListChecks } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import styles from './Login.module.css';

interface LoginProps {
    onPresenca?: () => void;
}

export function Login({ onPresenca }: LoginProps) {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
            setError('Informe seu e-mail ou usuário');
            return;
        }
        if (!password.trim()) {
            setError('Informe sua senha');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const result = await login(email, password);
            if (!result.success) {
                setError(result.error || 'Falha na autenticação');
            }
        } catch {
            setError('Erro de conexão. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.bgPattern} />

            <div className={styles.container}>
                {/* Left Panel - Branding */}
                <div className={styles.brandPanel}>
                    <div className={styles.brandContent}>
                        <div className={styles.brandIcon}>
                            <GraduationCap size={48} weight="duotone" />
                        </div>
                        <h1 className={styles.brandTitle}>E-Saúde Agendamentos</h1>
                        <p className={styles.brandSubtitle}>
                            Aplicativo de agendamento de espaços de Ensino
                        </p>
                        <div className={styles.brandFeatures}>
                            <div className={styles.featureItem}>
                                <CalendarBlank size={20} weight="fill" />
                                <span>Reserve salas de forma simples e rápida</span>
                            </div>
                            <div className={styles.featureItem}>
                                <CalendarBlank size={20} weight="fill" />
                                <span>Visualize a disponibilidade em tempo real</span>
                            </div>
                            <div className={styles.featureItem}>
                                <CalendarBlank size={20} weight="fill" />
                                <span>Gerencie seus agendamentos facilmente</span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.brandFooter}>
                        <span>Andre Gabriel N. Carvalho — UES/GEP</span>
                        <span>Versão 3.1</span>
                        <span>Contato Teams: andre.gabriel@ebserh.gov.br</span>
                    </div>
                </div>

                {/* Right Panel - Login Form */}
                <div className={styles.formPanel}>
                    <form className={styles.form} onSubmit={handleSubmit}>
                        <div className={styles.formHeader}>
                            <h2 className={styles.formTitle}>Entrar</h2>
                            <p className={styles.formDescription}>
                                Use suas credenciais
                            </p>
                        </div>

                        {error && (
                            <div className={styles.errorBox}>
                                {error}
                            </div>
                        )}

                        <div className={styles.fieldGroup}>
                            <label className={styles.label} htmlFor="email">
                                E-mail ou usuário
                            </label>
                            <div className={styles.inputWrapper}>
                                <input
                                    id="email"
                                    type="text"
                                    className={styles.input}
                                    value={email}
                                    onChange={e => { setEmail(e.target.value); setError(''); }}
                                    placeholder="nome.sobrenome"
                                    autoComplete="username"
                                    autoFocus
                                    disabled={loading}
                                />
                                <span className={styles.inputSuffix}>@ebserh.gov.br</span>
                            </div>
                        </div>

                        <div className={styles.fieldGroup}>
                            <label className={styles.label} htmlFor="password">
                                Senha
                            </label>
                            <div className={styles.passwordWrapper}>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    className={styles.input}
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setError(''); }}
                                    placeholder="Sua senha do AD"
                                    autoComplete="current-password"
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    className={styles.togglePassword}
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={loading}
                        >
                            {loading ? (
                                <CircleNotch size={20} className={styles.spinner} />
                            ) : (
                                'Entrar'
                            )}
                        </button>

                        <p className={styles.helpText}>
                            <a href="https://servicosti.ebserh.gov.br/" target="_blank" rel="noopener noreferrer" className={styles.recoveryLink}>
                                Recuperar minha senha
                            </a>
                        </p>

                        {onPresenca && (
                            <div className={styles.presencaDivider}>
                                <span className={styles.presencaDividerLine} />
                                <span className={styles.presencaDividerText}>ou</span>
                                <span className={styles.presencaDividerLine} />
                            </div>
                        )}

                        {onPresenca && (
                            <button
                                type="button"
                                className={styles.presencaBtn}
                                onClick={onPresenca}
                            >
                                <ListChecks size={20} weight="bold" />
                                Registrar Presença em Sala
                            </button>
                        )}

                        <div className={styles.formLogo}>
                            <img src="/logo_hc.png" alt="EBSERH — Empresa Brasileira de Serviços Hospitalares" />
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
