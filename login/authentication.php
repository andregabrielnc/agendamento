<?php
/**
 * Sistema de Autenticação Seguro - VERSÃO CORRIGIDA PARA NÍVEL DE ACESSO
 * Lista de Espera Cirúrgica HC-UFG/EBSERH
 *
 * @version 4.4
 * @author Sistema HC-UFG/EBSERH
 * @date 2025
 */

// === CORREÇÃO DO FUSO HORÁRIO ===
date_default_timezone_set('America/Sao_Paulo');

// LOG INICIAL PARA DEBUG
error_log("=== AUTHENTICATION.PHP INICIADO ===");
error_log("Script atual: " . ($_SERVER['SCRIPT_NAME'] ?? 'unknown'));
error_log("Request URI: " . ($_SERVER['REQUEST_URI'] ?? 'unknown'));

// Configurar sessão antes de iniciá-la
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_strict_mode', 1);
    ini_set('session.cookie_secure', isset($_SERVER['HTTPS']));
    ini_set('session.cookie_samesite', 'Strict');
    ini_set('session.gc_maxlifetime', 7200);
    ini_set('session.cookie_lifetime', 7200);
    
    session_start();
    error_log("Sessão iniciada pelo authentication.php: " . session_id());
} else {
    error_log("Sessão já estava ativa: " . session_id());
}

// Incluir arquivos necessários
$config_loaded = false;
$dbcon_loaded = false;

$config_paths = ['config/dbcon.php', '../config/dbcon.php'];
foreach ($config_paths as $path) {
    if (file_exists($path)) {
        try {
            require_once $path;
            $dbcon_loaded = true;
            error_log("dbcon.php carregado de: $path");
            break;
        } catch (Exception $e) {
            error_log("Erro ao carregar $path: " . $e->getMessage());
        }
    }
}

$function_paths = ['config/function_lec.php', '../config/function_lec.php'];
foreach ($function_paths as $path) {
    if (file_exists($path)) {
        try {
            require_once $path;
            $config_loaded = true;
            error_log("function_lec.php carregado de: $path");
            break;
        } catch (Exception $e) {
            error_log("Erro ao carregar $path: " . $e->getMessage());
        }
    }
}

/**
 * NOVA FUNÇÃO: Validar e corrigir dados do usuário na sessão - CORRIGIDA
 */
function validateAndFixUserSession() {
    global $conn, $dbcon_loaded;
    
    if (!$dbcon_loaded || !isset($conn)) {
        error_log("validateAndFixUserSession: banco não disponível");
        return false;
    }
    
    $user = $_SESSION['loggedInUser'] ?? null;
    if (!$user || !isset($user['email'])) {
        error_log("validateAndFixUserSession: usuário não encontrado na sessão");
        return false;
    }
    
    $email = $user['email'];
    
    try {
        // Buscar dados atualizados do usuário no banco
        $query = "SELECT id, nome, email, cargo, departamento, phone, nivel_acesso, ativo FROM usuarios WHERE email = $1 AND ativo = '1' LIMIT 1";
        $result = pg_query_params($conn, $query, [$email]);
        
        if (!$result) {
            error_log("validateAndFixUserSession: erro na consulta: " . pg_last_error($conn));
            return false;
        }
        
        if (pg_num_rows($result) === 0) {
            error_log("validateAndFixUserSession: usuário não encontrado no banco: $email");
            return false;
        }
        
        $dbUser = pg_fetch_assoc($result);
        
        error_log("validateAndFixUserSession: Dados do banco - Nome: " . $dbUser['nome'] . ", Nível: " . $dbUser['nivel_acesso']);
        
        // Atualizar dados na sessão com dados do banco
        $_SESSION['loggedInUser']['user_id'] = $dbUser['id'];
        $_SESSION['loggedInUser']['nome'] = $dbUser['nome'];
        $_SESSION['loggedInUser']['email'] = $dbUser['email'];
        $_SESSION['loggedInUser']['cargo'] = $dbUser['cargo'];
        $_SESSION['loggedInUser']['departamento'] = $dbUser['departamento'];
        $_SESSION['loggedInUser']['phone'] = $dbUser['phone'];
        $_SESSION['loggedInUser']['nivel_acesso'] = $dbUser['nivel_acesso']; // SEMPRE DO BANCO
        
        // IMPORTANTE: Remover campo 'funcao' se existir para evitar confusão
        if (isset($_SESSION['loggedInUser']['funcao'])) {
            unset($_SESSION['loggedInUser']['funcao']);
        }
        
        error_log("validateAndFixUserSession: Sessão atualizada - Nome: " . $dbUser['nome'] . ", Nível: " . $dbUser['nivel_acesso']);
        
        return true;
        
    } catch (Exception $e) {
        error_log("validateAndFixUserSession: erro: " . $e->getMessage());
        return false;
    }
}

/**
 * Função para fazer logout e limpar a sessão
 */
function logoutSession() {
    error_log("Executando logout da sessão");
    
    if (isset($_SESSION['loggedInUser']['user_id'])) {
        error_log("Logout: usuário ID " . $_SESSION['loggedInUser']['user_id'] . " em " . date('Y-m-d H:i:s'));
    }
    
    $_SESSION = array();
    
    if (isset($_COOKIE[session_name()])) {
        setcookie(session_name(), '', time() - 3600, '/');
    }
    
    session_destroy();
}

/**
 * Verificar se o usuário está logado - VERSÃO MELHORADA
 */
function isUserLoggedIn() {
    // Verificar múltiplas flags de autenticação
    $isLoggedIn = (isset($_SESSION['loggedIn']) && $_SESSION['loggedIn'] === true) ||
                  (isset($_SESSION['authenticated']) && $_SESSION['authenticated'] === true);
    
    // Log detalhado para debug
    error_log("=== VERIFICAÇÃO DE LOGIN ===");
    error_log("loggedIn flag: " . (isset($_SESSION['loggedIn']) ? ($_SESSION['loggedIn'] ? 'true' : 'false') : 'not set'));
    error_log("authenticated flag: " . (isset($_SESSION['authenticated']) ? ($_SESSION['authenticated'] ? 'true' : 'false') : 'not set'));
    error_log("loggedInUser existe: " . (isset($_SESSION['loggedInUser']) ? 'sim' : 'não'));
    
    if (isset($_SESSION['loggedInUser'])) {
        error_log("Usuário na sessão: " . ($_SESSION['loggedInUser']['nome'] ?? 'nome não definido'));
        error_log("Email na sessão: " . ($_SESSION['loggedInUser']['email'] ?? 'email não definido'));
        error_log("Nível de acesso na sessão: " . ($_SESSION['loggedInUser']['nivel_acesso'] ?? 'não definido'));
    }
    
    error_log("Resultado da verificação: " . ($isLoggedIn ? 'LOGADO' : 'NÃO LOGADO'));
    
    return $isLoggedIn;
}

/**
 * Verificar se a sessão expirou
 */
function isSessionExpired() {
    if (!isset($_SESSION['last_activity'])) {
        error_log("Sessão expirada: last_activity não definido");
        return true;
    }
    
    $sessionTimeout = 7200; // 2 horas em segundos
    $timeSinceLastActivity = time() - $_SESSION['last_activity'];
    $isExpired = $timeSinceLastActivity > $sessionTimeout;
    
    if ($isExpired) {
        error_log("Sessão expirada: timeout de $timeSinceLastActivity segundos");
    }
    
    return $isExpired;
}

/**
 * Atualizar timestamp da última atividade
 */
function updateLastActivity() {
    $_SESSION['last_activity'] = time();
}

/**
 * Verificar mudanças no User Agent (relaxado para desenvolvimento)
 */
function validateUserAgent() {
    if (!isset($_SESSION['user_agent'])) {
        $_SESSION['user_agent'] = $_SERVER['HTTP_USER_AGENT'] ?? '';
        return true;
    }
    
    $isValid = $_SESSION['user_agent'] === ($_SERVER['HTTP_USER_AGENT'] ?? '');
    
    if (!$isValid) {
        error_log("AVISO: User Agent mudou. Pode ser troca de navegador ou dispositivo.");
    }
    
    return true; // Retornar true para evitar logouts desnecessários em desenvolvimento
}

/**
 * Redirecionamento seguro para evitar loops
 */
function safeRedirect($url, $message = '', $type = 'info') {
    $currentScript = basename($_SERVER['SCRIPT_NAME']);
    $targetScript = basename(parse_url($url, PHP_URL_PATH));
    
    // Evitar loops de redirecionamento
    if ($currentScript === $targetScript) {
        error_log("AVISO: Tentativa de redirecionamento em loop detectada: $currentScript -> $targetScript");
        return;
    }
    
    error_log("Redirecionamento seguro: $currentScript -> $url");
    
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    if (!empty($message)) {
        $_SESSION['message'] = $message;
        $_SESSION['message_type'] = $type;
    }
    
    header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
    header("Pragma: no-cache");
    header("Expires: 0");
    header("Location: " . $url);
    exit;
}

// =================== FUNÇÕES DE NÍVEIS DE ACESSO - CORRIGIDAS ===================

function getLoggedInUser() {
    $user = $_SESSION['loggedInUser'] ?? null;
    if ($user) {
        error_log("getLoggedInUser: " . ($user['nome'] ?? 'unknown') . " - Nível: " . ($user['nivel_acesso'] ?? 'unknown'));
    }
    return $user;
}

function hasNivelAcesso($nivel) {
    $user = getLoggedInUser();
    if (!$user || !isset($user['nivel_acesso'])) {
        error_log("hasNivelAcesso: usuário não encontrado ou sem nivel_acesso");
        return false;
    }
    
    $userNivel = strtolower(trim($user['nivel_acesso']));
    $targetNivel = strtolower(trim($nivel));
    
    error_log("hasNivelAcesso: comparando '$userNivel' com '$targetNivel'");
    
    $result = $userNivel === $targetNivel;
    error_log("hasNivelAcesso resultado: " . ($result ? 'true' : 'false'));
    
    return $result;
}

// Manter função hasFuncao para compatibilidade (alias para hasNivelAcesso)
function hasFuncao($funcao) {
    error_log("hasFuncao (DEPRECATED): usando hasNivelAcesso($funcao)");
    return hasNivelAcesso($funcao);
}

function isAdmin() {
    $result = hasNivelAcesso('administrador');
    error_log("isAdmin: " . ($result ? 'true' : 'false'));
    return $result;
}

function isSupervisor() {
    $result = hasNivelAcesso('supervisor') || isAdmin();
    error_log("isSupervisor: " . ($result ? 'true' : 'false'));
    return $result;
}

function isOperador() {
    $result = hasNivelAcesso('operador') || isSupervisor();
    error_log("isOperador: " . ($result ? 'true' : 'false'));
    return $result;
}

function isVisualizador() {
    $result = hasNivelAcesso('visualizador');
    error_log("isVisualizador: " . ($result ? 'true' : 'false'));
    return $result;
}

function canPerformAction($action) {
    $user = getLoggedInUser();
    if (!$user) {
        error_log("canPerformAction: usuário não encontrado");
        return false;
    }
    
    $nivel_acesso = strtolower($user['nivel_acesso'] ?? '');
    
    $permissions = [
        'administrador' => [
            'create', 'read', 'update', 'delete', 
            'manage_users', 'export', 'view_reports', 
            'backup', 'restore', 'system_config'
        ],
        'supervisor' => [
            'create', 'read', 'update', 'delete', 
            'export', 'view_reports', 'manage_queue', 'manage_users'
        ],
        'operador' => [
            'create', 'read', 'update', 'export'
        ],
        'visualizador' => [
            'read'
        ],
        'assistencial' => [
            'read', 'update'
        ]
    ];
    
    $result = isset($permissions[$nivel_acesso]) && in_array($action, $permissions[$nivel_acesso]);
    error_log("canPerformAction($action): nivel='$nivel_acesso', result=" . ($result ? 'true' : 'false'));
    
    return $result;
}

function canAccessAdmin() {
    $result = !isVisualizador();
    error_log("canAccessAdmin: " . ($result ? 'true' : 'false'));
    return $result;
}

function canManageUsers() {
    $result = isAdmin() || isSupervisor();
    error_log("canManageUsers: " . ($result ? 'true' : 'false'));
    return $result;
}

function getSessionTimeRemaining() {
    if (!isset($_SESSION['last_activity'])) {
        return 0;
    }
    
    $sessionTimeout = 7200;
    $timeRemaining = $sessionTimeout - (time() - $_SESSION['last_activity']);
    
    return max(0, $timeRemaining);
}

function getUserDataForJS() {
    $user = getLoggedInUser();
    if (!$user) {
        return null;
    }
    
    return [
        'nome' => $user['nome'] ?? '',
        'email' => $user['email'] ?? '',
        'cargo' => $user['cargo'] ?? '',
        'departamento' => $user['departamento'] ?? '',
        'nivel_acesso' => $user['nivel_acesso'] ?? '',
        'funcao' => $user['nivel_acesso'] ?? '', // Para compatibilidade
        'avatar' => $user['avatar'] ?? '',
        'sessionTimeRemaining' => getSessionTimeRemaining(),
        'permissions' => [
            'isAdmin' => isAdmin(),
            'isSupervisor' => isSupervisor(),
            'isOperador' => isOperador(),
            'isVisualizador' => isVisualizador(),
            'canAccessAdmin' => canAccessAdmin(),
            'canManageUsers' => canManageUsers()
        ]
    ];
}

// =================== VERIFICAÇÕES DE SEGURANÇA ===================

try {
    $currentScript = basename($_SERVER['SCRIPT_NAME']);
    $currentPath = $_SERVER['REQUEST_URI'] ?? '';
    
    error_log("Verificando segurança para script: $currentScript");
    error_log("Path atual: $currentPath");
    
    // Scripts que não precisam de autenticação
    $publicScripts = [
        'index.php', 
        'login.php', 
        'login-code.php',
        'logout.php',
        'fetch_ad_user.php',
        'debug_sistema.php',
        'test_config.php'
    ];
    
    // Verificar se é uma requisição AJAX
    $isAjaxRequest = !empty($_SERVER['HTTP_X_REQUESTED_WITH']) && 
                     strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) == 'xmlhttprequest';
    
    // Verificar se é página pública
    $isPublicPage = in_array($currentScript, $publicScripts) || 
                    strpos($currentPath, '/api/') !== false ||
                    strpos($currentPath, '/assets/') !== false ||
                    strpos($currentPath, '/css/') !== false ||
                    strpos($currentPath, '/js/') !== false;
    
    error_log("É página pública? " . ($isPublicPage ? 'SIM' : 'NÃO'));
    error_log("É requisição AJAX? " . ($isAjaxRequest ? 'SIM' : 'NÃO'));
    
    // Para páginas públicas ou AJAX, aplicar verificações mínimas
    if ($isPublicPage || $isAjaxRequest) {
        error_log("Página pública ou AJAX - aplicando verificações mínimas");
        
        if (isUserLoggedIn()) {
            updateLastActivity();
            error_log("Última atividade atualizada para usuário logado");
        }
        
        // Definir variáveis globais
        $currentUser = getLoggedInUser();
        $sessionTimeRemaining = getSessionTimeRemaining();
        $isUserAdmin = isAdmin();
        $isUserSupervisor = isSupervisor();
        $isUserOperador = isOperador();
        $isUserVisualizador = isVisualizador();
        
        error_log("=== AUTHENTICATION.PHP CONCLUÍDO (PÁGINA PÚBLICA) ===");
        return;
    }
    
    // === VERIFICAÇÕES COMPLETAS PARA PÁGINAS PRIVADAS ===
    
    error_log("=== INICIANDO VERIFICAÇÕES COMPLETAS ===");
    
    // Debug da sessão atual
    error_log("Session ID atual: " . session_id());
    if (isset($_SESSION['loggedInUser'])) {
        error_log("Dados da sessão - Nome: " . ($_SESSION['loggedInUser']['nome'] ?? 'N/A') . 
                  ", Email: " . ($_SESSION['loggedInUser']['email'] ?? 'N/A') . 
                  ", Nível: " . ($_SESSION['loggedInUser']['nivel_acesso'] ?? 'N/A'));
    }
    
    // 1. Verificar se o usuário está logado
    if (!isUserLoggedIn()) {
        error_log("FALHA: Usuário não está logado - redirecionando para login");
        logoutSession();
        
        $loginUrl = 'index.php';
        if (strpos($_SERVER['REQUEST_URI'], '/admin/') !== false) {
            $loginUrl = '../index.php';
        }
        
        safeRedirect($loginUrl, 'Faça login para continuar...');
        exit;
    }
    
    error_log("SUCESSO: Usuário está logado - continuando verificações");
    
    // 2. NOVA VERIFICAÇÃO: Validar e corrigir dados da sessão
    $sessionFixed = validateAndFixUserSession();
    if ($sessionFixed) {
        error_log("SUCESSO: Dados da sessão validados/corrigidos com dados do banco");
    } else {
        error_log("AVISO: Não foi possível validar dados da sessão - continuando com dados existentes");
    }
    
    // 3. Verificar se a sessão expirou
    if (isSessionExpired()) {
        error_log("FALHA: Sessão expirada - fazendo logout");
        logoutSession();
        
        $loginUrl = 'index.php';
        if (strpos($_SERVER['REQUEST_URI'], '/admin/') !== false) {
            $loginUrl = '../index.php';
        }
        
        safeRedirect($loginUrl, 'Sua sessão expirou por inatividade. Faça login novamente.');
        exit;
    }
    
    error_log("SUCESSO: Sessão ainda válida");
    
    // 4. Verificar User Agent (relaxado)
    if (!validateUserAgent()) {
        error_log("AVISO: User Agent inválido - mas continuando");
    }
    
    // 5. Verificar se os dados do usuário estão presentes
    if (!isset($_SESSION['loggedInUser']['email'])) {
        error_log("FALHA: Dados de usuário ausentes na sessão");
        logoutSession();
        
        $loginUrl = 'index.php';
        if (strpos($_SERVER['REQUEST_URI'], '/admin/') !== false) {
            $loginUrl = '../index.php';
        }
        
        safeRedirect($loginUrl, 'Dados de sessão inválidos. Faça login novamente.');
        exit;
    }
    
    error_log("SUCESSO: Dados do usuário presentes na sessão");
    
    // 6. Validar usuário no banco de dados (apenas para usuários locais)
    if ($dbcon_loaded && isset($_SESSION['loggedInUser']['user_id']) && $_SESSION['loggedInUser']['user_id']) {
        error_log("Validando usuário local no banco de dados");
        
        $email = $_SESSION['loggedInUser']['email'];
        $userId = (int)$_SESSION['loggedInUser']['user_id'];
        
        if (isset($conn)) {
            $query = "SELECT id, nome, email, ativo, ultimo_acesso, nivel_acesso FROM usuarios WHERE id = $1 AND email = $2 LIMIT 1";
            $result = pg_query_params($conn, $query, [$userId, $email]);
            
            if (!$result) {
                error_log("Erro na consulta de validação de usuário: " . pg_last_error($conn));
                error_log("AVISO: Continuando sem validação de BD devido a erro de conexão");
            } elseif (pg_num_rows($result) === 0) {
                error_log("FALHA: Usuário não encontrado no banco de dados");
                logoutSession();
                
                $loginUrl = 'index.php';
                if (strpos($_SERVER['REQUEST_URI'], '/admin/') !== false) {
                    $loginUrl = '../index.php';
                }
                
                safeRedirect($loginUrl, 'Usuário não encontrado. Acesso negado.');
                exit;
            } else {
                $user = pg_fetch_assoc($result);
                error_log("SUCESSO: Usuário validado no banco: " . $user['nome']);
                error_log("Nível de acesso do banco: " . ($user['nivel_acesso'] ?? 'N/A'));
                
                // Verificar se a conta está ativa
                if ($user['ativo'] !== '1') {
                    error_log("FALHA: Conta desativada para usuário: " . $user['nome']);
                    logoutSession();
                    
                    $loginUrl = 'index.php';
                    if (strpos($_SERVER['REQUEST_URI'], '/admin/') !== false) {
                        $loginUrl = '../index.php';
                    }
                    
                    safeRedirect($loginUrl, 'Conta desativada! Contate o administrador.');
                    exit;
                }
                
                // Atualizar dados do usuário na sessão se necessário
                $_SESSION['loggedInUser']['nome'] = $user['nome'];
                $_SESSION['loggedInUser']['email'] = $user['email'];
                $_SESSION['loggedInUser']['nivel_acesso'] = $user['nivel_acesso'];
                
                // IMPORTANTE: Remover campo 'funcao' se existir para evitar confusão
                if (isset($_SESSION['loggedInUser']['funcao'])) {
                    unset($_SESSION['loggedInUser']['funcao']);
                }
                
                error_log("Sessão atualizada com nivel_acesso: " . ($user['nivel_acesso'] ?? 'N/A'));
                
                // Registrar atividade a cada 5 minutos
                if (!isset($_SESSION['activity_logged']) || (time() - $_SESSION['activity_logged']) > 300) {
                    $updateQuery = "UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1";
                    pg_query_params($conn, $updateQuery, [$userId]);
                    $_SESSION['activity_logged'] = time();
                    error_log("Último acesso atualizado para usuário ID: $userId");
                }
            }
        }
    } else {
        error_log("Usuário AD sem registro local - continuando apenas com dados da sessão");
    }
    
    // 7. Atualizar timestamp da última atividade
    updateLastActivity();
    error_log("SUCESSO: Última atividade atualizada");
    
} catch (Exception $e) {
    error_log("ERRO CRÍTICO em authentication.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    // Em caso de erro crítico, verificar se os dados básicos estão íntegros
    if (!isset($_SESSION['loggedInUser']) || !is_array($_SESSION['loggedInUser'])) {
        error_log("ERRO GRAVE: Dados de sessão corrompidos - fazendo logout");
        logoutSession();
        
        $loginUrl = 'index.php';
        if (strpos($_SERVER['REQUEST_URI'], '/admin/') !== false) {
            $loginUrl = '../index.php';
        }
        
        safeRedirect($loginUrl, 'Erro de segurança detectado. Faça login novamente.', 'error');
        exit;
    }
    
    error_log("AVISO: Erro capturado, mas mantendo sessão pois dados básicos estão íntegros");
}

// =================== DEFINIR VARIÁVEIS GLOBAIS ===================

$currentUser = getLoggedInUser();
$sessionTimeRemaining = getSessionTimeRemaining();
$isUserAdmin = isAdmin();
$isUserSupervisor = isSupervisor();
$isUserOperador = isOperador();
$isUserVisualizador = isVisualizador();

error_log("=== AUTHENTICATION.PHP CONCLUÍDO COM SUCESSO ===");
if ($currentUser) {
    error_log("Usuário validado: " . ($currentUser['nome'] ?? 'unknown'));
    error_log("Nível de acesso: " . ($currentUser['nivel_acesso'] ?? 'unknown'));
    error_log("Email: " . ($currentUser['email'] ?? 'unknown'));
    error_log("Pode gerenciar usuários: " . (canManageUsers() ? 'SIM' : 'NÃO'));
}

// Limpar buffer de saída para evitar problemas com headers
if (ob_get_level()) {
    ob_clean();
}

// === FUNÇÃO ADICIONAL PARA SUPORTE AO COMPONENTE DE USUÁRIO LOGADO ===

/**
 * Função para verificar se o usuário está logado (versão simplificada para componentes)
 */
function isUserLoggedInSimple() {
    return (isset($_SESSION['loggedIn']) && $_SESSION['loggedIn'] === true) ||
           (isset($_SESSION['authenticated']) && $_SESSION['authenticated'] === true);
}

/**
 * Função para obter dados básicos do usuário logado para exibição
 */
function getCurrentUserForDisplay() {
    if (!isUserLoggedInSimple()) {
        return null;
    }
    
    $user = $_SESSION['loggedInUser'] ?? null;
    if (!$user) {
        return null;
    }
    
    // Garantir que temos dados mínimos
    return [
        'user_id' => $user['user_id'] ?? null,
        'nome' => $user['nome'] ?? 'Usuário',
        'email' => $user['email'] ?? '',
        'cargo' => $user['cargo'] ?? '',
        'departamento' => $user['departamento'] ?? '',
        'nivel_acesso' => $user['nivel_acesso'] ?? 'visualizador',
        'phone' => $user['phone'] ?? '',
        'avatar' => $user['avatar'] ?? 'admin/assets/img/unset.svg'
    ];
}

/**
 * Função para gerar HTML do componente de usuário logado
 * Para uso em qualquer página do sistema
 */
function renderUserComponent($classes = '') {
    $currentUser = getCurrentUserForDisplay();
    
    if (!$currentUser) {
        return '';
    }
    
    // Função para gerar avatar
    $gerarAvatar = function($nome, $tamanho = 40) {
        $palavras = explode(' ', trim($nome));
        $iniciais = '';
        
        foreach ($palavras as $palavra) {
            if (!empty($palavra)) {
                $iniciais .= strtoupper($palavra[0]);
                if (strlen($iniciais) >= 2) break;
            }
        }
        
        if (empty($iniciais)) $iniciais = 'US';
        
        return "https://ui-avatars.com/api/?name=" . urlencode($iniciais) . 
               "&background=667eea&color=ffffff&size={$tamanho}&font-size=0.6";
    };
    
    $avatar32 = $gerarAvatar($currentUser['nome'], 32);
    $avatar48 = $gerarAvatar($currentUser['nome'], 48);
    
    return '
    <!-- Componente de usuário logado -->
    <div class="user-dropdown ' . $classes . '" id="userDropdown">
        <button onclick="toggleUserDropdown()" 
                class="flex items-center space-x-3 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 text-white">
            <img src="' . htmlspecialchars($avatar32) . '" 
                 alt="Avatar" 
                 class="w-8 h-8 rounded-full user-avatar">
            <div class="text-left hidden sm:block">
                <div class="text-sm font-medium">' . htmlspecialchars($currentUser['nome']) . '</div>
                <div class="text-xs opacity-75">' . htmlspecialchars($currentUser['nivel_acesso']) . '</div>
            </div>
            <i class="fas fa-chevron-down text-xs transition-transform duration-200" id="userDropdownIcon"></i>
        </button>
        
        <!-- Dropdown Content -->
        <div class="user-dropdown-content" id="userDropdownContent">
            <!-- Cabeçalho do usuário -->
            <div class="user-info-card m-3">
                <div class="flex items-center space-x-3">
                    <img src="' . htmlspecialchars($avatar48) . '" 
                         alt="Avatar" 
                         class="w-12 h-12 rounded-full border-2 border-white/30">
                    <div>
                        <div class="font-medium text-sm">' . htmlspecialchars($currentUser['nome']) . '</div>
                        <div class="text-xs opacity-90">' . htmlspecialchars($currentUser['email']) . '</div>
                        <div class="text-xs opacity-75 mt-1">
                            <i class="fas fa-user-tag mr-1"></i>
                            ' . htmlspecialchars($currentUser['nivel_acesso']) . '
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Informações adicionais -->
            <div class="px-3 pb-3">
                <div class="bg-gray-50 rounded-lg p-3 mb-3">';
    
    if (!empty($currentUser['cargo'])) {
        $html .= '
                    <div class="flex items-center text-sm text-gray-600 mb-2">
                        <i class="fas fa-briefcase mr-2 w-4"></i>
                        <span>' . htmlspecialchars($currentUser['cargo']) . '</span>
                    </div>';
    }
    
    if (!empty($currentUser['departamento'])) {
        $html .= '
                    <div class="flex items-center text-sm text-gray-600 mb-2">
                        <i class="fas fa-building mr-2 w-4"></i>
                        <span>' . htmlspecialchars($currentUser['departamento']) . '</span>
                    </div>';
    }
    
    $html .= '
                    <div class="flex items-center text-sm text-gray-600">
                        <i class="fas fa-clock mr-2 w-4"></i>
                        <span>Sessão: ' . date('H:i') . '</span>
                    </div>
                </div>
                
                <!-- Botão de logout -->
                <button onclick="confirmarLogout()" 
                        class="logout-button w-full flex items-center justify-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all duration-200">
                    <i class="fas fa-sign-out-alt mr-2"></i>
                    Sair do Sistema
                </button>
            </div>
        </div>
    </div>';
    
    return $html;
}

/**
 * Função para renderizar CSS necessário para o componente
 */
function renderUserComponentCSS() {
    return '
    <style>
    /* Estilos para o componente de usuário logado */
    .user-dropdown {
        position: relative;
    }

    .user-dropdown-content {
        position: absolute;
        top: 100%;
        right: 0;
        background: white;
        border-radius: 0.75rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        border: 1px solid #e5e7eb;
        min-width: 220px;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-10px);
        transition: all 0.3s ease;
        z-index: 1000;
    }

    .user-dropdown.active .user-dropdown-content {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
    }

    .user-info-card {
        background: linear-gradient(135deg, #667eea, #764ba2);
        border-radius: 12px;
        padding: 1rem;
        color: white;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .user-avatar {
        border: 3px solid rgba(255, 255, 255, 0.3);
        transition: all 0.3s ease;
    }

    .user-avatar:hover {
        border-color: rgba(255, 255, 255, 0.8);
        transform: scale(1.05);
    }

    .logout-button {
        transition: all 0.3s ease;
    }

    .logout-button:hover {
        background-color: #dc2626;
        transform: translateY(-1px);
    }
    </style>';
}

/**
 * Função para renderizar JavaScript necessário para o componente
 */
function renderUserComponentJS() {
    return '
    <script>
    // Função para toggle do dropdown do usuário
    function toggleUserDropdown() {
        const dropdown = document.getElementById("userDropdown");
        const icon = document.getElementById("userDropdownIcon");
        
        if (dropdown.classList.contains("active")) {
            dropdown.classList.remove("active");
            if (icon) icon.style.transform = "rotate(0deg)";
        } else {
            dropdown.classList.add("active");
            if (icon) icon.style.transform = "rotate(180deg)";
        }
    }

    // Função para confirmar logout
    function confirmarLogout() {
        Swal.fire({
            title: "Confirmar Saída",
            html: `
                <div style="text-align: left;">
                    <p>Tem certeza que deseja sair do sistema?</p>
                    <p class="mt-2"><small class="text-gray-600">Todas as alterações não salvas serão perdidas.</small></p>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "<i class=\"fas fa-sign-out-alt mr-1\"></i> Sair",
            cancelButtonText: "<i class=\"fas fa-times mr-1\"></i> Cancelar",
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#6b7280",
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed) {
                // Mostrar loading
                Swal.fire({
                    title: "Saindo...",
                    text: "Encerrando sessão com segurança",
                    allowOutsideClick: false,
                    showConfirmButton: false,
                    willOpen: () => {
                        Swal.showLoading();
                    }
                });
                
                // Redirecionar para logout
                setTimeout(() => {
                    window.location.href = "../logout.php";
                }, 1000);
            }
        });
    }

    // Fechar dropdown ao clicar fora
    document.addEventListener("click", function(event) {
        const dropdown = document.getElementById("userDropdown");
        if (dropdown && !dropdown.contains(event.target)) {
            dropdown.classList.remove("active");
            const icon = document.getElementById("userDropdownIcon");
            if (icon) {
                icon.style.transform = "rotate(0deg)";
            }
        }
    });

    // Fechar dropdown ao pressionar Escape
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
            const dropdown = document.getElementById("userDropdown");
            if (dropdown && dropdown.classList.contains("active")) {
                toggleUserDropdown();
            }
        }
    });
    </script>';
}

// === FIM DAS FUNÇÕES ADICIONAIS ===

?>