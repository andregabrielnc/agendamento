import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, ArrowLeft, Plus, Lock, UploadSimple, Check, CaretLeft, CaretRight, DownloadSimple, MagnifyingGlass } from '@phosphor-icons/react';
import { useCalendar } from '../context/CalendarContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { parseICS } from '../utils/icsParser';
import { exportToExcel } from '../utils/exportExcel';
import styles from './SettingsModal.module.css';
import type { Calendar } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialCalendarId?: string;
}

type View = 'general' | 'calendars' | 'calendar-details';

const PRESET_COLORS = [
    '#d50000', '#e67c73', '#f4511e', '#f6bf26', '#33b679', '#0b8043',
    '#039be5', '#3f51b5', '#7986cb', '#8e24aa', '#616161', '#a79b8e',
    '#ad1457', '#d81b60', '#e91e63', '#f09300', '#009688', '#00897b',
    '#4285f4', '#5e6ec7', '#b39ddb', '#9e69af', '#795548', '#bcaaa4',
];

export function SettingsModal({ isOpen, onClose, initialCalendarId }: SettingsModalProps) {
    const { calendars, addCalendar, updateCalendar, deleteCalendar, addEvent } = useCalendar();
    const { isAdmin } = useAuth();
    const { showToast } = useToast();
    const [activeView, setActiveView] = useState<View>('general');
    const [selectedCalendar, setSelectedCalendar] = useState<Calendar | null>(null);
    const [initializedFor, setInitializedFor] = useState<string | undefined>(undefined);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#818cf8');

    // Navigate to specific calendar when initialCalendarId is provided
    if (isOpen && initialCalendarId && initializedFor !== initialCalendarId) {
        const cal = calendars.find(c => c.id === initialCalendarId);
        if (cal) {
            setSelectedCalendar(cal);
            setName(cal.name);
            setDescription(cal.description || '');
            setColor(cal.color);
            setActiveView('calendar-details');
            setInitializedFor(initialCalendarId);
        }
    }
    if (!isOpen && initializedFor) {
        setInitializedFor(undefined);
    }

    // ICS Import State
    const [icsFile, setIcsFile] = useState<File | null>(null);
    const [icsEventCount, setIcsEventCount] = useState(0);

    // Stats/Report State
    type StatsTab = 'resumo' | 'nominal';
    type StatsPeriodo = 'mensal' | 'anual';
    const [statsTab, setStatsTab] = useState<StatsTab>('resumo');
    const [statsPeriodo, setStatsPeriodo] = useState<StatsPeriodo>('mensal');
    const now = new Date();
    const [statsMes, setStatsMes] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    const [statsAno, setStatsAno] = useState(String(now.getFullYear()));
    const [statsData, setStatsData] = useState<{ sala_nome: string; total_eventos: number; total_presencas: number }[]>([]);
    const [statsTotais, setStatsTotais] = useState<{ total_eventos: number; total_presencas: number }>({ total_eventos: 0, total_presencas: 0 });
    const [nominalData, setNominalData] = useState<{ nome_completo: string; email: string; evento_titulo: string; sala_nome: string; criado_em: string }[]>([]);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsSala, setStatsSala] = useState('');
    const [statsSearch, setStatsSearch] = useState('');
    const [statsPage, setStatsPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    const fetchStats = useCallback(async () => {
        if (!isAdmin) return;
        setStatsLoading(true);
        try {
            const params = statsPeriodo === 'mensal'
                ? `periodo=mensal&mes=${statsMes}`
                : `periodo=anual&ano=${statsAno}`;

            if (statsTab === 'resumo') {
                const res = await fetch(`/api/router.php?route=presencas/stats&${params}`, { credentials: 'include' });
                const json = await res.json();
                setStatsData(json.dados || []);
                setStatsTotais(json.totais || { total_eventos: 0, total_presencas: 0 });
            } else {
                const res = await fetch(`/api/router.php?route=presencas/nominal&${params}`, { credentials: 'include' });
                const json = await res.json();
                setNominalData(json.dados || []);
            }
        } catch {
            setStatsData([]);
            setNominalData([]);
        } finally {
            setStatsLoading(false);
        }
    }, [isAdmin, statsTab, statsPeriodo, statsMes, statsAno]);

    useEffect(() => {
        if (isOpen && activeView === 'general' && isAdmin) {
            fetchStats();
        }
    }, [isOpen, activeView, isAdmin, fetchStats]);

    const navigatePeriod = (direction: -1 | 1) => {
        if (statsPeriodo === 'mensal') {
            const [y, m] = statsMes.split('-').map(Number);
            const d = new Date(y, m - 1 + direction, 1);
            setStatsMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        } else {
            setStatsAno(String(Number(statsAno) + direction));
        }
    };

    // Reset page when filters change
    useEffect(() => {
        setStatsPage(1);
    }, [statsTab, statsSala, statsSearch, statsPeriodo, statsMes, statsAno]);

    // Filtered stats (resumo)
    const filteredStatsData = useMemo(() => {
        if (!statsSala) return statsData;
        return statsData.filter(r => r.sala_nome === statsSala);
    }, [statsData, statsSala]);

    const filteredStatsTotais = useMemo(() => {
        if (!statsSala) return statsTotais;
        return filteredStatsData.reduce(
            (acc, r) => ({ total_eventos: acc.total_eventos + r.total_eventos, total_presencas: acc.total_presencas + r.total_presencas }),
            { total_eventos: 0, total_presencas: 0 }
        );
    }, [filteredStatsData, statsSala, statsTotais]);

    // Filtered nominal (search + sala)
    const filteredNominalData = useMemo(() => {
        let data = nominalData;
        if (statsSala) {
            data = data.filter(r => r.sala_nome === statsSala);
        }
        if (statsSearch) {
            const q = statsSearch.toLowerCase();
            data = data.filter(r =>
                r.nome_completo.toLowerCase().includes(q) ||
                r.email.toLowerCase().includes(q) ||
                r.evento_titulo.toLowerCase().includes(q) ||
                r.sala_nome.toLowerCase().includes(q)
            );
        }
        return data;
    }, [nominalData, statsSala, statsSearch]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredNominalData.length / ITEMS_PER_PAGE));
    const paginatedNominal = filteredNominalData.slice((statsPage - 1) * ITEMS_PER_PAGE, statsPage * ITEMS_PER_PAGE);

    // Sala options from calendars context
    const salaOptions = calendars.map(c => c.name).sort();

    const getDisplayPeriod = () => {
        if (statsPeriodo === 'mensal') {
            const [y, m] = statsMes.split('-').map(Number);
            const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            return `${meses[m - 1]} ${y}`;
        }
        return statsAno;
    };

    const handleExportResumo = () => {
        exportToExcel(filteredStatsData as unknown as Record<string, unknown>[], `resumo_${statsPeriodo === 'mensal' ? statsMes : statsAno}`, [
            { key: 'sala_nome', header: 'Sala' },
            { key: 'total_eventos', header: 'Eventos' },
            { key: 'total_presencas', header: 'Presenças' },
        ]);
    };

    const handleExportNominal = () => {
        const formatted = filteredNominalData.map(r => ({
            ...r,
            criado_em_fmt: new Date(r.criado_em).toLocaleDateString('pt-BR'),
        }));
        exportToExcel(formatted as unknown as Record<string, unknown>[], `nominal_${statsPeriodo === 'mensal' ? statsMes : statsAno}`, [
            { key: 'nome_completo', header: 'Nome' },
            { key: 'email', header: 'E-mail' },
            { key: 'evento_titulo', header: 'Evento' },
            { key: 'sala_nome', header: 'Sala' },
            { key: 'criado_em_fmt', header: 'Data' },
        ]);
    };

    if (!isOpen) return null;

    const handleCalendarClick = (calendar: Calendar) => {
        if (!isAdmin) return;
        setSelectedCalendar(calendar);
        setName(calendar.name);
        setDescription(calendar.description || '');
        setColor(calendar.color);
        setActiveView('calendar-details');
    };

    const handleAddClick = () => {
        if (!isAdmin) return;
        setSelectedCalendar(null);
        setName('');
        setDescription('');
        setColor('#818cf8');
        setIcsFile(null);
        setIcsEventCount(0);
        setActiveView('calendar-details');
    };

    const handleIcsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.ics')) {
            showToast('Selecione um arquivo .ics', 'error');
            return;
        }

        const text = await file.text();
        const parsed = parseICS(text);
        setIcsFile(file);
        setIcsEventCount(parsed.length);
    };

    const handleSave = async () => {
        if (!name.trim() || !isAdmin) return;

        if (selectedCalendar) {
            updateCalendar({
                ...selectedCalendar,
                name,
                description,
                color
            });
        } else {
            const result = await addCalendar({
                name,
                description,
                color,
                visible: true
            });

            if (icsFile && result.success && result.data) {
                const newCalId = result.data.id;
                const text = await icsFile.text();
                const parsedEvents = parseICS(text);

                for (const evt of parsedEvents) {
                    await addEvent({
                        title: evt.title,
                        start: evt.start,
                        end: evt.end,
                        description: evt.description,
                        calendarId: newCalId,
                        color,
                        allDay: evt.allDay,
                    });
                }
                showToast(`${parsedEvents.length} evento${parsedEvents.length !== 1 ? 's' : ''} importado${parsedEvents.length !== 1 ? 's' : ''}`, 'success');
            }
        }

        setIcsFile(null);
        setIcsEventCount(0);
        setActiveView('calendars');
    };

    const handleDelete = () => {
        if (selectedCalendar && isAdmin) {
            deleteCalendar(selectedCalendar.id);
            setActiveView('calendars');
        }
    };

    const renderContent = () => {
        switch (activeView) {
            case 'general':
                if (!isAdmin) {
                    return (
                        <div className={styles.body}>
                            <h3>Geral</h3>
                            <p>Configurações gerais do calendário (idioma, fuso horário) seriam exibidas aqui.</p>
                            <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>
                                Atualmente, o idioma está definido como <strong>Português (Brasil)</strong> e o tema segue sua preferência (Claro/Escuro).
                            </p>
                        </div>
                    );
                }
                return (
                    <div className={styles.body}>
                        <div className={styles.statsHeader}>
                            <h3>Relatório de Presenças</h3>
                        </div>
                        <div className={styles.statsControls}>
                            <div className={styles.statsTabGroup}>
                                <button
                                    className={`${styles.statsTabBtn} ${statsTab === 'resumo' ? styles.statsTabBtnActive : ''}`}
                                    onClick={() => setStatsTab('resumo')}
                                >
                                    Resumo
                                </button>
                                <button
                                    className={`${styles.statsTabBtn} ${statsTab === 'nominal' ? styles.statsTabBtnActive : ''}`}
                                    onClick={() => setStatsTab('nominal')}
                                >
                                    Nominal
                                </button>
                            </div>
                            <div className={styles.statsNavGroup}>
                                <select
                                    className={styles.periodSelect}
                                    value={statsPeriodo}
                                    onChange={e => setStatsPeriodo(e.target.value as StatsPeriodo)}
                                >
                                    <option value="mensal">Mensal</option>
                                    <option value="anual">Anual</option>
                                </select>
                                <button className={styles.navArrow} onClick={() => navigatePeriod(-1)}>
                                    <CaretLeft size={16} />
                                </button>
                                <span className={styles.periodLabel}>{getDisplayPeriod()}</span>
                                <button className={styles.navArrow} onClick={() => navigatePeriod(1)}>
                                    <CaretRight size={16} />
                                </button>
                                <button
                                    className={styles.exportBtn}
                                    onClick={statsTab === 'resumo' ? handleExportResumo : handleExportNominal}
                                    title="Exportar Excel"
                                >
                                    <DownloadSimple size={16} />
                                </button>
                            </div>
                        </div>

                        <div className={styles.statsFilters}>
                            <select
                                className={styles.salaSelect}
                                value={statsSala}
                                onChange={e => setStatsSala(e.target.value)}
                            >
                                <option value="">Todas as salas</option>
                                {salaOptions.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            <div className={styles.searchBox}>
                                <MagnifyingGlass size={14} className={styles.searchIcon} />
                                <input
                                    type="text"
                                    className={styles.searchInput}
                                    placeholder="Pesquisar..."
                                    value={statsSearch}
                                    onChange={e => setStatsSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        {statsLoading ? (
                            <p className={styles.emptyStats}>Carregando...</p>
                        ) : statsTab === 'resumo' ? (
                            filteredStatsData.length === 0 ? (
                                <p className={styles.emptyStats}>Nenhum dado encontrado para este período.</p>
                            ) : (
                                <table className={styles.statsTable}>
                                    <thead>
                                        <tr>
                                            <th>Sala</th>
                                            <th>Eventos</th>
                                            <th>Presenças</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStatsData.map((row, i) => (
                                            <tr key={i}>
                                                <td>{row.sala_nome}</td>
                                                <td>{row.total_eventos}</td>
                                                <td>{row.total_presencas}</td>
                                            </tr>
                                        ))}
                                        <tr className={styles.totalRow}>
                                            <td>TOTAL</td>
                                            <td>{filteredStatsTotais.total_eventos}</td>
                                            <td>{filteredStatsTotais.total_presencas}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            )
                        ) : (
                            filteredNominalData.length === 0 ? (
                                <p className={styles.emptyStats}>Nenhum dado encontrado para este período.</p>
                            ) : (
                                <>
                                    <table className={styles.statsTable}>
                                        <thead>
                                            <tr>
                                                <th>Nome</th>
                                                <th>E-mail</th>
                                                <th>Evento</th>
                                                <th>Sala</th>
                                                <th>Data</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedNominal.map((row, i) => (
                                                <tr key={i}>
                                                    <td>{row.nome_completo}</td>
                                                    <td>{row.email}</td>
                                                    <td>{row.evento_titulo}</td>
                                                    <td>{row.sala_nome}</td>
                                                    <td>{new Date(row.criado_em).toLocaleDateString('pt-BR')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className={styles.pagination}>
                                        <button
                                            className={styles.navArrow}
                                            onClick={() => setStatsPage(p => Math.max(1, p - 1))}
                                            disabled={statsPage <= 1}
                                        >
                                            <CaretLeft size={14} />
                                        </button>
                                        <span className={styles.pageInfo}>
                                            Página {statsPage} de {totalPages}
                                            <span className={styles.pageCount}>({filteredNominalData.length} registro{filteredNominalData.length !== 1 ? 's' : ''})</span>
                                        </span>
                                        <button
                                            className={styles.navArrow}
                                            onClick={() => setStatsPage(p => Math.min(totalPages, p + 1))}
                                            disabled={statsPage >= totalPages}
                                        >
                                            <CaretRight size={14} />
                                        </button>
                                    </div>
                                </>
                            )
                        )}
                    </div>
                );
            case 'calendars':
                return (
                    <div className={styles.body}>
                        {isAdmin ? (
                            <button className={styles.addBtn} onClick={handleAddClick}>
                                <Plus size={16} />
                                Adicionar sala / agenda
                            </button>
                        ) : (
                            <div className={styles.readOnlyNotice}>
                                <Lock size={16} />
                                <span>Somente administradores podem criar ou editar salas</span>
                            </div>
                        )}
                        <div className={styles.calendarList}>
                            {calendars.map(calendar => (
                                <div
                                    key={calendar.id}
                                    className={`${styles.calendarItem} ${!isAdmin ? styles.calendarItemReadOnly : ''}`}
                                    onClick={() => handleCalendarClick(calendar)}
                                >
                                    <div className={styles.calendarInfo}>
                                        <div className={styles.colorDot} style={{ backgroundColor: calendar.color }} />
                                        <span className={styles.calendarName}>{calendar.name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'calendar-details':
                return (
                    <div className={styles.body}>
                        <div className={styles.form}>
                            <div className={styles.formGroup}>
                                <label>Nome da Sala / Agenda</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ex: Sala 101 - Bloco A"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Descrição</label>
                                <textarea
                                    className={styles.textarea}
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Capacidade, equipamentos disponíveis..."
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Cor</label>
                                <div className={styles.colorPalette}>
                                    {PRESET_COLORS.map(c => {
                                        const usedBy = calendars.find(
                                            cal => cal.color === c && cal.id !== selectedCalendar?.id
                                        );
                                        const isSelected = color === c;
                                        const isDisabled = !!usedBy;
                                        return (
                                            <button
                                                key={c}
                                                className={`${styles.paletteColor} ${isSelected ? styles.paletteColorSelected : ''} ${isDisabled ? styles.paletteColorDisabled : ''}`}
                                                style={{ backgroundColor: c }}
                                                onClick={() => !isDisabled && setColor(c)}
                                                title={isDisabled ? `Já utilizada por ${usedBy.name}` : c}
                                                type="button"
                                            >
                                                {isSelected && <Check size={14} weight="bold" color="#fff" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {!selectedCalendar && (
                                <div className={styles.formGroup}>
                                    <label>Importar eventos (.ics)</label>
                                    <div className={styles.icsUpload}>
                                        <label className={styles.icsUploadBtn}>
                                            <UploadSimple size={16} />
                                            {icsFile ? icsFile.name : 'Selecionar arquivo .ics'}
                                            <input
                                                type="file"
                                                accept=".ics"
                                                onChange={handleIcsFileChange}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                        {icsEventCount > 0 && (
                                            <span className={styles.icsCount}>
                                                {icsEventCount} evento{icsEventCount !== 1 ? 's' : ''} encontrado{icsEventCount !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className={styles.buttonGroup}>
                                <button className={styles.saveBtn} onClick={handleSave}>Salvar</button>
                                <button className={styles.cancelBtn} onClick={() => setActiveView('calendars')}>Cancelar</button>
                                {selectedCalendar && (
                                    <button className={styles.deleteBtn} onClick={handleDelete}>Excluir</button>
                                )}
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.sidebar}>
                    <div className={styles.sidebarTitle}>Configurações</div>

                    <div className={styles.sidebarSection}>
                        <div className={styles.sectionTitle}>Geral</div>
                        <button
                            className={`${styles.navItem} ${activeView === 'general' ? styles.active : ''}`}
                            onClick={() => setActiveView('general')}
                        >
                            Geral
                        </button>
                    </div>

                    <div className={styles.sidebarSection}>
                        <div className={styles.sectionTitle}>Salas / Agendas</div>
                        <button
                            className={`${styles.navItem} ${activeView === 'calendars' || activeView === 'calendar-details' ? styles.active : ''}`}
                            onClick={() => setActiveView('calendars')}
                        >
                            Configurações das salas
                        </button>
                    </div>
                </div>

                <div className={styles.content}>
                    <div className={styles.header}>
                        <div className={styles.headerTitle}>
                            {activeView === 'calendar-details' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <button
                                        onClick={() => setActiveView('calendars')}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                    {selectedCalendar ? 'Detalhes da sala' : 'Nova sala'}
                                </div>
                            ) : (
                                activeView === 'general' ? 'Configurações' : 'Configurações'
                            )}
                        </div>
                        <button onClick={onClose} className={styles.closeBtn}>
                            <X size={20} />
                        </button>
                    </div>
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}
