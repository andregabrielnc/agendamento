<?php

function handleNotifications($method, $id, $pdo) {
    try {
        ensureReportTables($pdo);
    } catch (\Throwable $e) {
        jsonResponse(['error' => 'Erro ao inicializar tabelas: ' . $e->getMessage()], 500);
    }

    switch ($method) {
        case 'GET':
            $user = requireAuth();
            $stmt = $pdo->prepare("
                SELECT * FROM notificacoes
                WHERE usuario_id = :uid AND lida = false
                ORDER BY criado_em DESC
            ");
            $stmt->execute([':uid' => $user['id']]);
            jsonResponse($stmt->fetchAll());
            break;

        case 'PUT':
            if (!$id) {
                jsonResponse(['error' => 'ID é obrigatório'], 400);
            }
            $user = requireAuth();

            // Verify notification belongs to user
            $stmt = $pdo->prepare("SELECT * FROM notificacoes WHERE id = :id AND usuario_id = :uid");
            $stmt->execute([':id' => $id, ':uid' => $user['id']]);
            $notif = $stmt->fetch();

            if (!$notif) {
                jsonResponse(['error' => 'Notificação não encontrada'], 404);
            }

            $stmt = $pdo->prepare("UPDATE notificacoes SET lida = true WHERE id = :id");
            $stmt->execute([':id' => $id]);
            jsonResponse(['success' => true]);
            break;

        default:
            jsonResponse(['error' => 'Método não permitido'], 405);
    }
}
