<?php

// Match PHP timezone to database timezone (BRT)
date_default_timezone_set('America/Sao_Paulo');

function handlePresencas($method, $id, $pdo) {
    ensurePresencaTables($pdo);

    if ($method === 'GET' && $id === 'debug') {
        debugActiveEvents($pdo);
    } elseif ($method === 'GET' && $id) {
        getPresencasByEvento($id, $pdo);
    } elseif ($method === 'GET') {
        getActiveEvents($pdo);
    } elseif ($method === 'POST') {
        registerPresenca($pdo);
    } else {
        jsonResponse(['error' => 'Method not allowed'], 405);
    }
}

function isDiaInteiro($value) {
    return $value === true || $value === 'true' || $value === 't' || $value === '1';
}

function isRecurringEventActiveNow($event, $now) {
    $startTime = new DateTime($event['data_inicio']);
    $endTime = new DateTime($event['data_fim']);
    $today = clone $now;

    // 1. Time-of-day check (+-15min window)
    $eventStartTime = $startTime->format('H:i');
    $eventEndTime = $endTime->format('H:i');
    $nowPlus15 = (clone $now)->modify('+15 minutes')->format('H:i');
    $nowMinus15 = (clone $now)->modify('-15 minutes')->format('H:i');
    if ($nowMinus15 > $eventEndTime || $nowPlus15 < $eventStartTime) return false;

    // 2. Check recurrence date range
    $todayDate = $today->format('Y-m-d');
    $startDate = $startTime->format('Y-m-d');
    if ($todayDate < $startDate) return false;
    if (!empty($event['freq_data_fim'])) {
        $freqEnd = (new DateTime($event['freq_data_fim']))->format('Y-m-d');
        if ($todayDate > $freqEnd) return false;
    }

    // 3. Check exceptions
    if (!empty($event['excecoes'])) {
        $exceptions = array_map('trim', explode(',', trim($event['excecoes'], '{}')));
        if (in_array($todayDate, $exceptions)) return false;
    }

    // 4. Check frequency pattern
    $tipo = $event['tipo'];
    $intervalo = (int)($event['intervalo'] ?? 1);
    $dayOfWeek = (int)$now->format('w'); // 0=Sun

    switch ($tipo) {
        case 'daily':
            $daysDiff = (int)$today->diff($startTime)->days;
            return ($daysDiff % $intervalo) === 0;
        case 'weekly':
            $weeksDiff = (int)floor($today->diff($startTime)->days / 7);
            if ($intervalo > 1 && ($weeksDiff % $intervalo) !== 0) return false;
            if (!empty($event['dias_semana'])) {
                $dias = array_map('intval', explode(',', trim($event['dias_semana'], '{}')));
                return in_array($dayOfWeek, $dias);
            }
            return $dayOfWeek === (int)$startTime->format('w');
        case 'monthly':
            $monthsDiff = ((int)$today->format('Y') - (int)$startTime->format('Y')) * 12
                        + ((int)$today->format('m') - (int)$startTime->format('m'));
            if ($intervalo > 1 && ($monthsDiff % $intervalo) !== 0) return false;
            return (int)$today->format('d') === (int)$startTime->format('d');
        case 'yearly':
            return $today->format('m-d') === $startTime->format('m-d');
    }
    return false;
}

function getActiveEvents($pdo) {
    $now = new DateTime();

    try {
        // 1. Non-recurring events active now (+-15min window)
        // Use string comparison for dia_inteiro since events.php stores as 'true'/'false'
        $sqlNonRecurring = "
            SELECT e.id, e.titulo, e.data_inicio, e.data_fim, e.dia_inteiro, s.nome AS sala_nome
            FROM eventos e
            LEFT JOIN salas s ON s.id = e.sala_id
            LEFT JOIN frequencia f ON f.evento_id = e.id
            WHERE f.evento_id IS NULL
              AND e.data_inicio <= NOW() + INTERVAL '15 minutes'
              AND e.data_fim >= NOW() - INTERVAL '15 minutes'
        ";
        $stmt = $pdo->query($sqlNonRecurring);
        $nonRecurring = $stmt->fetchAll();

        // 2. Recurring events - fetch all, expand in PHP
        $sqlRecurring = "
            SELECT e.id, e.titulo, e.data_inicio, e.data_fim, e.dia_inteiro, e.sala_id, s.nome AS sala_nome,
                   f.tipo, f.intervalo, f.dias_semana, f.data_fim AS freq_data_fim,
                   f.tipo_fim, f.excecoes
            FROM eventos e
            LEFT JOIN salas s ON s.id = e.sala_id
            INNER JOIN frequencia f ON f.evento_id = e.id
        ";
        $stmt = $pdo->query($sqlRecurring);
        $recurringEvents = $stmt->fetchAll();
    } catch (PDOException $e) {
        jsonResponse(['error' => 'Erro ao buscar eventos: ' . $e->getMessage()], 500);
    }

    $activeEvents = [];

    // Add non-recurring events (time window already filtered in SQL)
    foreach ($nonRecurring as $event) {
        $activeEvents[] = [
            'id' => $event['id'],
            'title' => $event['titulo'],
            'start' => $event['data_inicio'],
            'end' => $event['data_fim'],
            'roomName' => $event['sala_nome'] ?? '',
        ];
    }

    // Check recurring events
    foreach ($recurringEvents as $event) {
        if (isRecurringEventActiveNow($event, $now)) {
            // Recompute start/end to today's date with original time-of-day
            $origStart = new DateTime($event['data_inicio']);
            $origEnd = new DateTime($event['data_fim']);
            $todayStart = clone $now;
            $todayStart->setTime(
                (int)$origStart->format('H'),
                (int)$origStart->format('i'),
                (int)$origStart->format('s')
            );
            $todayEnd = clone $now;
            $todayEnd->setTime(
                (int)$origEnd->format('H'),
                (int)$origEnd->format('i'),
                (int)$origEnd->format('s')
            );

            $activeEvents[] = [
                'id' => $event['id'],
                'title' => $event['titulo'],
                'start' => $todayStart->format('Y-m-d\TH:i:s'),
                'end' => $todayEnd->format('Y-m-d\TH:i:s'),
                'roomName' => $event['sala_nome'] ?? '',
            ];
        }
    }

    jsonResponse($activeEvents);
}

function registerPresenca($pdo) {
    try {
        $input = getJsonInput();

        $eventoId = trim($input['eventoId'] ?? '');
        $nomeCompleto = trim($input['nomeCompleto'] ?? '');
        $email = trim(strtolower($input['email'] ?? ''));
        $fingerprint = trim($input['fingerprint'] ?? '');

        // Validation
        if (!$eventoId || !$nomeCompleto || !$email || !$fingerprint) {
            jsonResponse(['error' => 'Todos os campos são obrigatórios'], 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['error' => 'E-mail inválido'], 400);
        }

        // Verify event is currently active
        $now = new DateTime();

        // Check non-recurring
        $sqlCheck = "
            SELECT e.id, e.titulo, e.data_inicio, e.data_fim, e.dia_inteiro, s.nome AS sala_nome
            FROM eventos e
            LEFT JOIN salas s ON s.id = e.sala_id
            LEFT JOIN frequencia f ON f.evento_id = e.id
            WHERE e.id::text = :eventoId
              AND f.evento_id IS NULL
              AND e.data_inicio <= NOW() + INTERVAL '15 minutes'
              AND e.data_fim >= NOW() - INTERVAL '15 minutes'
        ";
        $stmt = $pdo->prepare($sqlCheck);
        $stmt->execute(['eventoId' => $eventoId]);
        $activeEvent = $stmt->fetch();

        // If not found as non-recurring, check recurring
        if (!$activeEvent) {
            $sqlRecCheck = "
                SELECT e.id, e.titulo, e.dia_inteiro, e.data_inicio, e.data_fim, s.nome AS sala_nome,
                       f.tipo, f.intervalo, f.dias_semana, f.data_fim AS freq_data_fim,
                       f.tipo_fim, f.excecoes
                FROM eventos e
                LEFT JOIN salas s ON s.id = e.sala_id
                INNER JOIN frequencia f ON f.evento_id = e.id
                WHERE e.id::text = :eventoId
            ";
            $stmt = $pdo->prepare($sqlRecCheck);
            $stmt->execute(['eventoId' => $eventoId]);
            $recEvent = $stmt->fetch();

            if ($recEvent && isRecurringEventActiveNow($recEvent, $now)) {
                $activeEvent = $recEvent;
            }
        }

        if (!$activeEvent) {
            jsonResponse(['error' => 'Evento não está ativo no momento'], 400);
        }

        // Check if this email or device already registered for another event at the same time
        $eventStart = $activeEvent['data_inicio'] ?? null;
        $eventEnd = $activeEvent['data_fim'] ?? null;

        if ($eventStart && $eventEnd) {
            $sqlOverlap = "
                SELECT p.evento_titulo
                FROM presencas p
                INNER JOIN eventos e ON e.id::text = p.evento_id
                WHERE p.evento_id != :eventoId
                  AND (p.email = :email OR p.fingerprint = :fingerprint)
                  AND e.data_inicio < :event_end
                  AND e.data_fim > :event_start
                LIMIT 1
            ";
            $stmtOverlap = $pdo->prepare($sqlOverlap);
            $stmtOverlap->execute([
                'eventoId' => $eventoId,
                'email' => $email,
                'fingerprint' => $fingerprint,
                'event_end' => $eventEnd,
                'event_start' => $eventStart,
            ]);
            $overlap = $stmtOverlap->fetch();
            if ($overlap) {
                jsonResponse(['error' => 'Você já registrou presença em outro evento neste horário: ' . $overlap['evento_titulo']], 409);
            }
        }

        $id = generateUuid();
        $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;

        $sql = "
            INSERT INTO presencas (id, evento_id, evento_titulo, sala_nome, nome_completo, email, ip_address, user_agent, fingerprint)
            VALUES (:id, :evento_id, :evento_titulo, :sala_nome, :nome_completo, :email, :ip_address, :user_agent, :fingerprint)
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            'id' => $id,
            'evento_id' => $eventoId,
            'evento_titulo' => $activeEvent['titulo'] ?? '',
            'sala_nome' => $activeEvent['sala_nome'] ?? '',
            'nome_completo' => $nomeCompleto,
            'email' => $email,
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
            'fingerprint' => $fingerprint,
        ]);

        jsonResponse(['success' => true, 'message' => 'Presença registrada com sucesso'], 201);

    } catch (PDOException $e) {
        if (strpos($e->getCode(), '23505') !== false || strpos($e->getMessage(), 'unique') !== false || strpos($e->getMessage(), 'duplicate') !== false) {
            if (strpos($e->getMessage(), 'uq_presenca_email') !== false) {
                jsonResponse(['error' => 'Presença já registrada com este e-mail'], 409);
            }
            if (strpos($e->getMessage(), 'uq_presenca_fingerprint') !== false) {
                jsonResponse(['error' => 'Presença já registrada neste dispositivo'], 409);
            }
            jsonResponse(['error' => 'Presença já registrada'], 409);
        }
        jsonResponse(['error' => 'Erro interno: ' . $e->getMessage()], 500);
    } catch (\Throwable $e) {
        jsonResponse(['error' => 'Erro interno: ' . $e->getMessage()], 500);
    }
}

function getPresencasByEvento($eventoId, $pdo) {
    requireAdmin();

    $stmt = $pdo->prepare("
        SELECT id, evento_id, evento_titulo, sala_nome, nome_completo, email, ip_address, user_agent, fingerprint, criado_em
        FROM presencas
        WHERE evento_id = :evento_id
        ORDER BY criado_em ASC
    ");
    $stmt->execute(['evento_id' => $eventoId]);
    $presencas = $stmt->fetchAll();

    jsonResponse($presencas);
}

// Temporary debug endpoint: GET /api/router.php?route=presencas/debug
function debugActiveEvents($pdo) {
    $now = new DateTime();
    $todayStr = $now->format('Y-m-d');
    $debug = [
        'server_time' => $now->format('Y-m-d H:i:s'),
        'server_timezone' => $now->getTimezone()->getName(),
        'today' => $todayStr,
        'day_of_week' => (int)$now->format('w'),
        'day_name' => $now->format('l'),
    ];

    try {
        $dbNow = $pdo->query("SELECT NOW()::text")->fetchColumn();
        $debug['db_time'] = $dbNow;
    } catch (PDOException $e) {
        $debug['db_time_error'] = $e->getMessage();
    }

    // 1. Events for TODAY specifically
    try {
        $stmt = $pdo->prepare("
            SELECT e.id, e.titulo, e.data_inicio, e.data_fim, e.dia_inteiro, s.nome AS sala_nome,
                   CASE WHEN f.evento_id IS NOT NULL THEN 'recorrente' ELSE 'unico' END AS tipo_evento,
                   f.tipo AS freq_tipo, f.intervalo AS freq_intervalo, f.dias_semana AS freq_dias_semana,
                   f.data_fim AS freq_data_fim, f.tipo_fim, f.excecoes
            FROM eventos e
            LEFT JOIN salas s ON s.id = e.sala_id
            LEFT JOIN frequencia f ON f.evento_id = e.id
            WHERE e.data_inicio::date = :today
            ORDER BY e.data_inicio
        ");
        $stmt->execute(['today' => $todayStr]);
        $todayEvents = $stmt->fetchAll();
        $debug['today_events_count'] = count($todayEvents);
        $debug['today_events'] = [];
        foreach ($todayEvents as $event) {
            $debug['today_events'][] = [
                'id' => $event['id'],
                'titulo' => $event['titulo'],
                'sala' => $event['sala_nome'],
                'data_inicio' => $event['data_inicio'],
                'data_fim' => $event['data_fim'],
                'dia_inteiro_raw' => $event['dia_inteiro'],
                'is_dia_inteiro' => isDiaInteiro($event['dia_inteiro']),
                'tipo_evento' => $event['tipo_evento'],
            ];
        }
    } catch (PDOException $e) {
        $debug['today_events_error'] = $e->getMessage();
    }

    // 2. Search for "Comemora" event
    try {
        $stmt = $pdo->query("
            SELECT e.id, e.titulo, e.data_inicio, e.data_fim, e.dia_inteiro, s.nome AS sala_nome,
                   CASE WHEN f.evento_id IS NOT NULL THEN 'recorrente' ELSE 'unico' END AS tipo_evento
            FROM eventos e
            LEFT JOIN salas s ON s.id = e.sala_id
            LEFT JOIN frequencia f ON f.evento_id = e.id
            WHERE e.titulo ILIKE '%comemora%' OR e.titulo ILIKE '%infanticidio%' OR e.titulo ILIKE '%20 anos%'
        ");
        $debug['search_comemoracao'] = $stmt->fetchAll();
    } catch (PDOException $e) {
        $debug['search_error'] = $e->getMessage();
    }

    // 3. All recurring events
    try {
        $stmt = $pdo->query("
            SELECT e.id, e.titulo, e.data_inicio, e.data_fim, e.dia_inteiro, s.nome AS sala_nome,
                   f.tipo, f.intervalo, f.dias_semana, f.data_fim AS freq_data_fim, f.tipo_fim, f.excecoes
            FROM eventos e
            LEFT JOIN salas s ON s.id = e.sala_id
            INNER JOIN frequencia f ON f.evento_id = e.id
        ");
        $recEvents = $stmt->fetchAll();
        $debug['recurring_events_count'] = count($recEvents);
        $debug['recurring_events'] = [];
        foreach ($recEvents as $event) {
            $entry = [
                'id' => $event['id'],
                'titulo' => $event['titulo'],
                'sala' => $event['sala_nome'],
                'data_inicio' => $event['data_inicio'],
                'data_fim' => $event['data_fim'],
                'dia_inteiro' => $event['dia_inteiro'],
                'freq_tipo' => $event['tipo'],
                'freq_intervalo' => $event['intervalo'],
                'freq_dias_semana' => $event['dias_semana'],
                'freq_data_fim' => $event['freq_data_fim'],
            ];
            if (!isDiaInteiro($event['dia_inteiro'])) {
                $entry['is_active_now'] = isRecurringEventActiveNow($event, $now);
            }
            $debug['recurring_events'][] = $entry;
        }
    } catch (PDOException $e) {
        $debug['recurring_error'] = $e->getMessage();
    }

    // 4. Total event count
    try {
        $total = $pdo->query("SELECT COUNT(*) FROM eventos")->fetchColumn();
        $debug['total_events_in_db'] = (int)$total;
    } catch (PDOException $e) {
        $debug['count_error'] = $e->getMessage();
    }

    jsonResponse($debug);
}
