<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

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
