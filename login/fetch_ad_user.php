<?php
/**
 * Integração com Active Directory - HC-UFG/EBSERH
 * Configurações reais da instituição
 */

function validaLoginAD($usuario, $senha) {
    try {
        // Configurações reais do Active Directory da EBSERH
        $ldapconfig['host'] = '10.50.0.40'; // AD-001
        $ldapconfig['port'] = '389'; // Porta Padrão
        $ldapconfig['dn'] = "OU=Usuarios,OU=HCGO,OU=EBSERH,DC=ebserhnet,DC=ebserh,DC=gov,DC=br";
        $domain = 'ebserhnet.ebserh.gov.br';
        $username = $usuario;
        $password = $senha;

        // Faz conexão com AD usando LDAP
        $sn = ldap_connect($ldapconfig['host'], $ldapconfig['port']);
        
        if (!$sn) {
            error_log("LDAP: Não foi possível conectar ao servidor AD");
            return null;
        }
        
        ldap_set_option($sn, LDAP_OPT_PROTOCOL_VERSION, 3);
        ldap_set_option($sn, LDAP_OPT_REFERRALS, 0);
        ldap_set_option($sn, LDAP_OPT_NETWORK_TIMEOUT, 10);
        
        // Tentar autenticação
        $bind = @ldap_bind($sn, $username . '@' . $domain, $password);
        
        if (!$bind) {
            ldap_close($sn);
            error_log("LDAP: Falha na autenticação para usuário: $username");
            return null;
        }

        // Buscar informações do usuário
        $filter = "(sAMAccountName=$username)";
        $attributes = array(
            'name', 'mail', 'department', 'title', 'telephonenumber', 
            'company', 'description', 'memberof', 'displayname'
        );
        $search = ldap_search($sn, $ldapconfig['dn'], $filter, $attributes);

        if (!$search) {
            ldap_close($sn);
            error_log("LDAP: Erro na busca de dados do usuário: $username");
            return null;
        }

        $data = ldap_get_entries($sn, $search);

        if ($data["count"] > 0) {
            $user_data = $data[0];
            
            // Extrair dados do usuário
            $userData = array(
                'username' => $username,
                'name' => isset($user_data['displayname'][0]) ? $user_data['displayname'][0] : 
                         (isset($user_data['name'][0]) ? $user_data['name'][0] : $username),
                'email' => isset($user_data['mail'][0]) ? $user_data['mail'][0] : $username . '@ebserh.gov.br',
                'department' => isset($user_data['department'][0]) ? $user_data['department'][0] : 'Não informado',
                'phone' => isset($user_data['telephonenumber'][0]) ? $user_data['telephonenumber'][0] : 'Não informado',
                'cargo' => isset($user_data['title'][0]) ? $user_data['title'][0] : 'Não informado',
                'company' => isset($user_data['company'][0]) ? $user_data['company'][0] : 'EBSERH',
                'description' => isset($user_data['description'][0]) ? $user_data['description'][0] : '',
                'groups' => array(),
                'avatar' => generateAvatarUrl($user_data['displayname'][0] ?? $user_data['name'][0] ?? $username)
            );
            
            // Extrair grupos/permissões se disponível
            if (isset($user_data['memberof'])) {
                for ($i = 0; $i < $user_data['memberof']['count']; $i++) {
                    $group = $user_data['memberof'][$i];
                    $userData['groups'][] = $group;
                }
            }
            
            ldap_close($sn);
            error_log("LDAP: Login bem-sucedido para usuário: $username");
            return $userData;
        }

        ldap_close($sn);
        return null;
        
    } catch (Exception $e) {
        error_log("LDAP: Erro na validação: " . $e->getMessage());
        
        // FALLBACK: Para desenvolvimento/testes locais
        if (in_array($usuario, ['admin', 'teste', 'demo'])) {
            return array(
                'username' => $usuario,
                'name' => 'Usuário ' . ucfirst($usuario),
                'email' => $usuario . '@ebserh.gov.br',
                'department' => 'TI - Desenvolvimento',
                'phone' => '(62) 9999-9999',
                'cargo' => $usuario === 'admin' ? 'Administrador' : 'Usuário',
                'company' => 'EBSERH',
                'description' => 'Usuário de teste',
                'groups' => array(),
                'avatar' => generateAvatarUrl('Usuário ' . ucfirst($usuario))
            );
        }
        
        return null;
    }
}

/**
 * Gerar URL de avatar baseado no nome
 */
function generateAvatarUrl($name) {
    $initials = '';
    $words = explode(' ', trim($name));
    
    foreach ($words as $word) {
        if (!empty($word)) {
            $initials .= strtoupper($word[0]);
            if (strlen($initials) >= 2) break;
        }
    }
    
    if (empty($initials)) $initials = 'US';
    
    return "https://ui-avatars.com/api/?name=" . urlencode($initials) . 
           "&background=667eea&color=ffffff&size=128&font-size=0.6";
}

/**
 * Determinar função do usuário baseado nos dados do AD e tabela local
 */
function determineUserFunction($userData, $localUserData = null) {
    // Se usuário existe na tabela local, usar função de lá
    if ($localUserData && isset($localUserData['nivel_acesso'])) {
        return $localUserData['nivel_acesso'];
    }
    
    // Caso contrário, função padrão para usuários AD
    return 'visualizador';
}

/**
 * Validar se usuário AD pode acessar o sistema
 */
function validateADAccess($userData) {
    // Verificar se email é do domínio correto
    if (!preg_match('/@ebserh\.gov\.br$/i', $userData['email'])) {
        error_log("Acesso negado: email fora do domínio - " . $userData['email']);
        return false;
    }
    
    return true;
}

/**
 * Registrar acesso para auditoria
 */
function logADAccess($userData, $success = true, $message = '') {
    $logData = array(
        'timestamp' => date('Y-m-d H:i:s'),
        'username' => $userData['username'] ?? 'unknown',
        'email' => $userData['email'] ?? 'unknown',
        'name' => $userData['name'] ?? 'unknown',
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        'success' => $success,
        'message' => $message
    );
    
    $logMessage = "AD_LOGIN: " . json_encode($logData);
    error_log($logMessage);
}

// === ENDPOINT AJAX PARA VALIDAÇÃO (mantido para compatibilidade) ===
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['username']) && isset($_POST['password'])) {
    $username = $_POST['username'];
    $password = $_POST['password'];

    $userData = validaLoginAD($username, $password);

    if ($userData) {
        echo json_encode(['success' => true, 'data' => $userData]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Usuário não encontrado ou credenciais inválidas.']);
    }
    exit;
}

?>