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
$dbPass = getEnvVar('DB_PASSWORD', '');

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
    echo json_encode(['error' => 'Database connection failed'], JSON_UNESCAPED_UNICODE);
    error_log('DB connection error: ' . $e->getMessage());
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
