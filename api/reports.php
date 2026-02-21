<?php

function handleReports($method, $id, $pdo) {
    try {
        ensureReportTables($pdo);
        switch ($method) {
            case 'GET':
                $user = requireAuth();
                if ($user['role'] === 'admin') {
                    $stmt = $pdo->query("
                        SELECT r.*, s.nome AS sala_nome
                        FROM relatos r
                        LEFT JOIN salas s ON s.id = r.sala_id
                        ORDER BY r.criado_em DESC
                    ");
                } else {
                    $stmt = $pdo->prepare("
                        SELECT r.*, s.nome AS sala_nome
                        FROM relatos r
                        LEFT JOIN salas s ON s.id = r.sala_id
                        WHERE r.usuario_id = :uid
                        ORDER BY r.criado_em DESC
                    ");
                    $stmt->execute([':uid' => $user['id']]);
                }
                jsonResponse($stmt->fetchAll());
                break;

            case 'POST':
                $user = requireAuth();
                $input = getJsonInput();
                $salaId = !empty($input['sala_id']) ? $input['sala_id'] : null;
                $descricao = trim($input['descricao'] ?? '');

                if (!$descricao) {
                    jsonResponse(['error' => 'Descrição é obrigatória'], 400);
                }

                $newId = generateUuid();
                $stmt = $pdo->prepare("
                    INSERT INTO relatos (id, usuario_id, usuario_nome, sala_id, descricao)
                    VALUES (:id, :uid, :uname, :sala, :descricao)
                ");
                $stmt->execute([
                    ':id' => $newId,
                    ':uid' => $user['id'],
                    ':uname' => $user['name'],
                    ':sala' => $salaId,
                    ':descricao' => $descricao,
                ]);

                $stmt = $pdo->prepare("SELECT r.*, s.nome AS sala_nome FROM relatos r LEFT JOIN salas s ON s.id = r.sala_id WHERE r.id = :id");
                $stmt->execute([':id' => $newId]);
                jsonResponse($stmt->fetch(), 201);
                break;

            case 'PUT':
                if (!$id) {
                    jsonResponse(['error' => 'ID é obrigatório'], 400);
                }
                $user = requireAdmin();
                $input = getJsonInput();
                $action = $input['action'] ?? '';

                if ($action === 'finalizar') {
                    $stmt = $pdo->prepare("
                        UPDATE relatos
                        SET status = 'finalizado', finalizado_em = NOW(), finalizado_por = :fby
                        WHERE id = :id
                    ");
                    $stmt->execute([':fby' => $user['id'], ':id' => $id]);

                    $stmt = $pdo->prepare("SELECT * FROM relatos WHERE id = :id");
                    $stmt->execute([':id' => $id]);
                    $report = $stmt->fetch();

                    if ($report) {
                        $notifId = generateUuid();
                        $stmt = $pdo->prepare("
                            INSERT INTO notificacoes (id, usuario_id, relato_id, mensagem)
                            VALUES (:id, :uid, :rid, :msg)
                        ");
                        $stmt->execute([
                            ':id' => $notifId,
                            ':uid' => $report['usuario_id'],
                            ':rid' => $id,
                            ':msg' => 'Seu relato foi finalizado por um administrador.',
                        ]);
                    }

                    $stmt = $pdo->prepare("SELECT r.*, s.nome AS sala_nome FROM relatos r LEFT JOIN salas s ON s.id = r.sala_id WHERE r.id = :id");
                    $stmt->execute([':id' => $id]);
                    jsonResponse($stmt->fetch());
                } else {
                    jsonResponse(['error' => 'Ação inválida'], 400);
                }
                break;

            case 'DELETE':
                if (!$id) {
                    jsonResponse(['error' => 'ID é obrigatório'], 400);
                }
                $user = requireAuth();

                $stmt = $pdo->prepare("SELECT * FROM relatos WHERE id = :id");
                $stmt->execute([':id' => $id]);
                $report = $stmt->fetch();

                if (!$report) {
                    jsonResponse(['error' => 'Relato não encontrado'], 404);
                }

                if ($report['usuario_id'] !== $user['id'] && $user['role'] !== 'admin') {
                    jsonResponse(['error' => 'Sem permissão para excluir este relato'], 403);
                }

                $stmt = $pdo->prepare("DELETE FROM relatos WHERE id = :id");
                $stmt->execute([':id' => $id]);
                jsonResponse(['success' => true]);
                break;

            default:
                jsonResponse(['error' => 'Método não permitido'], 405);
        }
    } catch (\Throwable $e) {
        jsonResponse(['error' => 'Erro interno: ' . $e->getMessage()], 500);
    }
}
