<?php
/**
 * Página de Login - VERSÃO CORRIGIDA
 * Lista de Espera Cirúrgica HC-UFG/EBSERH
 */

// Configurar sessão antes de iniciar
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_strict_mode', 1);
    ini_set('session.cookie_secure', isset($_SERVER['HTTPS']));
    ini_set('session.cookie_samesite', 'Strict');
    
    session_start();
}

error_log("=== INDEX.PHP INICIADO ===");
error_log("Session ID: " . session_id());
error_log("loggedIn status: " . (isset($_SESSION['loggedIn']) ? ($_SESSION['loggedIn'] ? 'true' : 'false') : 'not set'));

// Verificar se o usuário já está logado - VERSÃO MELHORADA
$isAlreadyLoggedIn = (isset($_SESSION['loggedIn']) && $_SESSION['loggedIn'] === true) ||
                     (isset($_SESSION['authenticated']) && $_SESSION['authenticated'] === true);

if ($isAlreadyLoggedIn && isset($_SESSION['loggedInUser']['email'])) {
    error_log("Usuário já está logado: " . $_SESSION['loggedInUser']['email']);
    
    // Verificar se não há problemas na sessão
    if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) < 7200) {
        error_log("Sessão válida - redirecionando para admin");
        
        // Possíveis caminhos para o painel administrativo
        $possiblePaths = [
            'admin/principal.php',
            'admin/index.php',
            'admin/dashboard.php',
            'principal.php',
            'dashboard.php'
        ];
        
        $redirectPath = 'admin/principal.php'; // padrão

        foreach ($possiblePaths as $path) {
            if (file_exists($path)) {
                $redirectPath = $path;
                error_log("Caminho encontrado: $path");
                break;
            }
        }

        // Redirect silencioso sem mensagem de toast
        header('Location: ' . $redirectPath);
        exit;
    } else {
        error_log("Sessão expirada - limpando dados");
        // Sessão expirada, limpar
        $_SESSION = array();
        session_destroy();
        session_start();
    }
}

// Limpar sessão se não estiver logado adequadamente
if (!$isAlreadyLoggedIn) {
    error_log("Usuário não está logado - limpando dados de sessão");
    // Manter apenas as mensagens se existirem
    $message = $_SESSION['message'] ?? '';
    $messageType = $_SESSION['message_type'] ?? '';
    
    $_SESSION = array();
    
    if ($message) {
        $_SESSION['message'] = $message;
        $_SESSION['message_type'] = $messageType;
    }
}

// Obter mensagem para exibir
$message = '';
$messageType = '';
if (isset($_SESSION['message'])) {
    $message = $_SESSION['message'];
    $messageType = $_SESSION['message_type'] ?? 'info';
    unset($_SESSION['message'], $_SESSION['message_type']);
}

// Debug info
$debugInfo = '';
if (isset($_GET['debug']) && $_GET['debug'] === '1') {
    $debugInfo = "Debug ativo - Session ID: " . session_id();
}
?><!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <title>Lista de Espera Cirúrgica - HC-UFG/EBSERH</title>

    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="favicon.svg">

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    
    <style>
        .gradient-card {
            background: white;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
        }
        .gradient-bg {
            background: #f3f4f6;
            min-height: 100vh;
        }
        
        @keyframes fadeInDown {
            from { opacity: 0; transform: translate3d(0, -100%, 0); }
            to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        
        .animate-fade-in-down { animation: fadeInDown 0.8s ease-out; }
        .animate-fade-in { animation: fadeIn 1s ease-out; }
        .animate-shake { animation: shake 0.5s ease-in-out; }
        
        .input-field {
            transition: all 0.3s ease;
            border: 2px solid #e5e7eb;
        }
        
        .input-field:focus {
            border-color: rgb(59, 130, 246);
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            transform: translateY(-2px);
        }
        
        .input-field.error {
            border-color: #ef4444;
            box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }
        
        .login-button {
            background: linear-gradient(135deg, rgb(59, 130, 246), rgb(37, 99, 235));
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .login-button:hover {
            background: linear-gradient(135deg, rgb(37, 99, 235), rgb(29, 78, 216));
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
        }
        
        .loading { pointer-events: none; opacity: 0.7; }
        
        .glass-card {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
        }
        
        .error-display {
            background: linear-gradient(135deg, #fef2f2, #fee2e2);
            border: 2px solid #fca5a5;
            border-radius: 12px;
            padding: 16px;
            margin: 16px 0;
            animation: fadeIn 0.5s ease-out;
        }
        
        .success-display {
            background: linear-gradient(135deg, #f0fdf4, #dcfce7);
            border: 2px solid #86efac;
            border-radius: 12px;
            padding: 16px;
            margin: 16px 0;
            animation: fadeIn 0.5s ease-out;
        }
        
        .info-display {
            background: linear-gradient(135deg, #eff6ff, #dbeafe);
            border: 2px solid #93c5fd;
            border-radius: 12px;
            padding: 16px;
            margin: 16px 0;
            animation: fadeIn 0.5s ease-out;
        }
        
        .field-error {
            color: #dc2626;
            font-size: 0.875rem;
            margin-top: 0.25rem;
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }
        
        .ad-info-card {
            background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
            border: 2px solid #d1d5db;
            border-radius: 12px;
            padding: 16px;
            margin: 16px 0;
            animation: fadeIn 1.2s ease-out;
        }
        
        .domain-badge {
            background: linear-gradient(135deg, rgb(59, 130, 246), rgb(37, 99, 235));
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .user-examples {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 8px;
        }
        
        .user-example {
            background: white;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 12px;
            text-align: center;
            font-family: monospace;
            border: 1px solid rgba(59, 130, 246, 0.3);
        }
        
        .debug-info {
            background: linear-gradient(135deg, #fef3c7, #fde68a);
            border: 2px solid #f59e0b;
            border-radius: 12px;
            padding: 12px;
            margin: 16px 0;
            font-size: 12px;
            animation: fadeIn 0.5s ease-out;
        }
        
        @media (max-width: 768px) {
            .login-container { margin: 1rem; padding: 2rem 1.5rem; }
            .user-examples { grid-template-columns: 1fr; }
        }
    </style>
</head>

<body class="gradient-bg">
    <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-md w-full space-y-8">
            
            <div class="gradient-card rounded-2xl shadow-xl p-8 login-container animate-fade-in-down">
                
                <div class="text-center mb-8">
                    <div class="inline-block mb-4 animate-fade-in">
                        <img src="imagem/logo.png" alt="Logo HC-UFG" style="height: 80px; width: auto;" class="mx-auto">
                    </div>
                    <h2 class="text-3xl font-bold text-gray-800 mb-2 animate-fade-in">
                        Lista de Espera Cirúrgica
                    </h2>
                    <p class="text-gray-600 text-sm animate-fade-in">
                        HC-UFG / EBSERH
                    </p>
                </div>

                <!-- Debug Info -->
                <?php if ($debugInfo): ?>
                <div class="debug-info animate-fade-in">
                    <div class="flex items-center">
                        <i class="fas fa-bug text-orange-600 mr-2"></i>
                        <span class="font-semibold text-orange-800">Debug Mode</span>
                    </div>
                    <p class="text-orange-700 mt-1"><?= htmlspecialchars($debugInfo) ?></p>
                </div>
                <?php endif; ?>


                <!-- Área de mensagens -->
                <div id="messageArea" class="mb-6">
                    <?php if ($message): ?>
                        <div id="alertMessage" class="animate-fade-in
                            <?= $messageType === 'error' ? 'error-display' : 
                                ($messageType === 'success' ? 'success-display' : 'info-display') ?>">
                            <div class="flex items-center">
                                <div class="flex-shrink-0">
                                    <i class="fas <?= $messageType === 'error' ? 'fa-exclamation-triangle text-red-600' : 
                                                    ($messageType === 'success' ? 'fa-check-circle text-green-600' : 'fa-info-circle text-blue-600') ?> text-lg"></i>
                                </div>
                                <div class="ml-3">
                                    <h3 class="text-sm font-medium <?= $messageType === 'error' ? 'text-red-800' : 
                                                                      ($messageType === 'success' ? 'text-green-800' : 'text-blue-800') ?>">
                                        <?= $messageType === 'error' ? 'Erro no Login' : 
                                            ($messageType === 'success' ? 'Sucesso' : 'Informação') ?>
                                    </h3>
                                    <div class="mt-1 text-sm <?= $messageType === 'error' ? 'text-red-700' : 
                                                                ($messageType === 'success' ? 'text-green-700' : 'text-blue-700') ?>">
                                        <?= htmlspecialchars($message) ?>
                                    </div>
                                </div>
                                <div class="ml-auto pl-3">
                                    <button onclick="hideMessage()" class="inline-flex <?= $messageType === 'error' ? 'text-red-400 hover:text-red-600' : 
                                                                                          ($messageType === 'success' ? 'text-green-400 hover:text-green-600' : 'text-blue-400 hover:text-blue-600') ?> transition-colors">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    <?php endif; ?>
                </div>

                <!-- FORMULÁRIO DE LOGIN -->
                <form id="loginForm" action="login-code.php" method="POST" class="space-y-6" novalidate>
                    
                    <!-- Campo hidden obrigatório -->
                    <input type="hidden" name="loginBtn" value="1">
                    
                    <div class="animate-fade-in">
                        <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-user mr-2"></i>
                            Usuário ou Email Institucional
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="text"
                            required
                            class="input-field w-full px-4 py-3 rounded-xl bg-white text-gray-900 placeholder-gray-500 focus:outline-none"
                            placeholder="Digite seu usuário (ex: nome.sobrenome)"
                            autocomplete="username"
                            autocapitalize="none"
                            spellcheck="false"
                        >
                        <div class="text-xs text-gray-600 mt-1 opacity-75">
                            <i class="fas fa-info-circle mr-1"></i>
                            Não é necessário digitar @ebserh.gov.br
                        </div>
                        <div id="emailError" class="field-error" style="display: none;">
                            <i class="fas fa-exclamation-circle"></i>
                            <span></span>
                        </div>
                    </div>

                    <div class="animate-fade-in">
                        <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-lock mr-2"></i>
                            Senha
                        </label>
                        <div class="relative">
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                class="input-field w-full px-4 py-3 pr-12 rounded-xl bg-white text-gray-900 placeholder-gray-500 focus:outline-none"
                                placeholder="Digite sua senha institucional"
                                autocomplete="current-password"
                            >
                            <button
                                type="button"
                                id="togglePassword"
                                class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                <i class="fas fa-eye" id="eyeIcon"></i>
                            </button>
                        </div>
                        <div class="text-xs text-gray-600 mt-1 opacity-75">
                            <i class="fas fa-shield-alt mr-1"></i>
                            Use a mesma senha do Windows/Outlook
                        </div>
                        <div id="passwordError" class="field-error" style="display: none;">
                            <i class="fas fa-exclamation-circle"></i>
                            <span></span>
                        </div>
                    </div>

                    <div id="loginErrors" class="hidden error-display">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i class="fas fa-exclamation-triangle text-red-600 text-lg"></i>
                            </div>
                            <div class="ml-3">
                                <h3 class="text-sm font-medium text-red-800">Problemas encontrados:</h3>
                                <ul id="errorList" class="mt-1 text-sm text-red-700 list-disc list-inside">
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div class="animate-fade-in">
                        <button 
                            type="submit" 
                            id="loginButton"
                            class="login-button w-full py-3 px-4 text-white font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 relative"
                        >
                            <span id="buttonText">
                                <i class="fas fa-sign-in-alt mr-2"></i>
                                Entrar
                            </span>
                        </button>
                    </div>

                    <!-- Debug button (apenas em desenvolvimento) -->
                    <?php if (isset($_GET['debug'])): ?>
                    <div class="text-center mt-4">
                        <button type="button" onclick="testLogin()" class="text-xs text-blue-200 hover:text-white underline">
                            Teste de Login (Debug)
                        </button>
                    </div>
                    <?php endif; ?>

                </form>

                <div class="mt-8 text-center animate-fade-in">
                    <div class="glass-card rounded-xl p-4 bg-gray-100">
                        <p class="text-xs text-gray-700 mb-2">
                            <i class="fas fa-shield-alt mr-2"></i>
                            Login Seguro
                        </p>
                        <p class="text-xs text-gray-600">
                            © 2025 HC-UFG / EBSERH - Todos os direitos reservados AGNC
                        </p>
                    </div>
                </div>

            </div>

            

        </div>
    </div>

    <script>
        // Log de inicialização
        console.log('=== INDEX.PHP CARREGADO ===');
        console.log('Página de login inicializada');
        
        // Toggle de visibilidade da senha
        document.getElementById('togglePassword').addEventListener('click', function() {
            const passwordField = document.getElementById('password');
            const eyeIcon = document.getElementById('eyeIcon');
            
            if (passwordField.type === 'password') {
                passwordField.type = 'text';
                eyeIcon.classList.remove('fa-eye');
                eyeIcon.classList.add('fa-eye-slash');
            } else {
                passwordField.type = 'password';
                eyeIcon.classList.remove('fa-eye-slash');
                eyeIcon.classList.add('fa-eye');
            }
        });

        // Processamento automático do email/usuário
        document.getElementById('email').addEventListener('input', function() {
            let value = this.value.trim();
            
            if (value.includes('@')) {
                return;
            }
            
            value = value.replace(/[^a-zA-Z0-9.-]/g, '');
            this.value = value;
        });

        // Validação e envio do formulário
        document.getElementById('loginForm').addEventListener('submit', function(e) {
            console.log('=== FORM SUBMIT INICIADO ===');
            
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            let email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            const loginButton = document.getElementById('loginButton');
            const buttonText = document.getElementById('buttonText');
            
            console.log('Email original:', email);
            console.log('Senha fornecida:', password ? 'SIM' : 'NÃO');
            
            // Validações básicas
            if (!email || !password) {
                e.preventDefault();
                console.log('ERRO: Campos vazios');
                Swal.fire({
                    icon: 'error',
                    title: 'Campos Obrigatórios',
                    text: 'Por favor, preencha usuário e senha!',
                    confirmButtonColor: '#ef4444'
                });
                return;
            }
            
            // Processar email se necessário
            if (!email.includes('@')) {
                email = email + '@ebserh.gov.br';
                emailInput.value = email;
                console.log('Email processado:', email);
            }
            
            // Validar domínio
            if (!email.endsWith('@ebserh.gov.br')) {
                e.preventDefault();
                console.log('ERRO: Domínio inválido');
                Swal.fire({
                    icon: 'warning',
                    title: 'Domínio Inválido',
                    text: 'Use apenas credenciais do domínio @ebserh.gov.br',
                    confirmButtonColor: '#f59e0b'
                });
                return;
            }
            
            console.log('Validações aprovadas - enviando formulário');
            
            // Aplicar loading state
            loginButton.classList.add('loading');
            buttonText.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Autenticando...';
            loginButton.disabled = true;

            // Remover toast de carregamento (conforme solicitado)
            
            // Verificar dados do formulário
            console.log('Dados finais do formulário:', {
                email: email,
                password: '***',
                loginBtn: document.querySelector('input[name="loginBtn"]').value,
                action: this.action,
                method: this.method
            });
            
            // Timeout de segurança
            setTimeout(() => {
                if (loginButton.disabled) {
                    console.log('TIMEOUT: Reativando botão');
                    loginButton.classList.remove('loading');
                    buttonText.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Entrar';
                    loginButton.disabled = false;
                    
                    Swal.fire({
                        icon: 'warning',
                        title: 'Tempo Limite Excedido',
                        text: 'O login está demorando mais que o esperado. Tente novamente.',
                        confirmButtonColor: '#f59e0b'
                    });
                }
            }, 25000); // 25 segundos
        });

        // Função para esconder mensagens
        function hideMessage() {
            const alert = document.getElementById('alertMessage');
            if (alert) {
                alert.style.opacity = '0';
                setTimeout(() => alert.remove(), 300);
            }
        }

        // Auto-hide da mensagem inicial após 8 segundos
        <?php if ($message): ?>
        setTimeout(() => {
            hideMessage();
        }, 8000);
        <?php endif; ?>

        // Função de teste de login (debug)
        function testLogin() {
            console.log('=== DEBUG LOGIN TEST ===');
            console.log('Form action:', document.getElementById('loginForm').action);
            console.log('Form method:', document.getElementById('loginForm').method);
            console.log('Hidden loginBtn field:', document.querySelector('input[name="loginBtn"]'));
            console.log('Current page URL:', window.location.href);
            
            fetch('login-code.php', { method: 'HEAD' })
                .then(response => {
                    console.log('login-code.php exists:', response.ok);
                    console.log('Response status:', response.status);
                })
                .catch(error => {
                    console.error('Error checking login-code.php:', error);
                });
        }

        // Inicialização
        document.addEventListener('DOMContentLoaded', function() {
            console.log('=== DOM LOADED ===');
            
            const hiddenField = document.querySelector('input[name="loginBtn"]');
            console.log('Campo loginBtn encontrado:', hiddenField ? 'SIM' : 'NÃO');
            if (hiddenField) {
                console.log('Valor do campo loginBtn:', hiddenField.value);
            }
            
            // Foco no campo de usuário
            document.getElementById('email').focus();
            
            console.log('Página atual:', window.location.href);
            console.log('Formulário action:', document.getElementById('loginForm').action);
        });

        
    </script>

</body>
</html>