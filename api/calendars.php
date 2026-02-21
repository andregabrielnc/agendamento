<?php

function handleCalendars($method, $id, $pdo) {
    switch ($method) {
        case 'GET':
            getCalendars($pdo);
            break;
        case 'POST':
            createCalendar($pdo);
            break;
        case 'PUT':
            if (!$id) jsonResponse(['error' => 'Calendar ID required'], 400);
            updateCalendar($id, $pdo);
            break;
        case 'DELETE':
            if (!$id) jsonResponse(['error' => 'Calendar ID required'], 400);
            deleteCalendar($id, $pdo);
            break;
        default:
            jsonResponse(['error' => 'Method not allowed'], 405);
    }
}

function getCalendars($pdo) {
    requireAuth();

    $stmt = $pdo->query('SELECT id, nome, descricao, cor, visivel, criado_por FROM salas ORDER BY nome');
    $rows = $stmt->fetchAll();

    $calendars = array_map('mapDbCalendarToFrontend', $rows);
    jsonResponse($calendars);
}

function createCalendar($pdo) {
    $user = requireAdmin();
    $input = getJsonInput();

    $id = generateUuid();

    $stmt = $pdo->prepare('
        INSERT INTO salas (id, nome, descricao, cor, visivel, criado_por)
        VALUES (:id, :nome, :descricao, :cor, :visivel, :criado_por)
    ');
    $stmt->execute([
        ':id' => $id,
        ':nome' => $input['name'] ?? '',
        ':descricao' => $input['description'] ?? null,
        ':cor' => $input['color'] ?? '#3b82f6',
        ':visivel' => (!empty($input['visible']) || !isset($input['visible'])) ? 'true' : 'false',
        ':criado_por' => $input['createdBy'] ?? $user['id'],
    ]);

    $calendar = [
        'id' => $id,
        'name' => $input['name'] ?? '',
        'description' => $input['description'] ?? null,
        'color' => $input['color'] ?? '#3b82f6',
        'visible' => $input['visible'] ?? true,
        'createdBy' => $input['createdBy'] ?? $user['id'],
    ];

    jsonResponse($calendar, 201);
}

function updateCalendar($id, $pdo) {
    requireAdmin();
    $input = getJsonInput();

    $stmt = $pdo->prepare('
        UPDATE salas SET
            nome = :nome,
            descricao = :descricao,
            cor = :cor,
            visivel = :visivel,
            criado_por = :criado_por
        WHERE id = :id
    ');
    $stmt->execute([
        ':id' => $id,
        ':nome' => $input['name'] ?? '',
        ':descricao' => $input['description'] ?? null,
        ':cor' => $input['color'] ?? '#3b82f6',
        ':visivel' => isset($input['visible']) ? ($input['visible'] ? 'true' : 'false') : 'true',
        ':criado_por' => $input['createdBy'] ?? null,
    ]);

    $calendar = [
        'id' => $id,
        'name' => $input['name'] ?? '',
        'description' => $input['description'] ?? null,
        'color' => $input['color'] ?? '#3b82f6',
        'visible' => $input['visible'] ?? true,
        'createdBy' => $input['createdBy'] ?? null,
    ];

    jsonResponse($calendar);
}

function deleteCalendar($id, $pdo) {
    requireAdmin();

    // Check if sala has any events
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM eventos WHERE sala_id = :id');
    $stmt->execute([':id' => $id]);
    $eventCount = (int)$stmt->fetchColumn();

    if ($eventCount > 0) {
        jsonResponse([
            'error' => "Não é possível excluir esta sala pois possui $eventCount agendamento" . ($eventCount > 1 ? 's' : '') . " vinculado" . ($eventCount > 1 ? 's' : ''),
        ], 409);
    }

    // No events — safe to delete
    $pdo->prepare('DELETE FROM salas WHERE id = :id')->execute([':id' => $id]);

    jsonResponse(['success' => true]);
}

function mapDbCalendarToFrontend($row) {
    return [
        'id' => $row['id'],
        'name' => $row['nome'],
        'description' => $row['descricao'],
        'color' => $row['cor'],
        'visible' => $row['visivel'] === 'true' || $row['visivel'] === true || $row['visivel'] === 't',
        'createdBy' => $row['criado_por'],
    ];
}
