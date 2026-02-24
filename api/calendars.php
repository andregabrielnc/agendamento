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
            requireValidUUID($id, 'Calendar ID');
            updateCalendar($id, $pdo);
            break;
        case 'DELETE':
            if (!$id) jsonResponse(['error' => 'Calendar ID required'], 400);
            requireValidUUID($id, 'Calendar ID');
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
        ':criado_por' => $user['id'],
    ]);

    $calendar = [
        'id' => $id,
        'name' => $input['name'] ?? '',
        'description' => $input['description'] ?? null,
        'color' => $input['color'] ?? '#3b82f6',
        'visible' => $input['visible'] ?? true,
        'createdBy' => $user['id'],
    ];

    jsonResponse($calendar, 201);
}

function updateCalendar($id, $pdo) {
    $user = requireAdmin();
    $input = getJsonInput();

    $stmt = $pdo->prepare('
        UPDATE salas SET
            nome = :nome,
            descricao = :descricao,
            cor = :cor,
            visivel = :visivel
        WHERE id = :id
    ');
    $stmt->execute([
        ':id' => $id,
        ':nome' => $input['name'] ?? '',
        ':descricao' => $input['description'] ?? null,
        ':cor' => $input['color'] ?? '#3b82f6',
        ':visivel' => isset($input['visible']) ? ($input['visible'] ? 'true' : 'false') : 'true',
    ]);

    // Fetch updated calendar from DB to return accurate criado_por
    $stmt = $pdo->prepare('SELECT id, nome, descricao, cor, visivel, criado_por FROM salas WHERE id = :id');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();
    if (!$row) jsonResponse(['error' => 'Calendar not found'], 404);
    jsonResponse(mapDbCalendarToFrontend($row));
}

function deleteCalendar($id, $pdo) {
    requireAdmin();

    $pdo->beginTransaction();
    try {
        // Get all event IDs for this calendar
        $stmt = $pdo->prepare('SELECT id FROM eventos WHERE sala_id = :id');
        $stmt->execute([':id' => $id]);
        $eventIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (!empty($eventIds)) {
            $placeholders = implode(',', array_fill(0, count($eventIds), '?'));

            // Delete from frequencia
            $stmt = $pdo->prepare("DELETE FROM frequencia WHERE evento_id IN ($placeholders)");
            $stmt->execute($eventIds);

            // Delete from presencas
            $stmt = $pdo->prepare("DELETE FROM presencas WHERE evento_id IN ($placeholders)");
            $stmt->execute($eventIds);

            // Delete from movimentos
            $stmt = $pdo->prepare("DELETE FROM movimentos WHERE evento_id IN ($placeholders)");
            $stmt->execute($eventIds);
        }

        // Delete events
        $pdo->prepare('DELETE FROM eventos WHERE sala_id = :id')->execute([':id' => $id]);

        // Delete the calendar itself
        $pdo->prepare('DELETE FROM salas WHERE id = :id')->execute([':id' => $id]);

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }

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
