<?php

function handleUsers($method, $id, $pdo) {
    switch ($method) {
        case 'GET':
            getUsers($pdo);
            break;
        case 'POST':
            createUser($pdo);
            break;
        case 'PUT':
            if (!$id) jsonResponse(['error' => 'User ID required'], 400);
            updateUserRole($id, $pdo);
            break;
        default:
            jsonResponse(['error' => 'Method not allowed'], 405);
    }
}

function getUsers($pdo) {
    requireAuth();

    $stmt = $pdo->query('SELECT id, nome, email, perfil, avatar_url, criado_em FROM administradores ORDER BY nome');
    $rows = $stmt->fetchAll();

    $users = array_map('mapDbUserToFrontend', $rows);
    jsonResponse($users);
}

function updateUserRole($id, $pdo) {
    requireAdmin();
    $input = getJsonInput();

    // Prevent removing the last admin
    if (isset($input['role']) && $input['role'] !== 'admin') {
        $stmt = $pdo->prepare('SELECT perfil FROM administradores WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $current = $stmt->fetch();

        if ($current && $current['perfil'] === 'admin') {
            $countStmt = $pdo->query("SELECT COUNT(*) as cnt FROM administradores WHERE perfil = 'admin'");
            $count = $countStmt->fetch();
            if ((int)$count['cnt'] <= 1) {
                jsonResponse(['error' => 'Não é possível remover o último administrador'], 400);
            }
        }
    }

    $stmt = $pdo->prepare('
        UPDATE administradores SET
            nome = COALESCE(:nome, nome),
            perfil = COALESCE(:perfil, perfil),
            avatar_url = COALESCE(:avatar_url, avatar_url)
        WHERE id = :id
    ');
    $stmt->execute([
        ':id' => $id,
        ':nome' => $input['name'] ?? null,
        ':perfil' => $input['role'] ?? null,
        ':avatar_url' => $input['avatarUrl'] ?? null,
    ]);

    // Fetch updated user
    $stmt = $pdo->prepare('SELECT id, nome, email, perfil, avatar_url, criado_em FROM administradores WHERE id = :id');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();

    if (!$row) jsonResponse(['error' => 'User not found'], 404);
    jsonResponse(mapDbUserToFrontend($row));
}

function createUser($pdo) {
    requireAdmin();
    $input = getJsonInput();

    $name = trim($input['name'] ?? '');
    $email = trim($input['email'] ?? '');
    $role = $input['role'] ?? 'admin';

    if (!$name || !$email) {
        jsonResponse(['error' => 'Nome e e-mail são obrigatórios'], 400);
    }

    if (!str_ends_with(strtolower($email), '@ebserh.gov.br')) {
        jsonResponse(['error' => 'O e-mail deve ser @ebserh.gov.br'], 400);
    }

    // Check for duplicate email
    $stmt = $pdo->prepare('SELECT id FROM administradores WHERE email = :email');
    $stmt->execute([':email' => $email]);
    if ($stmt->fetch()) {
        jsonResponse(['error' => 'Já existe um usuário com este e-mail'], 409);
    }

    $id = generateUuid();

    $stmt = $pdo->prepare('
        INSERT INTO administradores (id, nome, email, perfil, avatar_url, criado_em)
        VALUES (:id, :nome, :email, :perfil, NULL, NOW())
    ');
    $stmt->execute([
        ':id' => $id,
        ':nome' => $name,
        ':email' => $email,
        ':perfil' => $role,
    ]);

    // Fetch created user
    $stmt = $pdo->prepare('SELECT id, nome, email, perfil, avatar_url, criado_em FROM administradores WHERE id = :id');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();

    jsonResponse(mapDbUserToFrontend($row), 201);
}
