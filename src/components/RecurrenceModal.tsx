import { useState, useEffect } from 'react';
import styles from './RecurrenceModal.module.css';

export interface RecurrenceRule {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, etc.
    endDate?: Date;
    occurrenceCount?: number;
    endType: 'never' | 'date' | 'count';
}

interface RecurrenceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (rule: RecurrenceRule) => void;
    initialRule?: RecurrenceRule;
}

const WEEKDAYS = [
    { label: 'D', value: 0 },
    { label: 'S', value: 1 },
    { label: 'T', value: 2 },
    { label: 'Q', value: 3 },
    { label: 'Q', value: 4 },
    { label: 'S', value: 5 },
    { label: 'S', value: 6 },
];

export function RecurrenceModal({ isOpen, onClose, onSave, initialRule }: RecurrenceModalProps) {
    const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
    const [interval, setInterval] = useState(1);
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
    const [endType, setEndType] = useState<'never' | 'date' | 'count'>('never');
    const [endDate, setEndDate] = useState('');
    const [occurrenceCount, setOccurrenceCount] = useState(13);

    useEffect(() => {
        if (isOpen) {
            if (initialRule) {
                setFrequency(initialRule.frequency);
                setInterval(initialRule.interval);
                setDaysOfWeek(initialRule.daysOfWeek || []);
                setEndType(initialRule.endType);
                setEndDate(initialRule.endDate ? initialRule.endDate.toISOString().split('T')[0] : '');
                setOccurrenceCount(initialRule.occurrenceCount || 13);
            } else {
                // Defaults
                setFrequency('weekly');
                setInterval(1);
                setDaysOfWeek([new Date().getDay()]); // Default to current day
                setEndType('never');
                setOccurrenceCount(13);
            }
        }
    }, [isOpen, initialRule]);

    if (!isOpen) return null;

    const toggleDay = (day: number) => {
        if (daysOfWeek.includes(day)) {
            setDaysOfWeek(daysOfWeek.filter(d => d !== day));
        } else {
            setDaysOfWeek([...daysOfWeek, day]);
        }
    };

    const handleSave = () => {
        onSave({
            frequency,
            interval,
            daysOfWeek: frequency === 'weekly' ? daysOfWeek : undefined,
            endType,
            endDate: endType === 'date' && endDate ? new Date(endDate) : undefined,
            occurrenceCount: endType === 'count' ? occurrenceCount : undefined
        });
        onClose();
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <h2 className={styles.title}>Recorrência personalizada</h2>

                <div className={styles.row}>
                    <label>Repetir a cada:</label>
                    <div className={styles.intervalGroup}>
                        <input
                            type="number"
                            min="1"
                            value={interval}
                            onChange={e => setInterval(parseInt(e.target.value) || 1)}
                            className={styles.numberInput}
                        />
                        <select
                            value={frequency}
                            onChange={e => setFrequency(e.target.value as any)}
                            className={styles.select}
                        >
                            <option value="daily">dia</option>
                            <option value="weekly">semana</option>
                            <option value="monthly">mês</option>
                            <option value="yearly">ano</option>
                        </select>
                    </div>
                </div>

                {frequency === 'weekly' && (
                    <div className={styles.section}>
                        <label>Repetir dia:</label>
                        <div className={styles.weekDays}>
                            {WEEKDAYS.map(day => (
                                <button
                                    key={day.value}
                                    className={`${styles.dayBtn} ${daysOfWeek.includes(day.value) ? styles.selectedDay : ''}`}
                                    onClick={() => toggleDay(day.value)}
                                    type="button"
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className={styles.section}>
                    <label>Termina em</label>
                    <div className={styles.radioGroup}>
                        <label className={styles.radioRow}>
                            <input
                                type="radio"
                                name="endType"
                                checked={endType === 'never'}
                                onChange={() => setEndType('never')}
                            />
                            <span>Nunca</span>
                        </label>

                        <label className={styles.radioRow}>
                            <input
                                type="radio"
                                name="endType"
                                checked={endType === 'date'}
                                onChange={() => setEndType('date')}
                            />
                            <span>Em</span>
                            <input
                                type="date"
                                disabled={endType !== 'date'}
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className={styles.dateInput}
                            />
                        </label>

                        <label className={styles.radioRow}>
                            <input
                                type="radio"
                                name="endType"
                                checked={endType === 'count'}
                                onChange={() => setEndType('count')}
                            />
                            <span>Após</span>
                            <input
                                type="number"
                                min="1"
                                disabled={endType !== 'count'}
                                value={occurrenceCount}
                                onChange={e => setOccurrenceCount(parseInt(e.target.value) || 1)}
                                className={styles.numberInput}
                                style={{ width: '60px' }}
                            />
                            <span>ocorrências</span>
                        </label>
                    </div>
                </div>

                <div className={styles.footer}>
                    <button onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
                    <button onClick={handleSave} className={styles.saveBtn}>Concluir</button>
                </div>
            </div>
        </div>
    );
}
