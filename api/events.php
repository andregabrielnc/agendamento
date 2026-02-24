<?php

function handleEvents($method, $id, $pdo) {
    switch ($method) {
        case 'GET':
            getEvents($pdo);
            break;
        case 'POST':
            createEvent($pdo);
            break;
        case 'PUT':
            if (!$id) jsonResponse(['error' => 'Event ID required'], 400);
            requireValidUUID($id, 'Event ID');
            updateEvent($id, $pdo);
            break;
        case 'DELETE':
            if (!$id) jsonResponse(['error' => 'Event ID required'], 400);
            requireValidUUID($id, 'Event ID');
            deleteEvent($id, $pdo);
            break;
        default:
            jsonResponse(['error' => 'Method not allowed'], 405);
    }
}

function getEvents($pdo) {
    requireAuth();

    $stmt = $pdo->query('
        SELECT e.id, e.titulo, e.descricao, e.data_inicio, e.data_fim, e.dia_inteiro,
               e.cor, e.sala_id, e.criado_por, e.telefone,
               a.nome AS criador_nome,
               f.tipo AS freq_tipo, f.intervalo AS freq_intervalo, f.dias_semana AS freq_dias_semana,
               f.data_fim AS freq_data_fim, f.contagem AS freq_contagem, f.tipo_fim AS freq_tipo_fim,
               f.excecoes AS freq_excecoes
        FROM eventos e
        LEFT JOIN administradores a ON a.id = e.criado_por
        LEFT JOIN frequencia f ON f.evento_id = e.id
        ORDER BY e.data_inicio
    ');
    $rows = $stmt->fetchAll();

    $events = array_map('mapDbEventToFrontend', $rows);
    jsonResponse($events);
}

function createEvent($pdo) {
    $user = requireAuth();
    $input = getJsonInput();

    // Non-admin cannot create events in the past
    if ($user['role'] !== 'admin') {
        $startDate = substr($input['start'] ?? '', 0, 10);
        $today = date('Y-m-d');
        if ($startDate && $startDate < $today) {
            jsonResponse(['error' => 'Não é possível criar eventos em datas passadas'], 403);
        }
    }

    $id = generateUuid();

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('
            INSERT INTO eventos (id, titulo, descricao, data_inicio, data_fim, dia_inteiro, cor, sala_id, criado_por, telefone)
            VALUES (:id, :titulo, :descricao, :data_inicio, :data_fim, :dia_inteiro, :cor, :sala_id, :criado_por, :telefone)
        ');
        $stmt->execute([
            ':id' => $id,
            ':titulo' => $input['title'] ?? '',
            ':descricao' => $input['description'] ?? null,
            ':data_inicio' => $input['start'] ?? null,
            ':data_fim' => $input['end'] ?? null,
            ':dia_inteiro' => (!empty($input['allDay'])) ? 'true' : 'false',
            ':cor' => $input['color'] ?? null,
            ':sala_id' => $input['calendarId'] ?? null,
            ':criado_por' => $user['id'],
            ':telefone' => $input['phone'] ?? null,
        ]);

        saveRecurrence($pdo, $id, $input['recurrence'] ?? null, $input['start'] ?? null);
        logMovimento($pdo, $id, 'criacao', $user);

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }

    $event = fetchEventById($pdo, $id);
    jsonResponse($event, 201);
}

function updateEvent($id, $pdo) {
    $user = requireAuth();
    $input = getJsonInput();

    // Non-admin: only allow editing own events
    if ($user['role'] !== 'admin') {
        $stmt = $pdo->prepare('SELECT criado_por FROM eventos WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) jsonResponse(['error' => 'Evento não encontrado'], 404);
        if ($row['criado_por'] !== $user['id']) {
            jsonResponse(['error' => 'Sem permissão para editar este evento'], 403);
        }
    }

    $mode = $input['_recurrenceMode'] ?? 'all';
    $instanceDate = $input['_instanceDate'] ?? null;

    // Non-admin: block editing past events (check by instance or original date)
    if ($mode === 'single' || $mode === 'thisAndFollowing') {
        checkPastEventRestriction($pdo, $id, $user, $instanceDate);
    } else {
        checkPastEventRestriction($pdo, $id, $user);
    }

    // Non-admin: block setting start date to the past
    if ($user['role'] !== 'admin') {
        $newStart = substr($input['start'] ?? '', 0, 10);
        $today = date('Y-m-d');
        if ($newStart && $newStart < $today) {
            jsonResponse(['error' => 'Não é possível mover eventos para datas passadas'], 403);
        }
    }

    if ($mode === 'single' && $instanceDate) {
        $newId = generateUuid();

        $pdo->beginTransaction();
        try {
            // Add exception to the original event's recurrence
            addExceptionToEvent($pdo, $id, $instanceDate);

            // Create a new standalone event for this single date
            $stmt = $pdo->prepare('
                INSERT INTO eventos (id, titulo, descricao, data_inicio, data_fim, dia_inteiro, cor, sala_id, criado_por, telefone)
                VALUES (:id, :titulo, :descricao, :data_inicio, :data_fim, :dia_inteiro, :cor, :sala_id, :criado_por, :telefone)
            ');
            $stmt->execute([
                ':id' => $newId,
                ':titulo' => $input['title'] ?? '',
                ':descricao' => $input['description'] ?? null,
                ':data_inicio' => $input['start'] ?? null,
                ':data_fim' => $input['end'] ?? null,
                ':dia_inteiro' => (!empty($input['allDay'])) ? 'true' : 'false',
                ':cor' => $input['color'] ?? null,
                ':sala_id' => $input['calendarId'] ?? null,
                ':criado_por' => $user['id'],
                ':telefone' => $input['phone'] ?? null,
            ]);
            // No recurrence for the standalone event
            logMovimento($pdo, $newId, 'criacao', $user);
            logMovimento($pdo, $id, 'edicao', $user);

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        $event = fetchEventById($pdo, $newId);
        jsonResponse($event);
        return;
    }

    if ($mode === 'thisAndFollowing' && $instanceDate) {
        $newId = generateUuid();

        $pdo->beginTransaction();
        try {
            // Set original event's recurrence endDate to day before instanceDate
            $dayBefore = date('Y-m-d', strtotime($instanceDate . ' -1 day'));
            $stmt = $pdo->prepare('UPDATE frequencia SET data_fim = :data_fim, tipo_fim = :tipo_fim WHERE evento_id = :id');
            $stmt->execute([
                ':data_fim' => $dayBefore . 'T23:59:59',
                ':tipo_fim' => 'date',
                ':id' => $id,
            ]);

            // Create a new event with recurrence starting from instanceDate
            $stmt = $pdo->prepare('
                INSERT INTO eventos (id, titulo, descricao, data_inicio, data_fim, dia_inteiro, cor, sala_id, criado_por, telefone)
                VALUES (:id, :titulo, :descricao, :data_inicio, :data_fim, :dia_inteiro, :cor, :sala_id, :criado_por, :telefone)
            ');
            $stmt->execute([
                ':id' => $newId,
                ':titulo' => $input['title'] ?? '',
                ':descricao' => $input['description'] ?? null,
                ':data_inicio' => $input['start'] ?? null,
                ':data_fim' => $input['end'] ?? null,
                ':dia_inteiro' => (!empty($input['allDay'])) ? 'true' : 'false',
                ':cor' => $input['color'] ?? null,
                ':sala_id' => $input['calendarId'] ?? null,
                ':criado_por' => $user['id'],
                ':telefone' => $input['phone'] ?? null,
            ]);

            saveRecurrence($pdo, $newId, $input['recurrence'] ?? null, $input['start'] ?? null);
            logMovimento($pdo, $newId, 'criacao', $user);
            logMovimento($pdo, $id, 'edicao', $user);

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        $event = fetchEventById($pdo, $newId);
        jsonResponse($event);
        return;
    }

    // mode === 'all' — current behavior: update everything
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('
            UPDATE eventos SET
                titulo = :titulo,
                descricao = :descricao,
                data_inicio = :data_inicio,
                data_fim = :data_fim,
                dia_inteiro = :dia_inteiro,
                cor = :cor,
                sala_id = :sala_id,
                telefone = :telefone
            WHERE id = :id
        ');
        $stmt->execute([
            ':id' => $id,
            ':titulo' => $input['title'] ?? '',
            ':descricao' => $input['description'] ?? null,
            ':data_inicio' => $input['start'] ?? null,
            ':data_fim' => $input['end'] ?? null,
            ':dia_inteiro' => (!empty($input['allDay'])) ? 'true' : 'false',
            ':cor' => $input['color'] ?? null,
            ':sala_id' => $input['calendarId'] ?? null,
            ':telefone' => $input['phone'] ?? null,
        ]);

        // Replace recurrence
        $pdo->prepare('DELETE FROM frequencia WHERE evento_id = :id')->execute([':id' => $id]);
        saveRecurrence($pdo, $id, $input['recurrence'] ?? null, $input['start'] ?? null);

        logMovimento($pdo, $id, 'edicao', $user);

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }

    $event = fetchEventById($pdo, $id);
    jsonResponse($event);
}

function deleteEvent($id, $pdo) {
    $user = requireAuth();
    $input = getJsonInput();

    // Non-admin: only allow deleting own events
    if ($user['role'] !== 'admin') {
        $stmt = $pdo->prepare('SELECT criado_por FROM eventos WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) jsonResponse(['error' => 'Evento não encontrado'], 404);
        if ($row['criado_por'] !== $user['id']) {
            jsonResponse(['error' => 'Sem permissão para excluir este evento'], 403);
        }
    }

    $mode = $input['_recurrenceMode'] ?? 'all';
    $instanceDate = $input['_instanceDate'] ?? null;

    // Non-admin: block deleting past events
    if ($mode === 'single' || $mode === 'thisAndFollowing') {
        checkPastEventRestriction($pdo, $id, $user, $instanceDate);
    } else {
        checkPastEventRestriction($pdo, $id, $user);
    }

    if ($mode === 'single' && $instanceDate) {
        $pdo->beginTransaction();
        try {
            // Just add an exception date — the instance disappears
            addExceptionToEvent($pdo, $id, $instanceDate);
            logMovimento($pdo, $id, 'edicao', $user);

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        jsonResponse(['success' => true]);
        return;
    }

    if ($mode === 'thisAndFollowing' && $instanceDate) {
        $pdo->beginTransaction();
        try {
            // Set recurrence endDate to day before instanceDate
            $dayBefore = date('Y-m-d', strtotime($instanceDate . ' -1 day'));
            $stmt = $pdo->prepare('UPDATE frequencia SET data_fim = :data_fim, tipo_fim = :tipo_fim WHERE evento_id = :id');
            $stmt->execute([
                ':data_fim' => $dayBefore . 'T23:59:59',
                ':tipo_fim' => 'date',
                ':id' => $id,
            ]);
            logMovimento($pdo, $id, 'edicao', $user);

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        jsonResponse(['success' => true]);
        return;
    }

    // mode === 'all' — current behavior: delete everything
    $pdo->beginTransaction();
    try {
        logMovimento($pdo, $id, 'exclusao', $user);

        $pdo->prepare('DELETE FROM frequencia WHERE evento_id = :id')->execute([':id' => $id]);
        $pdo->prepare('DELETE FROM presencas WHERE evento_id = :id')->execute([':id' => $id]);
        $pdo->prepare('DELETE FROM movimentos WHERE evento_id = :id')->execute([':id' => $id]);
        $pdo->prepare('DELETE FROM eventos WHERE id = :id')->execute([':id' => $id]);

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }

    jsonResponse(['success' => true]);
}

function addExceptionToEvent($pdo, $eventId, $dateStr) {
    $stmt = $pdo->prepare(
        'UPDATE frequencia SET excecoes = array_append(excecoes, :date::date) WHERE evento_id = :id'
    );
    $stmt->execute([
        ':date' => $dateStr,
        ':id' => $eventId,
    ]);
}

function saveRecurrence($pdo, $eventId, $recurrence, $eventStart = null) {
    if (!$recurrence || $recurrence === 'none') return;

    // Compute year-end cap (use the later of event start year or current year)
    $yearEndCap = null;
    if ($eventStart) {
        $startTs = strtotime($eventStart);
        if ($startTs) {
            $startYear = (int)date('Y', $startTs);
            $currentYear = (int)date('Y');
            $capYear = max($startYear, $currentYear);
            $yearEndCap = $capYear . '-12-31T23:59:59';
        }
    }

    // Simple recurrence types (string values)
    if (is_string($recurrence)) {
        if (in_array($recurrence, ['daily', 'weekly', 'monthly', 'yearly'])) {
            $stmt = $pdo->prepare(
                'INSERT INTO frequencia (evento_id, tipo, intervalo, tipo_fim, data_fim, excecoes)
                 VALUES (:evento_id, :tipo, 1, :tipo_fim, :data_fim, :excecoes)'
            );
            $stmt->execute([
                ':evento_id' => $eventId,
                ':tipo' => $recurrence,
                ':tipo_fim' => $yearEndCap ? 'date' : 'never',
                ':data_fim' => $yearEndCap,
                ':excecoes' => '{}',
            ]);
        }
        return;
    }

    // Full RecurrenceRule object
    if (is_array($recurrence)) {
        $endType = $recurrence['endType'] ?? 'never';
        $endDate = $recurrence['endDate'] ?? null;

        // Enforce year-end cap
        if ($yearEndCap) {
            if ($endType === 'never') {
                $endType = 'date';
                $endDate = $yearEndCap;
            } elseif ($endType === 'date' && $endDate) {
                if (strtotime($endDate) > strtotime($yearEndCap)) {
                    $endDate = $yearEndCap;
                }
            }
        }

        $diasSemana = isset($recurrence['daysOfWeek'])
            ? '{' . implode(',', $recurrence['daysOfWeek']) . '}'
            : null;

        $excecoes = '{}';
        if (isset($recurrence['exceptions']) && is_array($recurrence['exceptions'])) {
            $excecoes = '{' . implode(',', $recurrence['exceptions']) . '}';
        }

        $stmt = $pdo->prepare(
            'INSERT INTO frequencia (evento_id, tipo, intervalo, dias_semana, data_fim, contagem, tipo_fim, excecoes)
             VALUES (:evento_id, :tipo, :intervalo, :dias_semana, :data_fim, :contagem, :tipo_fim, :excecoes)'
        );
        $stmt->execute([
            ':evento_id' => $eventId,
            ':tipo' => $recurrence['frequency'] ?? 'daily',
            ':intervalo' => $recurrence['interval'] ?? 1,
            ':dias_semana' => $diasSemana,
            ':data_fim' => $endDate,
            ':contagem' => $recurrence['occurrenceCount'] ?? null,
            ':tipo_fim' => $endType,
            ':excecoes' => $excecoes,
        ]);
    }
}

function fetchEventById($pdo, $id) {
    $stmt = $pdo->prepare('
        SELECT e.id, e.titulo, e.descricao, e.data_inicio, e.data_fim, e.dia_inteiro,
               e.cor, e.sala_id, e.criado_por, e.telefone,
               a.nome AS criador_nome,
               f.tipo AS freq_tipo, f.intervalo AS freq_intervalo, f.dias_semana AS freq_dias_semana,
               f.data_fim AS freq_data_fim, f.contagem AS freq_contagem, f.tipo_fim AS freq_tipo_fim,
               f.excecoes AS freq_excecoes
        FROM eventos e
        LEFT JOIN administradores a ON a.id = e.criado_por
        LEFT JOIN frequencia f ON f.evento_id = e.id
        WHERE e.id = :id
    ');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();

    if (!$row) jsonResponse(['error' => 'Event not found'], 404);
    return mapDbEventToFrontend($row);
}

function mapDbEventToFrontend($row) {
    $event = [
        'id' => $row['id'],
        'title' => $row['titulo'],
        'description' => $row['descricao'],
        'start' => $row['data_inicio'],
        'end' => $row['data_fim'],
        'allDay' => $row['dia_inteiro'] === 'true' || $row['dia_inteiro'] === true || $row['dia_inteiro'] === 't',
        'color' => $row['cor'],
        'calendarId' => $row['sala_id'],
        'createdBy' => $row['criado_por'],
        'createdByName' => $row['criador_nome'] ?? null,
        'phone' => $row['telefone'],
    ];

    if (!empty($row['freq_tipo'])) {
        $event['recurrence'] = [
            'frequency' => $row['freq_tipo'],
            'interval' => (int)$row['freq_intervalo'],
            'endType' => $row['freq_tipo_fim'] ?? 'never',
        ];
        if (!empty($row['freq_dias_semana'])) {
            $event['recurrence']['daysOfWeek'] = array_map('intval', explode(',', trim($row['freq_dias_semana'], '{}')));
        }
        if (!empty($row['freq_data_fim'])) {
            $event['recurrence']['endDate'] = $row['freq_data_fim'];
        }
        if (!empty($row['freq_contagem'])) {
            $event['recurrence']['occurrenceCount'] = (int)$row['freq_contagem'];
        }
        // Parse PostgreSQL array of exception dates
        if (!empty($row['freq_excecoes'])) {
            $raw = trim($row['freq_excecoes'], '{}');
            if ($raw !== '') {
                $event['recurrence']['exceptions'] = array_map('trim', explode(',', $raw));
            } else {
                $event['recurrence']['exceptions'] = [];
            }
        } else {
            $event['recurrence']['exceptions'] = [];
        }
    }

    return $event;
}

function checkPastEventRestriction($pdo, $eventId, $user, $instanceDate = null) {
    if ($user['role'] === 'admin') return;

    $today = date('Y-m-d');

    if ($instanceDate) {
        $dateToCheck = substr($instanceDate, 0, 10);
    } else {
        $stmt = $pdo->prepare('SELECT data_inicio FROM eventos WHERE id = :id');
        $stmt->execute([':id' => $eventId]);
        $row = $stmt->fetch();
        if (!$row) return;
        $dateToCheck = substr($row['data_inicio'], 0, 10);
    }

    if ($dateToCheck < $today) {
        jsonResponse(['error' => 'Não é possível modificar ou excluir eventos de dias anteriores'], 403);
    }
}

function logMovimento($pdo, $eventId, $acao, $user) {
    $stmt = $pdo->prepare(
        'INSERT INTO movimentos (id, evento_id, acao, usuario_id, usuario_nome, data_hora)
         VALUES (:id, :evento_id, :acao, :usuario_id, :usuario_nome, NOW())'
    );
    $stmt->execute([
        ':id' => generateUuid(),
        ':evento_id' => $eventId,
        ':acao' => $acao,
        ':usuario_id' => $user['id'],
        ':usuario_nome' => $user['name'],
    ]);
}
