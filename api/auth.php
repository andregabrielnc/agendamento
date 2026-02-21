<?php

function handleAuth($method, $action, $pdo) {
    switch ($action) {
        case 'login':
            if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
            handleLogin($pdo);
            break;
        case 'me':
            if ($method !== 'GET') jsonResponse(['error' => 'Method not allowed'], 405);
            handleMe($pdo);
            break;
        case 'logout':
            if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
            handleLogout();
            break;
        default:
            jsonResponse(['error' => 'Auth route not found'], 404);
    }
}

function handleLogin($pdo) {
    $input = getJsonInput();
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';

    if (empty($email)) {
        jsonResponse(['error' => 'E-mail é obrigatório'], 400);
    }

    if (strpos($email, '@') === false) {
        $email .= '@ebserh.gov.br';
    }
    $email = strtolower($email);

    if (!preg_match('/@ebserh\.gov\.br$/i', $email)) {
        jsonResponse(['error' => 'E-mail deve pertencer ao domínio @ebserh.gov.br'], 400);
    }

    // Try AD authentication if available
    $adAuthFile = __DIR__ . '/../login/fetch_ad_user.php';
    $adUser = null;
    if (file_exists($adAuthFile) && !empty($password)) {
        require_once $adAuthFile;
        $username = explode('@', $email)[0];
        $adUser = validaLoginAD($username, $password);
    }

    // Look up user in administradores
    $stmt = $pdo->prepare('SELECT id, nome, email, perfil, avatar_url, criado_em FROM administradores WHERE LOWER(email) = :email');
    $stmt->execute([':email' => $email]);
    $dbUser = $stmt->fetch();

    if ($dbUser) {
        $user = mapDbUserToFrontend($dbUser);
    } else {
        // Auto-create user on first login
        $namePart = explode('@', $email)[0];
        $namePart = str_replace('.', ' ', $namePart);
        $capitalized = ucwords($namePart);

        if ($adUser && !empty($adUser['name'])) {
            $capitalized = $adUser['name'];
        }

        $id = generateUuid();
        $avatarUrl = $adUser['avatar'] ?? null;

        $stmt = $pdo->prepare(
            'INSERT INTO administradores (id, nome, email, perfil, avatar_url, criado_em)
             VALUES (:id, :nome, :email, :perfil, :avatar_url, NOW())'
        );
        $stmt->execute([
            ':id' => $id,
            ':nome' => $capitalized,
            ':email' => $email,
            ':perfil' => 'user',
            ':avatar_url' => $avatarUrl,
        ]);

        $user = [
            'id' => $id,
            'name' => $capitalized,
            'email' => $email,
            'role' => 'user',
            'avatarUrl' => $avatarUrl,
            'createdAt' => date('c'),
        ];
    }

    $_SESSION['user'] = $user;
    jsonResponse($user);
}

function handleMe($pdo) {
    $user = getUserFromSession();
    if (!$user) {
        jsonResponse(['error' => 'Não autenticado'], 401);
    }

    // Refresh from DB in case role changed
    $stmt = $pdo->prepare('SELECT id, nome, email, perfil, avatar_url, criado_em FROM administradores WHERE id = :id');
    $stmt->execute([':id' => $user['id']]);
    $dbUser = $stmt->fetch();

    if ($dbUser) {
        $user = mapDbUserToFrontend($dbUser);
        $_SESSION['user'] = $user;
    }

    jsonResponse($user);
}

function handleLogout() {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(), '', time() - 42000,
            $params['path'], $params['domain'],
            $params['secure'], $params['httponly']
        );
    }
    session_destroy();
    jsonResponse(['success' => true]);
}

function mapDbUserToFrontend($row) {
    return [
        'id' => $row['id'],
        'name' => $row['nome'],
        'email' => $row['email'],
        'role' => $row['perfil'] ?? 'user',
        'avatarUrl' => $row['avatar_url'] ?? null,
        'createdAt' => $row['criado_em'] ?? date('c'),
    ];
}
