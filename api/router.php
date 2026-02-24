<?php
$allowedOrigins = [
    'http://10.50.0.3',
    'https://10.50.0.3',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
}
// No fallback — unknown origins get no CORS headers
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Security headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/config.php';

$route = $_GET['route'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

$segments = array_values(array_filter(explode('/', $route)));
$resource = $segments[0] ?? '';
$subResource = $segments[1] ?? null;

if ($resource === 'auth') {
    require_once __DIR__ . '/auth.php';
    handleAuth($method, $subResource, $pdo);
} elseif ($resource === 'events') {
    require_once __DIR__ . '/events.php';
    handleEvents($method, $subResource, $pdo);
} elseif ($resource === 'calendars') {
    require_once __DIR__ . '/calendars.php';
    handleCalendars($method, $subResource, $pdo);
} elseif ($resource === 'users') {
    require_once __DIR__ . '/users.php';
    handleUsers($method, $subResource, $pdo);
} elseif ($resource === 'reports') {
    require_once __DIR__ . '/reports.php';
    handleReports($method, $subResource, $pdo);
} elseif ($resource === 'notifications') {
    require_once __DIR__ . '/notifications.php';
    handleNotifications($method, $subResource, $pdo);
} elseif ($resource === 'presencas') {
    require_once __DIR__ . '/presencas.php';
    handlePresencas($method, $subResource, $pdo);
} else {
    jsonResponse(['error' => 'Route not found'], 404);
}
