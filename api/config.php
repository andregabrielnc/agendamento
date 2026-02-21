<?php
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
$dbPass = getEnvVar('DB_PASSWORD', "u_#^4a-7'|7Cc\\&tKs");

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
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

function ensurePresencaTables($pdo) {
    static $done = false;
    if ($done) return;
    $done = true;

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS presencas (
            id VARCHAR(36) PRIMARY KEY,
            evento_id VARCHAR(36) NOT NULL,
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
