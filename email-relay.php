<?php
/**
 * email-relay.php — Relay email via cPanel mail()
 *
 * INSTALLATION :
 *   1. Modifier RELAY_TOKEN ci-dessous (chaîne aléatoire longue)
 *   2. Uploader ce fichier sur l'hébergement cPanel (ex: public_html/email-relay.php)
 *   3. Dans OptimusCredit → Config notifications → Email :
 *      - URL relay : https://perdusdevue.com/email-relay.php
 *      - Token relay : la même valeur que RELAY_TOKEN ci-dessous
 *      - Activer, Enregistrer, Tester
 */

define('RELAY_TOKEN', 'CHANGE_THIS_TO_A_LONG_RANDOM_SECRET');

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$token = $_SERVER['HTTP_X_RELAY_TOKEN'] ?? '';
if (!$token || !hash_equals(RELAY_TOKEN, $token)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data || empty($data['to']) || empty($data['subject']) || empty($data['html'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Champs requis manquants : to, subject, html']);
    exit;
}

$to = filter_var(trim($data['to']), FILTER_VALIDATE_EMAIL);
if (!$to) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Adresse email invalide : ' . htmlspecialchars($data['to'])]);
    exit;
}

$fromName = isset($data['fromName']) ? mb_encode_mimeheader($data['fromName'], 'UTF-8', 'B') : 'OptimusCredit';
$from     = isset($data['from']) && filter_var($data['from'], FILTER_VALIDATE_EMAIL)
            ? $data['from']
            : 'kaizen@perdusdevue.com';

$subject = mb_encode_mimeheader($data['subject'], 'UTF-8', 'B');
$html    = $data['html'];

$headers  = "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";
$headers .= "From: {$fromName} <{$from}>\r\n";
$headers .= "Reply-To: {$from}\r\n";
$headers .= "X-Mailer: OptimusCredit-Relay/1.0\r\n";

$ok = mail($to, $subject, $html, $headers);

if ($ok) {
    echo json_encode(['success' => true, 'message' => "Email envoyé à {$to}"]);
} else {
    $lastErr = error_get_last();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $lastErr['message'] ?? 'mail() a échoué — vérifier la config PHP mail sur cPanel']);
}
