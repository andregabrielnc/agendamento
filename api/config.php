<?php
// Session security settings BEFORE session_start()
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', !empty($_SERVER['HTTPS']));
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_strict_mode', 1);
ini_set('session.gc_maxlifetime', 7200);
session_start();

function getEnvVar($name, $default = null) {
    $val = getenv($name);
    if ($val !== false) return $val;

    static $envFile = null;
    if ($envFile === null) {
        $envPath = __DIR__ . '/../.env';
        if (file_exists($envPath)) {
            $envFile = [];
            foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                if (strpos($line, '#') === 0) continue;
                $parts = explode('=', $line, 2);
                if (count($parts) === 2) {
                    $envFile[trim($parts[0])] = trim($parts[1]);
                }
            }
        } else {
            $envFile = [];
        }
    }
    return $envFile[$name] ?? $default;
}

$dbHost = getEnvVar('DB_HOST', '10.50.0.3');
$dbPort = getEnvVar('DB_PORT', '5432');
$dbName = getEnvVar('DB_NAME', 'agendamento');
$dbUser = getEnvVar('DB_USERNAME', 'agendamento');
$dbPass = getEnvVar('DB_PASSWORD');
if ($dbPass === null) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Server configuration error'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = new PDO(
        "pgsql:host=$dbHost;port=$dbPort;dbname=$dbName",
        $dbUser,
        $dbPass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'error' => 'Database connection failed',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getJsonInput() {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function getUserFromSession() {
    return $_SESSION['user'] ?? null;
}

function requireAuth() {
    $user = getUserFromSession();
    if (!$user) {
        jsonResponse(['error' => 'Não autenticado'], 401);
    }
    return $user;
}

function requireAdmin() {
    $user = requireAuth();
    if ($user['role'] !== 'admin') {
        jsonResponse(['error' => 'Acesso negado - apenas administradores'], 403);
    }
    return $user;
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

function generateUuid() {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40); // version 4
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80); // variant 1
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function ensureLoginAttemptsTable($pdo) {
    static $done = false;
    if ($done) return;
    $done = true;

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS login_attempts (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            ip_address VARCHAR(45) NOT NULL,
            tentativa_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address)");
}

function checkLoginRateLimit($pdo, $email, $ip) {
    ensureLoginAttemptsTable($pdo);

    $maxAttempts = 6;
    $lockoutMinutes = 30;

    // Check by email
    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS total,
               MAX(tentativa_em) AS ultima
        FROM login_attempts
        WHERE email = :email
          AND tentativa_em > NOW() - INTERVAL '$lockoutMinutes minutes'
    ");
    $stmt->execute([':email' => $email]);
    $row = $stmt->fetch();

    if ((int)$row['total'] >= $maxAttempts) {
        $ultima = new DateTime($row['ultima']);
        $desbloqueio = (clone $ultima)->modify("+$lockoutMinutes minutes");
        $agora = new DateTime();
        $restante = max(1, (int)ceil(($desbloqueio->getTimestamp() - $agora->getTimestamp()) / 60));
        jsonResponse([
            'error' => "Muitas tentativas de login. Tente novamente em $restante minuto" . ($restante > 1 ? 's' : '') . ".",
            'blocked' => true,
            'retryAfterMinutes' => $restante,
        ], 429);
    }

    // Check by IP
    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS total,
               MAX(tentativa_em) AS ultima
        FROM login_attempts
        WHERE ip_address = :ip
          AND tentativa_em > NOW() - INTERVAL '$lockoutMinutes minutes'
    ");
    $stmt->execute([':ip' => $ip]);
    $row = $stmt->fetch();

    if ((int)$row['total'] >= $maxAttempts) {
        $ultima = new DateTime($row['ultima']);
        $desbloqueio = (clone $ultima)->modify("+$lockoutMinutes minutes");
        $agora = new DateTime();
        $restante = max(1, (int)ceil(($desbloqueio->getTimestamp() - $agora->getTimestamp()) / 60));
        jsonResponse([
            'error' => "Muitas tentativas de login deste dispositivo. Tente novamente em $restante minuto" . ($restante > 1 ? 's' : '') . ".",
            'blocked' => true,
            'retryAfterMinutes' => $restante,
        ], 429);
    }
}

function recordFailedLogin($pdo, $email, $ip) {
    ensureLoginAttemptsTable($pdo);
    $stmt = $pdo->prepare("INSERT INTO login_attempts (email, ip_address) VALUES (:email, :ip)");
    $stmt->execute([':email' => $email, ':ip' => $ip]);
}

function clearLoginAttempts($pdo, $email) {
    ensureLoginAttemptsTable($pdo);
    $stmt = $pdo->prepare("DELETE FROM login_attempts WHERE email = :email");
    $stmt->execute([':email' => $email]);
}

function ensurePresencaTables($pdo) {
    static $done = false;
    if ($done) return;
    $done = true;

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS presencas (
            id UUID PRIMARY KEY,
            evento_id UUID NOT NULL,
            evento_titulo VARCHAR(255),
            sala_nome VARCHAR(255),
            nome_completo VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            ip_address VARCHAR(45),
            user_agent TEXT,
            fingerprint VARCHAR(64),
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_presenca_email UNIQUE(evento_id, email),
            CONSTRAINT uq_presenca_fingerprint UNIQUE(evento_id, fingerprint)
        )
    ");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_presencas_evento ON presencas(evento_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_presencas_email ON presencas(email)");

    // Migration: convert existing VARCHAR columns to UUID for installations that already have the table
    try {
        $pdo->exec("ALTER TABLE presencas ALTER COLUMN id TYPE UUID USING id::uuid");
        $pdo->exec("ALTER TABLE presencas ALTER COLUMN evento_id TYPE UUID USING evento_id::uuid");
    } catch (\Throwable $e) {
        // Ignore — columns are already UUID
    }
}

function ensureReportTables($pdo) {
    static $done = false;
    if ($done) return;
    $done = true;

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS relatos (
            id VARCHAR(36) PRIMARY KEY,
            usuario_id VARCHAR(36) NOT NULL,
            usuario_nome VARCHAR(255) NOT NULL,
            sala_id VARCHAR(36),
            descricao TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'aberto',
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            finalizado_em TIMESTAMP,
            finalizado_por VARCHAR(36)
        )
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS notificacoes (
            id VARCHAR(36) PRIMARY KEY,
            usuario_id VARCHAR(36) NOT NULL,
            relato_id VARCHAR(36),
            mensagem TEXT NOT NULL,
            lida BOOLEAN DEFAULT FALSE,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
}
