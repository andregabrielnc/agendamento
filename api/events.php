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
            updateEvent($id, $pdo);
            break;
        case 'DELETE':
            if (!$id) jsonResponse(['error' => 'Event ID required'], 400);
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
               f.tipo AS freq_tipo, f.intervalo AS freq_intervalo, f.dias_semana AS freq_dias_semana,
               f.data_fim AS freq_data_fim, f.contagem AS freq_contagem, f.tipo_fim AS freq_tipo_fim
        FROM eventos e
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

    $id = generateUuid();

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
        ':criado_por' => $input['createdBy'] ?? $user['id'],
        ':telefone' => $input['phone'] ?? null,
    ]);

    saveRecurrence($pdo, $id, $input['recurrence'] ?? null);
    logMovimento($pdo, $id, 'criacao', $user['id']);

    $event = fetchEventById($pdo, $id);
    jsonResponse($event, 201);
}

function updateEvent($id, $pdo) {
    $user = requireAuth();
    $input = getJsonInput();

    $stmt = $pdo->prepare('
        UPDATE eventos SET
            titulo = :titulo,
            descricao = :descricao,
            data_inicio = :data_inicio,
            data_fim = :data_fim,
            dia_inteiro = :dia_inteiro,
            cor = :cor,
            sala_id = :sala_id,
            criado_por = :criado_por,
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
        ':criado_por' => $input['createdBy'] ?? $user['id'],
        ':telefone' => $input['phone'] ?? null,
    ]);

    // Replace recurrence
    $pdo->prepare('DELETE FROM frequencia WHERE evento_id = :id')->execute([':id' => $id]);
    saveRecurrence($pdo, $id, $input['recurrence'] ?? null);

    logMovimento($pdo, $id, 'edicao', $user['id']);

    $event = fetchEventById($pdo, $id);
    jsonResponse($event);
}

function deleteEvent($id, $pdo) {
    $user = requireAuth();

    logMovimento($pdo, $id, 'exclusao', $user['id']);

    $pdo->prepare('DELETE FROM frequencia WHERE evento_id = :id')->execute([':id' => $id]);
    $pdo->prepare('DELETE FROM eventos WHERE id = :id')->execute([':id' => $id]);

    jsonResponse(['success' => true]);
}

function saveRecurrence($pdo, $eventId, $recurrence) {
    if (!$recurrence || $recurrence === 'none') return;

    // Simple recurrence types (string values)
    if (is_string($recurrence)) {
        if (in_array($recurrence, ['daily', 'weekly', 'monthly', 'yearly'])) {
            $stmt = $pdo->prepare(
                'INSERT INTO frequencia (evento_id, tipo, intervalo, tipo_fim)
                 VALUES (:evento_id, :tipo, 1, :tipo_fim)'
            );
            $stmt->execute([
                ':evento_id' => $eventId,
                ':tipo' => $recurrence,
                ':tipo_fim' => 'never',
            ]);
        }
        return;
    }

    // Full RecurrenceRule object
    if (is_array($recurrence)) {
        $diasSemana = isset($recurrence['daysOfWeek']) ? json_encode($recurrence['daysOfWeek']) : null;

        $stmt = $pdo->prepare(
            'INSERT INTO frequencia (evento_id, tipo, intervalo, dias_semana, data_fim, contagem, tipo_fim)
             VALUES (:evento_id, :tipo, :intervalo, :dias_semana, :data_fim, :contagem, :tipo_fim)'
        );
        $stmt->execute([
            ':evento_id' => $eventId,
            ':tipo' => $recurrence['frequency'] ?? 'daily',
            ':intervalo' => $recurrence['interval'] ?? 1,
            ':dias_semana' => $diasSemana,
            ':data_fim' => $recurrence['endDate'] ?? null,
            ':contagem' => $recurrence['occurrenceCount'] ?? null,
            ':tipo_fim' => $recurrence['endType'] ?? 'never',
        ]);
    }
}

function fetchEventById($pdo, $id) {
    $stmt = $pdo->prepare('
        SELECT e.id, e.titulo, e.descricao, e.data_inicio, e.data_fim, e.dia_inteiro,
               e.cor, e.sala_id, e.criado_por, e.telefone,
               f.tipo AS freq_tipo, f.intervalo AS freq_intervalo, f.dias_semana AS freq_dias_semana,
               f.data_fim AS freq_data_fim, f.contagem AS freq_contagem, f.tipo_fim AS freq_tipo_fim
        FROM eventos e
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
        'phone' => $row['telefone'],
    ];

    if (!empty($row['freq_tipo'])) {
        $event['recurrence'] = [
            'frequency' => $row['freq_tipo'],
            'interval' => (int)$row['freq_intervalo'],
            'endType' => $row['freq_tipo_fim'] ?? 'never',
        ];
        if (!empty($row['freq_dias_semana'])) {
            $event['recurrence']['daysOfWeek'] = json_decode($row['freq_dias_semana'], true);
        }
        if (!empty($row['freq_data_fim'])) {
            $event['recurrence']['endDate'] = $row['freq_data_fim'];
        }
        if (!empty($row['freq_contagem'])) {
            $event['recurrence']['occurrenceCount'] = (int)$row['freq_contagem'];
        }
    }

    return $event;
}

function logMovimento($pdo, $eventId, $acao, $userId) {
    $stmt = $pdo->prepare(
        'INSERT INTO movimentos (id, evento_id, acao, usuario_id, data_hora)
         VALUES (:id, :evento_id, :acao, :usuario_id, NOW())'
    );
    $stmt->execute([
        ':id' => generateUuid(),
        ':evento_id' => $eventId,
        ':acao' => $acao,
        ':usuario_id' => $userId,
    ]);
}
