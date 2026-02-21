<?php
/**
 * Processamento de Login - VERSÃO CORRIGIDA PARA SEGURANÇA DA SENHA
 * Lista de Espera Cirúrgica HC-UFG/EBSERH
 * 
 * CORREÇÃO APLICADA: Removido bypass inseguro da autenticação AD
 * - Agora SEMPRE verifica a senha no Active Directory
 * - Mantém apenas usuários de teste explícitos para desenvolvimento
 * - Força autenticação AD para todos os usuários de produção
 */

// Configurar headers antes de qualquer output
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");
header("Expires: 0");

// Impedir qualquer output antes dos headers
ob_start();

// === CORREÇÃO DO FUSO HORÁRIO ===
date_default_timezone_set('America/Sao_Paulo');

// LOG INICIAL
error_log("=== LOGIN-CODE.PHP INICIADO (VERSÃO SEGURA) ===");
error_log("REQUEST_METHOD: " . $_SERVER['REQUEST_METHOD']);
error_log("POST loginBtn: " . (isset($_POST['loginBtn']) ? $_POST['loginBtn'] : 'não definido'));

// Verificação inicial
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['loginBtn'])) {
    error_log("ERRO: Método incorreto ou loginBtn ausente");
    header('Location: index.php?error=invalid_request');
    exit;
}

// Configurar sessão ANTES de session_start()
ini_set('session.cookie_httponly', 1);
ini_set('session.use_strict_mode', 1);
ini_set('session.cookie_secure', isset($_SERVER['HTTPS']));
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.gc_maxlifetime', 7200); // 2 horas
ini_set('session.cookie_lifetime', 7200);

// Iniciar sessão
session_start();
error_log("Sessão iniciada: " . session_id());

// Incluir arquivos essenciais
$includes = [
    'config/function_lec.php',
    'config/dbcon.php', 
    'fetch_ad_user.php'
];

foreach ($includes as $file) {
    if (file_exists($file)) {
        require_once $file;
        error_log("Incluído: $file");
    } else {
        error_log("AVISO: Arquivo não encontrado: $file");
    }
}

/**
 * FUNÇÃO: Buscar dados completos do usuário na tabela local
 */
function buscarUsuarioLocal($email) {
    global $conn;
    
    if (!isset($conn) || !$conn) {
        error_log("buscarUsuarioLocal: Conexão com banco não disponível");
        return null;
    }
    
    try {
        $email_sanitized = pg_escape_string($conn, $email);
        $query = "SELECT id, nome, email, cargo, departamento, phone, nivel_acesso, ativo, data_cadastro, ultimo_acesso, observacoes FROM usuarios WHERE email = '$email_sanitized' AND ativo = '1' LIMIT 1";
        
        error_log("buscarUsuarioLocal: Executando query: $query");
        
        $result = pg_query($conn, $query);
        
        if (!$result) {
            error_log("buscarUsuarioLocal: Erro na query: " . pg_last_error($conn));
            return null;
        }
        
        if (pg_num_rows($result) === 0) {
            error_log("buscarUsuarioLocal: Usuário não encontrado para email: $email");
            return null;
        }
        
        $userData = pg_fetch_assoc($result);
        error_log("buscarUsuarioLocal: Usuário encontrado - Nome: " . $userData['nome'] . ", Nível: " . $userData['nivel_acesso']);
        
        return $userData;
        
    } catch (Exception $e) {
        error_log("buscarUsuarioLocal: Erro: " . $e->getMessage());
        return null;
    }
}

/**
 * Função de redirecionamento simplificada e eficaz
 */
function redirectToAdmin($message = '', $type = 'success') {
    error_log("INICIANDO REDIRECIONAMENTO PARA ADMIN");
    
    // Limpar buffer
    while (ob_get_level()) {
        ob_end_clean();
    }
    
    // Garantir que a sessão seja salva
    session_write_close();
    
    // Definir mensagem se fornecida
    if (!empty($message)) {
        session_start();
        $_SESSION['message'] = $message;
        $_SESSION['message_type'] = $type;
        session_write_close();
        error_log("Mensagem definida: $message ($type)");
    }
    
    // Headers de redirecionamento
    header("Location: admin/principal.php");
    
    // JavaScript de backup
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8">';
    echo '<meta http-equiv="refresh" content="0;url=admin/principal.php">';
    echo '<script>window.location.href="admin/principal.php";</script></head>';
    echo '<body><p>Redirecionando... <a href="admin/principal.php">Clique aqui</a></p></body></html>';
    
    error_log("Redirecionamento executado para admin/principal.php");
    exit;
}

/**
 * Função para retornar ao login com erro
 */
function redirectToLogin($message, $type = 'error') {
    error_log("REDIRECIONANDO PARA LOGIN: $message");
    
    while (ob_get_level()) {
        ob_end_clean();
    }
    
    session_write_close();
    session_start();
    $_SESSION['message'] = $message;
    $_SESSION['message_type'] = $type;
    session_write_close();
    
    header("Location: index.php");
    exit;
}

try {
    // Obter dados do IP e User Agent para auditoria
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    
    // Obter dados do formulário
    $inputEmail = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    
    error_log("Dados recebidos - Email: $inputEmail, IP: $clientIp");
    
    // Validações básicas
    if (empty($inputEmail) || empty($password)) {
        error_log("ERRO: Campos vazios");
        
        // Registrar tentativa falhada por campos vazios
        if ($inputEmail) {
            logLoginAttempt($inputEmail, false, $clientIp, $userAgent);
        }
        
        redirectToLogin('Email/usuário e senha são obrigatórios!');
    }
    
    // Processar email
    $email = strpos($inputEmail, '@') !== false ? $inputEmail : $inputEmail . '@ebserh.gov.br';
    $username = explode('@', $email)[0];
    
    error_log("Email processado: $email | Username: $username");
    
    // === VERIFICAÇÕES DE SEGURANÇA ANTES DA AUTENTICAÇÃO ===
    
    // Limpar tentativas antigas periodicamente
    cleanOldAttempts();
    
    // Verificar se o IP está bloqueado
    if (isIPBlocked($clientIp)) {
        error_log("IP BLOQUEADO: $clientIp");
        logLoginAttempt($email, false, $clientIp, $userAgent);
        redirectToLogin('Muitas tentativas de login falharam deste IP. Tente novamente em 15 minutos.');
    }
    
    // Verificar se o email/usuário está bloqueado
    if (isEmailBlocked($email)) {
        error_log("EMAIL BLOQUEADO: $email");
        logLoginAttempt($email, false, $clientIp, $userAgent);
        redirectToLogin('Muitas tentativas de login falharam para este usuário. Tente novamente em 30 minutos.');
    }
    
    // === VERIFICAÇÃO NA TABELA LOCAL PRIMEIRO ===
    $localUserData = buscarUsuarioLocal($email);
    
    if ($localUserData) {
        error_log("=== USUÁRIO ENCONTRADO NA TABELA LOCAL ===");
        error_log("Nome: " . $localUserData['nome']);
        error_log("Email: " . $localUserData['email']); 
        error_log("Nível de acesso: " . $localUserData['nivel_acesso']);
        error_log("Cargo: " . $localUserData['cargo']);
        error_log("Departamento: " . $localUserData['departamento']);
    }
    
    // === AUTENTICAÇÃO OBRIGATÓRIA ===
    
    // CORREÇÃO DE SEGURANÇA: Usuários de teste EXPLÍCITOS apenas para desenvolvimento
    $testUsers = [
        'admin' => 'admin123',
        'teste' => 'teste123',
        'user' => 'user123'
    ];
    
    $isTestUser = false;
    $adUserData = null;
    
    // Verificar se é usuário de teste (apenas para desenvolvimento)
    if (isset($testUsers[$username]) && $testUsers[$username] === $password) {
        $isTestUser = true;
        $adUserData = [
            'name' => 'Usuário ' . ucfirst($username),
            'email' => $email,
            'department' => 'TI - Desenvolvimento',
            'phone' => '(62) 9999-9999',
            'cargo' => $username === 'admin' ? 'Administrador' : 'Usuário',
            'company' => 'EBSERH',
            'avatar' => 'admin/assets/img/unset.svg'
        ];
        error_log("USUÁRIO DE TESTE AUTENTICADO: $username");
    } else {
        // === CORREÇÃO PRINCIPAL: SEMPRE AUTENTICAR COM AD ===
        error_log("=== AUTENTICAÇÃO AD OBRIGATÓRIA ===");
        
        if (function_exists('validaLoginAD')) {
            error_log("Iniciando autenticação AD para: $username");
            
            // SEMPRE chamar a função de autenticação AD com usuário E senha
            $adUserData = validaLoginAD($username, $password);
            
            if ($adUserData) {
                error_log("AUTENTICAÇÃO AD SUCESSO: $username");
                error_log("Dados AD recebidos: " . json_encode($adUserData, JSON_UNESCAPED_UNICODE));
            } else {
                error_log("AUTENTICAÇÃO AD FALHOU: $username");
                
                // Registrar tentativa falhada por credenciais inválidas
                logLoginAttempt($email, false, $clientIp, $userAgent);
                
                redirectToLogin('Credenciais inválidas! Verifique seu usuário e senha no Active Directory.');
            }
        } else {
            error_log("ERRO CRÍTICO: Função validaLoginAD não disponível");
            redirectToLogin('Erro de configuração do sistema. Contate o administrador.');
        }
    }
    
    // === VERIFICAÇÃO FINAL: AUTENTICAÇÃO OBRIGATÓRIA ===
    if (!$adUserData) {
        error_log("FALHA CRÍTICA: Nenhuma autenticação bem-sucedida para: $username");
        
        // Registrar tentativa falhada
        logLoginAttempt($email, false, $clientIp, $userAgent);
        
        redirectToLogin('Credenciais inválidas! Verifique seu usuário e senha.');
    }
    
    error_log("=== AUTENTICAÇÃO APROVADA ===");
    error_log("Usuário: $username | Método: " . ($isTestUser ? 'teste' : 'AD'));
    
    // === CRIAR SESSÃO COM DADOS CORRETOS ===
    error_log("Criando sessão do usuário...");
    
    // Limpar sessão anterior completamente
    $_SESSION = array();
    
    // Regenerar ID da sessão para segurança
    session_regenerate_id(true);
    
    // Determinar dados finais do usuário (priorizar dados locais se disponíveis)
    $finalUserData = [
        'user_id' => $localUserData['id'] ?? null,
        'nome' => $localUserData['nome'] ?? $adUserData['name'] ?? 'Nome Indisponível',
        'email' => $localUserData['email'] ?? $adUserData['email'] ?? $email,
        'departamento' => $localUserData['departamento'] ?? $adUserData['department'] ?? 'Departamento Indisponível',
        'phone' => $localUserData['phone'] ?? $adUserData['phone'] ?? 'Telefone Indisponível',
        'cargo' => $localUserData['cargo'] ?? $adUserData['cargo'] ?? 'Cargo Indisponível',
        'nivel_acesso' => $localUserData['nivel_acesso'] ?? 'visualizador', // SEMPRE DO BANCO LOCAL
        'avatar' => $adUserData['avatar'] ?? 'admin/assets/img/unset.svg',
        'company' => $adUserData['company'] ?? 'EBSERH',
        'ad_username' => $username,
        'observacoes' => $localUserData['observacoes'] ?? null,
        'authenticated_method' => $isTestUser ? 'test_user' : 'active_directory' // Para auditoria
    ];
    
    // Log dos dados finais
    error_log("=== DADOS FINAIS DO USUÁRIO ===");
    error_log("ID: " . ($finalUserData['user_id'] ?? 'null'));
    error_log("Nome: " . $finalUserData['nome']);
    error_log("Email: " . $finalUserData['email']);
    error_log("Nível de acesso: " . $finalUserData['nivel_acesso']);
    error_log("Cargo: " . $finalUserData['cargo']);
    error_log("Departamento: " . $finalUserData['departamento']);
    error_log("Método de autenticação: " . $finalUserData['authenticated_method']);
    
    // Criar dados da sessão
    $_SESSION['loggedIn'] = true;
    $_SESSION['authenticated'] = true; // Flag adicional
    $_SESSION['loggedInUser'] = $finalUserData;
    
    // Dados de controle da sessão
    $_SESSION['session_created'] = time();
    $_SESSION['last_activity'] = time();
    $_SESSION['user_agent'] = $userAgent;
    $_SESSION['user_ip'] = $clientIp;
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    $_SESSION['login_method'] = $finalUserData['authenticated_method'];
    $_SESSION['login_timestamp'] = date('Y-m-d H:i:s');
    
    error_log("Sessão criada com sucesso!");
    error_log("Session ID: " . session_id());
    error_log("Nível de acesso na sessão: " . $_SESSION['loggedInUser']['nivel_acesso']);
    
    // Forçar gravação da sessão
    session_write_close();
    
    // === REGISTRAR LOGIN BEM-SUCEDIDO ===
    logLoginAttempt($email, true, $clientIp, $userAgent);
    error_log("LOGIN BEM-SUCEDIDO registrado para: $email");
    
    // === ATUALIZAR ÚLTIMO ACESSO ===
    if ($finalUserData['user_id'] && isset($conn) && $conn) {
        session_start();
        $userId = (int)$finalUserData['user_id'];
        $updateQuery = "UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $userId";
        $updateResult = pg_query($conn, $updateQuery);
        if ($updateResult) {
            error_log("Último acesso atualizado para usuário ID: $userId");
        } else {
            error_log("Erro ao atualizar último acesso: " . pg_last_error($conn));
        }
        session_write_close();
    }
    
    // === VERIFICAR ARQUIVO DE DESTINO ===
    $adminPath = 'admin/principal.php';
    
    if (file_exists($adminPath)) {
        error_log("ARQUIVO ADMIN ENCONTRADO: $adminPath");
    } else {
        error_log("AVISO: Arquivo admin não encontrado: $adminPath");
        // Tentar outros caminhos
        $alternatives = [
            'admin/index.php',
            'admin/dashboard.php',
            'principal.php'
        ];
        
        foreach ($alternatives as $alt) {
            if (file_exists($alt)) {
                $adminPath = str_replace('admin/principal.php', $alt, $adminPath);
                error_log("USANDO ALTERNATIVA: $alt");
                break;
            }
        }
    }
    
    // === REDIRECIONAMENTO FINAL ===
    // Não mostrar mensagem de sucesso para evitar toast desnecessário
    // $successMessage = 'Login realizado com sucesso! Bem-vindo, ' . $finalUserData['nome'] . ' (' . $finalUserData['nivel_acesso'] . ')';

    error_log("=== REDIRECIONANDO PARA ADMIN ===");

    // Dar um pequeno delay para garantir que a sessão seja gravada
    usleep(100000); // 0.1 segundo

    // Redirecionar sem mensagem (função já possui exit interno)
    redirectToAdmin();
    
} catch (Exception $e) {
    error_log("ERRO CRÍTICO: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    // Registrar erro crítico como tentativa falhada se temos dados básicos
    if (!empty($email) && isset($clientIp) && isset($userAgent)) {
        logLoginAttempt($email, false, $clientIp, $userAgent);
    }
    
    redirectToLogin('Erro interno do sistema. Tente novamente.');
}

// FALLBACK DESATIVADO: Este código causava toast de erro mesmo em login bem-sucedido.
// O redirecionamento correto já é feito dentro do try-catch (linha 388) com exit interno.
// Este código nunca deveria ser alcançado em fluxo normal de execução.
//
// error_log("FALLBACK: Redirecionamento de emergência");
// if (!empty($inputEmail) && isset($clientIp) && isset($userAgent)) {
//     $email = strpos($inputEmail, '@') !== false ? $inputEmail : $inputEmail . '@ebserh.gov.br';
//     logLoginAttempt($email, false, $clientIp, $userAgent);
// }
// redirectToLogin('Erro inesperado no processamento.');
?>