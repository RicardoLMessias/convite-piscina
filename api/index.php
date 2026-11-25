<?php

declare(strict_types=1);

session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax',
    'cookie_secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
    'use_strict_mode' => true,
]);

$config = require __DIR__ . '/config.php';

try {
    route($config);
} catch (Throwable $error) {
    error_log('Falha na API do convite: ' . $error->getMessage());
    jsonResponse(500, ['error' => 'Não foi possível concluir a solicitação. Tente novamente mais tarde.']);
}

function route(array $config): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $apiPos = strpos($path, '/api');
    $path = $apiPos === false ? '/api' : substr($path, $apiPos);
    $pdo = db($config);

    if ($method === 'POST' && $path === '/api/login') {
        $payload = readJson();
        foreach ($config['users'] as $user) {
            if ($user['username'] === ($payload['username'] ?? '') && $user['password'] === ($payload['password'] ?? '')) {
                session_regenerate_id(true);
                $_SESSION['drk_user'] = publicUser($user);
                jsonResponse(200, ['ok' => true, 'user' => publicUser($user)]);
            }
        }
        jsonResponse(401, ['ok' => false, 'error' => 'Usuario ou senha invalidos.']);
    }

    if ($method === 'POST' && $path === '/api/logout') {
        $_SESSION = [];
        session_destroy();
        jsonResponse(200, ['ok' => true]);
    }

    if ($method === 'GET' && $path === '/api/session') {
        $user = currentUser();
        jsonResponse(200, ['authenticated' => (bool) $user, 'user' => $user]);
    }

    if ($method === 'GET' && $path === '/api/event') {
        $publicEvent = getEvent($pdo);
        unset($publicEvent['venueName'], $publicEvent['address'], $publicEvent['mapQuery']);
        jsonResponse(200, ['event' => $publicEvent]);
    }

    if ($method === 'POST' && $path === '/api/rsvp') {
        jsonResponse(201, saveConfirmation($pdo, readJson(), $config));
    }

    if ($method === 'POST' && $path === '/api/rsvp/resend-email') {
        jsonResponse(200, resendConfirmationEmail($pdo, readJson(), $config));
    }

    $currentUser = currentUser();
    if (!$currentUser) {
        jsonResponse(401, ['error' => 'Acesso administrativo nao autorizado.']);
    }

    if ($method === 'GET' && $path === '/api/dashboard') {
        jsonResponse(200, buildDashboard($pdo, $currentUser));
    }

    if ($method === 'POST' && $path === '/api/broadcast/email') {
        requireOwner($currentUser);
        jsonResponse(200, sendBulkEmailMessage($pdo, $config, readJson()));
    }

    if ($method === 'GET' && $path === '/api/users') {
        requireOwner($currentUser);
        jsonResponse(200, ['users' => array_map('publicUser', $config['users'])]);
    }

    if ($method === 'PUT' && $path === '/api/event') {
        requireOwner($currentUser);
        jsonResponse(200, updateEvent($pdo, readJson()));
    }

    if ($method === 'POST' && $path === '/api/duplicates/resolve') {
        jsonResponse(200, resolveDuplicate($pdo, readJson()));
    }

    if ($method === 'GET' && $path === '/api/export.pdf') {
        exportPdf($pdo, $currentUser);
    }

    if (preg_match('#^/api/guests/([^/]+)$#', $path, $matches)) {
        $guestId = rawurldecode($matches[1]);
        if ($method === 'DELETE') {
            jsonResponse(200, deleteGuest($pdo, $guestId));
        }
        if ($method === 'PUT') {
            jsonResponse(200, updateGuest($pdo, $guestId, readJson()));
        }
    }

    jsonResponse(404, ['error' => 'Endpoint nao encontrado']);
}

function db(array $config): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;

    $pdo = new PDO(
        $config['database']['dsn'],
        $config['database']['user'],
        $config['database']['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ],
    );
    return $pdo;
}

function currentUser(): ?array
{
    return $_SESSION['drk_user'] ?? null;
}

function publicUser(array $user): array
{
    return [
        'username' => $user['username'],
        'role' => $user['role'],
        'label' => $user['label'],
    ];
}

function isOwner(?array $user): bool
{
    return ($user['role'] ?? '') === 'owner';
}

function requireOwner(?array $user): void
{
    if (!isOwner($user)) {
        jsonResponse(403, ['error' => 'Acesso restrito ao administrador.']);
    }
}

function readJson(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $payload = json_decode($raw, true);
    return is_array($payload) ? $payload : [];
}

function jsonResponse(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function createId(string $prefix): string
{
    return $prefix . '_' . dechex((int) (microtime(true) * 1000)) . '_' . bin2hex(random_bytes(3));
}

function cleanText(mixed $value, string $fallback = ''): string
{
    $text = trim((string) ($value ?? ''));
    return $text !== '' ? $text : $fallback;
}

function normalizePhone(mixed $phone): string
{
    return preg_replace('/\D+/', '', (string) ($phone ?? '')) ?? '';
}

function normalizeName(mixed $name): string
{
    $text = trim((string) ($name ?? ''));
    $converted = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
    $text = $converted !== false ? $converted : $text;
    $text = strtolower($text);
    $text = preg_replace('/[^a-z\s]+/', ' ', $text) ?? '';
    $parts = preg_split('/\s+/', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $connectors = ['de', 'da', 'do', 'das', 'dos', 'e'];
    $parts = array_values(array_filter($parts, fn ($part) => !in_array($part, $connectors, true)));
    return trim(implode(' ', $parts));
}

function compactName(string $name): string
{
    return str_replace(' ', '', normalizeName($name));
}

function similarity(string $a, string $b): float
{
    $left = compactName($a);
    $right = compactName($b);
    if ($left === '' || $right === '') return 0;
    if ($left === $right) return 1;
    return 1 - levenshtein($left, $right) / max(strlen($left), strlen($right));
}

function isPossibleDuplicate(string $a, string $b): bool
{
    $normalizedA = normalizeName($a);
    $normalizedB = normalizeName($b);
    if ($normalizedA === '' || $normalizedB === '' || $normalizedA === $normalizedB) return false;

    $aTokens = explode(' ', $normalizedA);
    $bTokens = explode(' ', $normalizedB);
    $shared = count(array_intersect(array_unique($aTokens), array_unique($bTokens)));
    $sameFirstName = ($aTokens[0] ?? '') === ($bTokens[0] ?? '');
    $score = similarity($a, $b);
    $sharedBeyondFirstName = count(array_filter(array_intersect(array_unique($aTokens), array_unique($bTokens)), fn ($part) => $part !== ($aTokens[0] ?? '')));

    return $score >= 0.9 || ($sameFirstName && ($score >= 0.58 || $sharedBeyondFirstName >= 1 || $shared >= 2));
}

function getEvent(PDO $pdo): array
{
    $event = $pdo->query('SELECT * FROM events ORDER BY id LIMIT 1')->fetch();
    if (!$event) {
        throw new RuntimeException('Nenhum evento cadastrado. Importe o schema.sql primeiro.');
    }
    return mapEvent($event);
}

function mapEvent(array $event): array
{
    return [
        'id' => $event['id'],
        'title' => $event['title'],
        'description' => $event['description'],
        'date' => $event['date_iso'],
        'dateText' => $event['date_text'],
        'timeText' => $event['time_text'],
        'venueName' => $event['venue_name'],
        'address' => $event['address'],
        'mapQuery' => $event['map_query'],
        'whatsappNumber' => $event['whatsapp_number'],
        'whatsappMessage' => $event['whatsapp_message'],
        'maxCompanions' => (int) $event['max_companions'],
        'allowChildren' => (bool) $event['allow_children'],
        'successMessage' => $event['success_message'],
    ];
}

function eventProgram(): array
{
    return [
        ['time' => '13h', 'activity' => 'início festa'],
        ['time' => '13:30 às 15h', 'activity' => 'almoço'],
        ['time' => '15:00', 'activity' => 'mesa de Hotdog'],
        ['time' => '16:30', 'activity' => 'parabéns'],
        ['time' => '18h', 'activity' => 'encerramento'],
    ];
}

function eventProgramLines(): array
{
    return array_map(
        static fn (array $item): string => $item['time'] . ' — ' . $item['activity'],
        eventProgram(),
    );
}

function eventInvitationDetails(array $event): array
{
    $address = cleanText($event['address'] ?? '');
    $mapQuery = cleanText($event['mapQuery'] ?? '', $address);
    $mapUrl = $mapQuery !== ''
        ? 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode($mapQuery)
        : '';

    return ['address' => $address, 'mapUrl' => $mapUrl];
}

function saveConfirmation(PDO $pdo, array $payload, array $config): array
{
    $event = getEvent($pdo);
    $now = gmdate('c');
    $eventId = cleanText($payload['eventId'] ?? '', $event['id']);
    $responsibleName = cleanText($payload['responsibleName'] ?? '');
    $responsiblePhone = normalizePhone($payload['responsiblePhone'] ?? '');
    $responsibleEmail = filter_var(trim((string) ($payload['responsibleEmail'] ?? '')), FILTER_VALIDATE_EMAIL);
    $willAttend = ($payload['willAttend'] ?? 'yes') !== 'no';
    $rawGuests = array_merge(
        [['name' => $responsibleName, 'type' => 'adult']],
        is_array($payload['guests'] ?? null) ? $payload['guests'] : [],
    );

    if ($responsibleName === '') {
        return ['ok' => false, 'error' => 'Informe o nome do responsavel.'];
    }
    if (!$responsibleEmail) {
        return ['ok' => false, 'error' => 'Informe um e-mail valido para receber a confirmacao.'];
    }

    $incomingGuests = [];
    foreach ($rawGuests as $guest) {
        $fullName = is_array($guest) ? cleanText($guest['name'] ?? $guest['fullName'] ?? '') : cleanText($guest);
        if ($fullName === '') continue;
        $incomingGuests[] = [
            'fullName' => $fullName,
            'type' => is_array($guest) && ($guest['type'] ?? '') === 'child' ? 'child' : 'adult',
        ];
    }

    if (!$incomingGuests) {
        return ['ok' => false, 'error' => 'Informe ao menos um convidado.'];
    }
    if ($event['maxCompanions'] >= 0 && count($incomingGuests) - 1 > $event['maxCompanions']) {
        return ['ok' => false, 'error' => 'Limite de ' . $event['maxCompanions'] . ' acompanhante(s) excedido.'];
    }
    if (!$event['allowChildren']) {
        foreach ($incomingGuests as $guest) {
            if ($guest['type'] === 'child') return ['ok' => false, 'error' => 'Este evento nao aceita marcacao de criancas.'];
        }
    }

    $pdo->beginTransaction();
    try {
        $confirmationId = createId('conf');
        $insertConfirmation = $pdo->prepare('INSERT INTO confirmations (id, event_id, responsible_name, responsible_phone, responsible_email, will_attend, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $insertConfirmation->execute([$confirmationId, $eventId, $responsibleName, $responsiblePhone, $responsibleEmail, $willAttend ? 1 : 0, $now, $now]);

        $savedGuests = [];
        $duplicates = [];

        foreach ($incomingGuests as $incomingGuest) {
            $fullName = $incomingGuest['fullName'];
            $normalizedName = normalizeName($fullName);
            if ($normalizedName === '') continue;

            $exact = findGuestByNormalizedName($pdo, $eventId, $normalizedName);
            if ($exact) {
                linkConfirmation($pdo, $exact['id'], $confirmationId);
                $update = $pdo->prepare('UPDATE guests SET status = ?, type = COALESCE(type, ?), responsible_name = ?, responsible_phone = ?, responsible_email = ?, updated_at = ? WHERE id = ?');
                $update->execute([$willAttend ? 'confirmed' : 'declined', $incomingGuest['type'], $responsibleName, $responsiblePhone, $responsibleEmail, $now, $exact['id']]);
                $duplicates[] = ['type' => 'exact', 'incomingName' => $fullName, 'existingName' => $exact['full_name'], 'guestId' => $exact['id']];
                continue;
            }

            $guestId = createId('guest');
            $insertGuest = $pdo->prepare('INSERT INTO guests (id, event_id, full_name, normalized_name, type, responsible_name, responsible_phone, responsible_email, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $insertGuest->execute([$guestId, $eventId, $fullName, $normalizedName, $incomingGuest['type'], $responsibleName, $responsiblePhone, $responsibleEmail, $willAttend ? 'confirmed' : 'declined', $now, $now]);
            linkConfirmation($pdo, $guestId, $confirmationId);

            $guest = getGuest($pdo, $guestId);
            $savedGuests[] = mapGuest($guest);

            foreach (possibleMatches($pdo, $eventId, $guestId, $fullName) as $match) {
                $duplicates[] = array_merge(['type' => 'possible'], $match);
            }
        }

        $pdo->commit();
        $emailSent = false;
        try {
            sendConfirmationEmail($config['mail'] ?? [], $event, $responsibleEmail, $responsibleName, $willAttend, $incomingGuests);
            $emailSent = true;
        } catch (Throwable $mailError) {
            error_log('Falha ao enviar e-mail de confirmacao: ' . $mailError->getMessage());
        }
        return [
            'ok' => true,
            'emailSent' => $emailSent,
            'confirmation' => ['id' => $confirmationId, 'eventId' => $eventId, 'responsibleName' => $responsibleName, 'responsiblePhone' => $responsiblePhone, 'responsibleEmail' => $responsibleEmail, 'willAttend' => $willAttend, 'createdAt' => $now, 'updatedAt' => $now],
            'eventDetails' => $willAttend ? eventInvitationDetails($event) : null,
            'savedGuests' => $savedGuests,
            'duplicates' => $duplicates,
            'totals' => buildDashboard($pdo)['totals'],
        ];
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

function sendConfirmationEmail(array $mail, array $event, string $recipient, string $responsibleName, bool $willAttend, array $guests): void
{
    foreach (['host', 'fromAddress'] as $required) {
        if (empty($mail[$required])) throw new RuntimeException('SMTP_HOST e MAIL_FROM_ADDRESS precisam estar configurados.');
    }
    if (!filter_var($mail['fromAddress'], FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('MAIL_FROM_ADDRESS nao e um e-mail valido.');
    }

    $eventTitle = cleanText($event['title'] ?? '', 'Festa da Olivia Maria');
    $attendance = $willAttend ? 'Presença confirmada' : 'Ausência registrada';
    $invitationDetails = $willAttend ? eventInvitationDetails($event) : null;
    $hasInvitationImage = invitationImagePath() !== null;
    $guestLines = array_map(
        fn ($guest) => '- ' . $guest['fullName'] . ($guest['type'] === 'child' ? ' (criança)' : ''),
        $guests,
    );
    $body = implode("\r\n", [
        'Olá, ' . $responsibleName . '!',
        '',
        'Sua resposta para ' . $eventTitle . ' foi registrada.',
        $attendance,
        'Data: ' . ($event['dateText'] ?? ''),
        'Horário: ' . ($event['timeText'] ?? ''),
        'Programação:',
        ...eventProgramLines(),
        'Vá com roupa de banho!',
        ...($invitationDetails ? [
            'Endereço: ' . $invitationDetails['address'],
            'Link para o mapa: ' . $invitationDetails['mapUrl'],
        ] : ['O endereço será liberado mediante a confirmação de presença.']),
        '',
        'Convidados informados:',
        ...$guestLines,
        '',
        'Até lá!',
        ...($hasInvitationImage ? ['', 'O convite ilustrado aparece no corpo deste e-mail.'] : []),
    ]);

    sendSmtpEmail($mail, $recipient, 'Confirmação: ' . $eventTitle, $body, $hasInvitationImage);
}

function resendConfirmationEmail(PDO $pdo, array $payload, array $config): array
{
    $confirmationId = trim((string) ($payload['confirmationId'] ?? ''));
    $responsibleEmail = strtolower(trim((string) ($payload['responsibleEmail'] ?? '')));

    if ($confirmationId === '' || !filter_var($responsibleEmail, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(422, ['ok' => false, 'error' => 'Não foi possível localizar esta confirmação.']);
    }

    $confirmationQuery = $pdo->prepare('SELECT * FROM confirmations WHERE id = ? AND LOWER(responsible_email) = ? LIMIT 1');
    $confirmationQuery->execute([$confirmationId, $responsibleEmail]);
    $confirmation = $confirmationQuery->fetch();
    if (!$confirmation) {
        jsonResponse(404, ['ok' => false, 'error' => 'Confirmação não encontrada. Envie o formulário novamente para atualizar seus dados.']);
    }

    $eventQuery = $pdo->prepare('SELECT * FROM events WHERE id = ? LIMIT 1');
    $eventQuery->execute([$confirmation['event_id']]);
    $eventRow = $eventQuery->fetch();
    if (!$eventRow) {
        throw new RuntimeException('Evento da confirmação não encontrado.');
    }

    $guestQuery = $pdo->prepare('SELECT g.full_name AS fullName, g.type FROM guests g INNER JOIN guest_confirmations gc ON gc.guest_id = g.id WHERE gc.confirmation_id = ? ORDER BY g.created_at, g.full_name');
    $guestQuery->execute([$confirmationId]);
    $guests = $guestQuery->fetchAll();
    if (!$guests) {
        $guests = [['fullName' => $confirmation['responsible_name'], 'type' => 'adult']];
    }

    sendConfirmationEmail(
        $config['mail'] ?? [],
        mapEvent($eventRow),
        $confirmation['responsible_email'],
        $confirmation['responsible_name'],
        (bool) $confirmation['will_attend'],
        $guests,
    );

    return ['ok' => true, 'emailSent' => true];
}

function sendBulkEmailMessage(PDO $pdo, array $config, array $payload): array
{
    $subject = trim((string) ($payload['subject'] ?? ''));
    $message = trim((string) ($payload['message'] ?? ''));
    $subject = preg_replace('/[\r\n]+/', ' ', $subject) ?? '';

    if ($subject === '' || $message === '') {
        jsonResponse(422, ['ok' => false, 'error' => 'Informe o assunto e a mensagem.']);
    }
    if (mb_strlen($subject, 'UTF-8') > 180 || mb_strlen($message, 'UTF-8') > 5000) {
        jsonResponse(422, ['ok' => false, 'error' => 'O assunto deve ter até 180 caracteres e a mensagem até 5.000.']);
    }

    $event = getEvent($pdo);
    $recipients = $pdo->prepare("SELECT LOWER(TRIM(responsible_email)) AS email, MIN(responsible_name) AS name FROM guests WHERE event_id = ? AND status = 'confirmed' AND TRIM(responsible_email) <> '' GROUP BY LOWER(TRIM(responsible_email)) ORDER BY email");
    $recipients->execute([$event['id']]);
    $recipients = $recipients->fetchAll();
    $embedImage = invitationImagePath() !== null;
    $invitationDetails = eventInvitationDetails($event);

    $sent = 0;
    $failed = 0;
    foreach ($recipients as $recipient) {
        $body = implode("\r\n", [
            'Olá, ' . $recipient['name'] . '!',
            '',
            $message,
            '',
            'Informações do evento:',
            'Data: ' . $event['dateText'],
            'Horário: ' . $event['timeText'],
            'Programação:',
            ...eventProgramLines(),
            'Vá com roupa de banho!',
            'Endereço: ' . $invitationDetails['address'],
            'Link para o mapa: ' . $invitationDetails['mapUrl'],
            '',
            'Com carinho, ' . $event['title'],
        ]);

        try {
            sendSmtpEmail($config['mail'] ?? [], $recipient['email'], $subject, $body, $embedImage);
            $sent++;
        } catch (Throwable $error) {
            error_log('Falha no envio de e-mail em lote: ' . $error->getMessage());
            $failed++;
        }
    }

    return [
        'ok' => true,
        'recipientCount' => count($recipients),
        'sentCount' => $sent,
        'failedCount' => $failed,
        'imageEmbedded' => $embedImage,
    ];
}

function sendSmtpEmail(array $mail, string $recipient, string $subject, string $body, bool $embedImage = false): void
{
    foreach (['host', 'fromAddress'] as $required) {
        if (empty($mail[$required])) throw new RuntimeException('SMTP_HOST e MAIL_FROM_ADDRESS precisam estar configurados.');
    }
    if (!filter_var($recipient, FILTER_VALIDATE_EMAIL) || !filter_var($mail['fromAddress'], FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('Endereço de e-mail inválido.');
    }

    $imagePath = invitationImagePath();
    $embedImage = $embedImage && $imagePath !== null;
    $transport = smtpConnect($mail);
    try {
        smtpCommand($transport, 'EHLO convite.local', [250]);
        $encryption = strtolower((string) ($mail['encryption'] ?? 'tls'));
        if ($encryption === 'tls') {
            smtpCommand($transport, 'STARTTLS', [220]);
            if (!stream_socket_enable_crypto($transport, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('Nao foi possivel ativar TLS no servidor SMTP.');
            }
            smtpCommand($transport, 'EHLO convite.local', [250]);
        }
        if (!empty($mail['username'])) {
            smtpCommand($transport, 'AUTH LOGIN', [334]);
            smtpCommand($transport, base64_encode((string) $mail['username']), [334]);
            smtpCommand($transport, base64_encode((string) ($mail['password'] ?? '')), [235]);
        }
        smtpCommand($transport, 'MAIL FROM:<' . $mail['fromAddress'] . '>', [250]);
        smtpCommand($transport, 'RCPT TO:<' . $recipient . '>', [250, 251]);
        smtpCommand($transport, 'DATA', [354]);

        $fromName = mb_encode_mimeheader((string) ($mail['fromName'] ?? 'Convite'), 'UTF-8', 'B');
        $encodedSubject = mb_encode_mimeheader(preg_replace('/[\r\n]+/', ' ', $subject) ?? '', 'UTF-8', 'B');
        $headers = [
            'From: ' . $fromName . ' <' . $mail['fromAddress'] . '>',
            'To: <' . $recipient . '>',
            'Subject: ' . $encodedSubject,
            'MIME-Version: 1.0',
        ];
        if ($embedImage) {
            $mimeType = (new finfo(FILEINFO_MIME_TYPE))->file($imagePath);
            if (!in_array($mimeType, ['image/png', 'image/jpeg', 'image/webp'], true)) {
                throw new RuntimeException('A imagem do convite deve estar em PNG, JPG ou WEBP.');
            }
        }

        $alternativeBoundary = 'olivia_alt_' . bin2hex(random_bytes(12));
        $htmlBody = '<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#eefcff;font-family:Arial,sans-serif;color:#07516a">';
        $htmlBody .= '<div style="max-width:680px;margin:0 auto;padding:24px;border-radius:16px;background:#fff">';
        $htmlBody .= '<div style="font-size:16px;line-height:1.65;white-space:normal">' . nl2br(htmlspecialchars($body, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'), false) . '</div>';
        if ($embedImage) {
            $htmlBody .= '<img src="cid:olivia-invitation" alt="Convite da festa" style="display:block;width:100%;max-width:620px;height:auto;margin:24px auto 0;border:0">';
        }
        $htmlBody .= '</div></body></html>';

        if ($embedImage) {
            $relatedBoundary = 'olivia_related_' . bin2hex(random_bytes(12));
            $headers[] = 'Content-Type: multipart/related; type="multipart/alternative"; boundary="' . $relatedBoundary . '"';
            $message = implode("\r\n", $headers) . "\r\n\r\n";
            $message .= '--' . $relatedBoundary . "\r\n";
            $message .= 'Content-Type: multipart/alternative; boundary="' . $alternativeBoundary . "\"\r\n\r\n";
            $message .= '--' . $alternativeBoundary . "\r\n";
            $message .= "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
            $message .= chunk_split(base64_encode($body)) . "\r\n";
            $message .= '--' . $alternativeBoundary . "\r\n";
            $message .= "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
            $message .= chunk_split(base64_encode($htmlBody)) . "\r\n";
            $message .= '--' . $alternativeBoundary . "--\r\n\r\n";
            $extension = pathinfo($imagePath, PATHINFO_EXTENSION);
            $message .= '--' . $relatedBoundary . "\r\n";
            $message .= 'Content-Type: ' . $mimeType . '; name="convite-email.' . $extension . "\"\r\n";
            $message .= "Content-Transfer-Encoding: base64\r\nContent-ID: <olivia-invitation>\r\nContent-Disposition: inline; filename=\"convite-email." . $extension . "\"\r\n\r\n";
            $message .= chunk_split(base64_encode((string) file_get_contents($imagePath))) . "\r\n";
            $message .= '--' . $relatedBoundary . '--';
        } else {
            $headers[] = 'Content-Type: multipart/alternative; boundary="' . $alternativeBoundary . '"';
            $message = implode("\r\n", $headers) . "\r\n\r\n";
            $message .= '--' . $alternativeBoundary . "\r\n";
            $message .= "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
            $message .= chunk_split(base64_encode($body)) . "\r\n";
            $message .= '--' . $alternativeBoundary . "\r\n";
            $message .= "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
            $message .= chunk_split(base64_encode($htmlBody)) . "\r\n";
            $message .= '--' . $alternativeBoundary . '--';
        }

        $message = preg_replace('/(?m)^\./', '..', $message) ?? $message;
        fwrite($transport, $message . "\r\n.\r\n");
        smtpReadResponse($transport, [250]);
        smtpCommand($transport, 'QUIT', [221]);
    } finally {
        fclose($transport);
    }
}

function invitationImagePath(): ?string
{
    $paths = [
        dirname(__DIR__) . '/assets/convite-email.png',
        dirname(__DIR__) . '/public/assets/convite-email.png',
    ];

    foreach ($paths as $path) {
        if (is_file($path) && is_readable($path)) {
            return $path;
        }
    }

    return null;
}

function smtpConnect(array $mail)
{
    $encryption = strtolower((string) ($mail['encryption'] ?? 'tls'));
    $host = (string) $mail['host'];
    $port = (int) ($mail['port'] ?? 587);
    $target = ($encryption === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;
    $transport = @stream_socket_client($target, $errorCode, $errorMessage, 15, STREAM_CLIENT_CONNECT);
    if (!$transport) throw new RuntimeException('Conexao SMTP falhou: ' . $errorMessage . ' (' . $errorCode . ').');
    stream_set_timeout($transport, 15);
    smtpReadResponse($transport, [220]);
    return $transport;
}

function smtpCommand($transport, string $command, array $expectedCodes): string
{
    fwrite($transport, $command . "\r\n");
    return smtpReadResponse($transport, $expectedCodes);
}

function smtpReadResponse($transport, array $expectedCodes): string
{
    $response = '';
    do {
        $line = fgets($transport, 515);
        if ($line === false) throw new RuntimeException('O servidor SMTP encerrou a conexao.');
        $response .= $line;
    } while (isset($line[3]) && $line[3] === '-');

    $code = (int) substr($response, 0, 3);
    if (!in_array($code, $expectedCodes, true)) {
        throw new RuntimeException('Servidor SMTP respondeu ' . trim($response));
    }
    return $response;
}

function findGuestByNormalizedName(PDO $pdo, string $eventId, string $normalizedName): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM guests WHERE event_id = ? AND normalized_name = ? LIMIT 1');
    $stmt->execute([$eventId, $normalizedName]);
    $guest = $stmt->fetch();
    return $guest ?: null;
}

function getGuest(PDO $pdo, string $guestId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM guests WHERE id = ? LIMIT 1');
    $stmt->execute([$guestId]);
    $guest = $stmt->fetch();
    return $guest ?: null;
}

function linkConfirmation(PDO $pdo, string $guestId, string $confirmationId): void
{
    $stmt = $pdo->prepare('INSERT IGNORE INTO guest_confirmations (guest_id, confirmation_id) VALUES (?, ?)');
    $stmt->execute([$guestId, $confirmationId]);
}

function possibleMatches(PDO $pdo, string $eventId, string $guestId, string $fullName): array
{
    $stmt = $pdo->prepare('SELECT * FROM guests WHERE event_id = ? AND id <> ?');
    $stmt->execute([$eventId, $guestId]);
    $matches = [];

    foreach ($stmt->fetchAll() as $existing) {
        if (!isPossibleDuplicate($fullName, $existing['full_name'])) continue;

        $duplicateId = createId('dup');
        $score = round(similarity($fullName, $existing['full_name']), 3);
        $insert = $pdo->prepare('INSERT INTO duplicate_candidates (id, event_id, status, incoming_guest_id, existing_guest_id, incoming_name, existing_name, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $insert->execute([$duplicateId, $eventId, 'pending', $guestId, $existing['id'], $fullName, $existing['full_name'], $score, gmdate('c')]);
        $matches[] = ['id' => $duplicateId, 'eventId' => $eventId, 'status' => 'pending', 'incomingGuestId' => $guestId, 'existingGuestId' => $existing['id'], 'incomingName' => $fullName, 'existingName' => $existing['full_name'], 'score' => $score, 'createdAt' => gmdate('c')];
    }

    return $matches;
}

function updateEvent(PDO $pdo, array $payload): array
{
    $event = getEvent($pdo);
    $maxCompanions = (int) ($payload['maxCompanions'] ?? $event['maxCompanions']);
    $stmt = $pdo->prepare('UPDATE events SET title = ?, description = ?, date_iso = ?, date_text = ?, time_text = ?, venue_name = ?, address = ?, map_query = ?, whatsapp_number = ?, whatsapp_message = ?, max_companions = ?, allow_children = ?, success_message = ? WHERE id = ?');
    $stmt->execute([
        cleanText($payload['title'] ?? '', $event['title']),
        cleanText($payload['description'] ?? '', $event['description']),
        cleanText($payload['date'] ?? '', $event['date']),
        cleanText($payload['dateText'] ?? '', $event['dateText']),
        cleanText($payload['timeText'] ?? '', $event['timeText']),
        cleanText($payload['venueName'] ?? '', $event['venueName']),
        cleanText($payload['address'] ?? '', $event['address']),
        cleanText($payload['mapQuery'] ?? '', $event['mapQuery']),
        normalizePhone($payload['whatsappNumber'] ?? $event['whatsappNumber']),
        cleanText($payload['whatsappMessage'] ?? '', $event['whatsappMessage']),
        max(0, $maxCompanions),
        !empty($payload['allowChildren']) ? 1 : 0,
        cleanText($payload['successMessage'] ?? '', $event['successMessage']),
        $event['id'],
    ]);
    return ['ok' => true, 'event' => getEvent($pdo)];
}

function resolveDuplicate(PDO $pdo, array $payload): array
{
    $stmt = $pdo->prepare('SELECT * FROM duplicate_candidates WHERE id = ? LIMIT 1');
    $stmt->execute([$payload['id'] ?? '']);
    $duplicate = $stmt->fetch();
    if (!$duplicate) return ['ok' => false, 'error' => 'Duplicidade nao encontrada.'];

    $action = ($payload['action'] ?? '') === 'merge' ? 'merge' : 'ignore';
    $status = $action === 'merge' ? 'merged' : 'ignored';
    $now = gmdate('c');

    $pdo->beginTransaction();
    try {
        $update = $pdo->prepare('UPDATE duplicate_candidates SET status = ?, resolved_at = ? WHERE id = ?');
        $update->execute([$status, $now, $duplicate['id']]);

        if ($action === 'merge') {
            $links = $pdo->prepare('UPDATE IGNORE guest_confirmations SET guest_id = ? WHERE guest_id = ?');
            $links->execute([$duplicate['existing_guest_id'], $duplicate['incoming_guest_id']]);
            $deleteLinks = $pdo->prepare('DELETE FROM guest_confirmations WHERE guest_id = ?');
            $deleteLinks->execute([$duplicate['incoming_guest_id']]);
            $deleteGuest = $pdo->prepare('DELETE FROM guests WHERE id = ?');
            $deleteGuest->execute([$duplicate['incoming_guest_id']]);
        }

        $pdo->commit();
        return ['ok' => true, 'duplicate' => $duplicate];
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

function deleteGuest(PDO $pdo, string $guestId): array
{
    $guest = getGuest($pdo, $guestId);
    if (!$guest) return ['ok' => false, 'error' => 'Convidado nao encontrado.'];

    $pdo->prepare('DELETE FROM duplicate_candidates WHERE incoming_guest_id = ? OR existing_guest_id = ?')->execute([$guestId, $guestId]);
    $pdo->prepare('DELETE FROM guest_confirmations WHERE guest_id = ?')->execute([$guestId]);
    $pdo->prepare('DELETE FROM guests WHERE id = ?')->execute([$guestId]);
    return ['ok' => true, 'deletedGuest' => mapGuest($guest)];
}

function updateGuest(PDO $pdo, string $guestId, array $payload): array
{
    $guest = getGuest($pdo, $guestId);
    if (!$guest) return ['ok' => false, 'error' => 'Convidado nao encontrado.'];

    $fullName = cleanText($payload['fullName'] ?? '');
    $normalizedName = normalizeName($fullName);
    if ($normalizedName === '') return ['ok' => false, 'error' => 'Informe um nome valido.'];

    $stmt = $pdo->prepare('SELECT * FROM guests WHERE id <> ? AND event_id = ? AND normalized_name = ? LIMIT 1');
    $stmt->execute([$guestId, $guest['event_id'], $normalizedName]);
    $exact = $stmt->fetch();
    if ($exact) return ['ok' => false, 'error' => 'Ja existe um convidado com este nome: ' . $exact['full_name'] . '.', 'existingGuest' => mapGuest($exact)];

    $now = gmdate('c');
    $type = ($payload['type'] ?? '') === 'child' ? 'child' : 'adult';
    $status = ($payload['status'] ?? '') === 'declined' ? 'declined' : 'confirmed';
    $pdo->prepare('UPDATE guests SET full_name = ?, normalized_name = ?, type = ?, status = ?, updated_at = ? WHERE id = ?')->execute([$fullName, $normalizedName, $type, $status, $now, $guestId]);
    $pdo->prepare('DELETE FROM duplicate_candidates WHERE incoming_guest_id = ? OR existing_guest_id = ?')->execute([$guestId, $guestId]);
    $matches = possibleMatches($pdo, $guest['event_id'], $guestId, $fullName);
    return ['ok' => true, 'guest' => mapGuest(getGuest($pdo, $guestId)), 'duplicateCandidates' => $matches];
}

function buildDashboard(PDO $pdo, ?array $user = null): array
{
    $event = getEvent($pdo);
    $guests = array_map('mapGuest', $pdo->query('SELECT * FROM guests ORDER BY full_name ASC')->fetchAll());
    $confirmations = array_map('mapConfirmation', $pdo->query('SELECT * FROM confirmations ORDER BY created_at DESC')->fetchAll());
    $duplicates = $pdo->query("SELECT * FROM duplicate_candidates WHERE status = 'pending' ORDER BY created_at DESC")->fetchAll();
    $confirmed = array_values(array_filter($guests, fn ($guest) => $guest['status'] === 'confirmed'));
    $declined = array_values(array_filter($guests, fn ($guest) => $guest['status'] === 'declined'));
    $adults = array_values(array_filter($confirmed, fn ($guest) => $guest['type'] !== 'child'));
    $children = array_values(array_filter($confirmed, fn ($guest) => $guest['type'] === 'child'));

    return [
        'event' => $event,
        'currentUser' => $user,
        'permissions' => [
            'canManage' => (bool) $user,
            'canViewSettings' => isOwner($user),
            'canViewUsers' => isOwner($user),
        ],
        'totals' => [
            'confirmations' => count($confirmations),
            'confirmedGuests' => count($confirmed),
            'confirmedAdults' => count($adults),
            'confirmedChildren' => count($children),
            'declinedGuests' => count($declined),
            'possibleDuplicates' => count($duplicates),
        ],
        'confirmations' => $confirmations,
        'guests' => $guests,
        'duplicateCandidates' => isOwner($user) ? array_map('mapDuplicate', $duplicates) : [],
    ];
}

function mapGuest(array $guest): array
{
    return [
        'id' => $guest['id'],
        'eventId' => $guest['event_id'],
        'fullName' => $guest['full_name'],
        'normalizedName' => $guest['normalized_name'],
        'type' => $guest['type'],
        'responsibleName' => $guest['responsible_name'],
        'responsiblePhone' => $guest['responsible_phone'],
        'responsibleEmail' => $guest['responsible_email'],
        'status' => $guest['status'],
        'createdAt' => $guest['created_at'],
        'updatedAt' => $guest['updated_at'],
    ];
}

function mapConfirmation(array $confirmation): array
{
    return [
        'id' => $confirmation['id'],
        'eventId' => $confirmation['event_id'],
        'responsibleName' => $confirmation['responsible_name'],
        'responsiblePhone' => $confirmation['responsible_phone'],
        'responsibleEmail' => $confirmation['responsible_email'],
        'willAttend' => (bool) $confirmation['will_attend'],
        'createdAt' => $confirmation['created_at'],
        'updatedAt' => $confirmation['updated_at'],
    ];
}

function mapDuplicate(array $duplicate): array
{
    return [
        'id' => $duplicate['id'],
        'eventId' => $duplicate['event_id'],
        'status' => $duplicate['status'],
        'incomingGuestId' => $duplicate['incoming_guest_id'],
        'existingGuestId' => $duplicate['existing_guest_id'],
        'incomingName' => $duplicate['incoming_name'],
        'existingName' => $duplicate['existing_name'],
        'score' => (float) $duplicate['score'],
        'createdAt' => $duplicate['created_at'],
        'resolvedAt' => $duplicate['resolved_at'],
    ];
}

function exportPdf(PDO $pdo, ?array $user): void
{
    $dashboard = buildDashboard($pdo, $user);
    $event = $dashboard['event'];
    $guests = $dashboard['guests'];
    $totals = $dashboard['totals'];
    $guestPages = array_chunk($guests ?: [null], 28);
    $objects = [
        1 => '<< /Type /Catalog /Pages 2 0 R >>',
        2 => '',
        3 => '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    ];
    $pageReferences = [];
    $generatedAt = (new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo')))->format('d/m/Y H:i');

    foreach ($guestPages as $pageIndex => $pageGuests) {
        $pageId = 4 + ($pageIndex * 2);
        $contentId = $pageId + 1;
        $pageReferences[] = $pageId . ' 0 R';
        $commands = "0.02 0.36 0.48 rg\n";
        $commands .= pdfTextCommand(42, 798, 'Relatório de confirmações', 19);
        $commands .= "0.12 0.16 0.18 rg\n";
        $commands .= pdfTextCommand(42, 778, fitPdfText($event['title'], 76), 10);
        $commands .= pdfTextCommand(42, 761, 'Data: ' . $event['dateText'] . '   Horário: ' . $event['timeText'], 9);
        $commands .= pdfTextCommand(42, 745, 'Gerado em ' . $generatedAt, 8);
        $commands .= pdfTextCommand(42, 721, 'Confirmações: ' . $totals['confirmations'] . '   Presentes: ' . $totals['confirmedGuests'] . '   Adultos: ' . $totals['confirmedAdults'], 9);
        $commands .= pdfTextCommand(42, 706, 'Crianças: ' . $totals['confirmedChildren'] . '   Não comparecem: ' . $totals['declinedGuests'], 9);
        $commands .= "0.04 0.67 0.77 RG 0.8 w 42 694 m 553 694 l S\n";
        $commands .= "0.02 0.36 0.48 rg\n";
        $commands .= pdfTextCommand(42, 677, 'Convidado', 8);
        $commands .= pdfTextCommand(210, 677, 'Tipo', 8);
        $commands .= pdfTextCommand(252, 677, 'Responsável', 8);
        $commands .= pdfTextCommand(383, 677, 'E-mail', 8);
        $commands .= pdfTextCommand(505, 677, 'Status', 8);
        $commands .= "0.04 0.67 0.77 RG 0.5 w 42 670 m 553 670 l S\n";
        $commands .= "0.12 0.16 0.18 rg\n";

        if ($pageGuests === [null]) {
            $commands .= pdfTextCommand(42, 650, 'Nenhum convidado cadastrado.', 9);
        } else {
            foreach ($pageGuests as $guestIndex => $guest) {
                $y = 650 - ($guestIndex * 21);
                $type = $guest['type'] === 'child' ? 'Criança' : 'Adulto';
                $status = $guest['status'] === 'declined' ? 'Não vai' : 'Confirmado';
                $commands .= pdfTextCommand(42, $y, fitPdfText($guest['fullName'], 29), 8);
                $commands .= pdfTextCommand(210, $y, $type, 8);
                $commands .= pdfTextCommand(252, $y, fitPdfText($guest['responsibleName'], 21), 8);
                $commands .= pdfTextCommand(383, $y, fitPdfText($guest['responsibleEmail'], 19), 7);
                $commands .= pdfTextCommand(505, $y, $status, 7);
                $commands .= "0.86 0.94 0.96 RG 0.25 w 42 " . ($y - 7) . " m 553 " . ($y - 7) . " l S\n";
                $commands .= "0.12 0.16 0.18 rg\n";
            }
        }

        $commands .= "0.35 0.39 0.41 rg\n";
        $commands .= pdfTextCommand(500, 28, 'Página ' . ($pageIndex + 1) . ' de ' . count($guestPages), 8);
        $objects[$pageId] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ' . $contentId . ' 0 R >>';
        $objects[$contentId] = "<< /Length " . strlen($commands) . " >>\nstream\n" . $commands . "endstream";
    }

    $objects[2] = '<< /Type /Pages /Kids [' . implode(' ', $pageReferences) . '] /Count ' . count($pageReferences) . ' >>';
    ksort($objects);

    $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    $offsets = [0];
    foreach ($objects as $objectId => $objectBody) {
        $offsets[$objectId] = strlen($pdf);
        $pdf .= $objectId . " 0 obj\n" . $objectBody . "\nendobj\n";
    }

    $crossReferenceOffset = strlen($pdf);
    $objectCount = count($objects) + 1;
    $pdf .= "xref\n0 " . $objectCount . "\n0000000000 65535 f \n";
    for ($objectId = 1; $objectId < $objectCount; $objectId++) {
        $pdf .= sprintf('%010d 00000 n ', $offsets[$objectId]) . "\n";
    }
    $pdf .= "trailer\n<< /Size " . $objectCount . " /Root 1 0 R >>\nstartxref\n" . $crossReferenceOffset . "\n%%EOF";

    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="relatorio-confirmacoes.pdf"');
    header('Content-Length: ' . strlen($pdf));
    echo $pdf;
    exit;
}

function pdfTextCommand(int $x, int $y, string $text, int $fontSize): string
{
    $encoded = iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $text);
    $hexText = strtoupper(bin2hex($encoded !== false ? $encoded : $text));
    return 'BT /F1 ' . $fontSize . ' Tf 1 0 0 1 ' . $x . ' ' . $y . ' Tm <' . $hexText . "> Tj ET\n";
}

function fitPdfText(string $text, int $maxCharacters): string
{
    if (mb_strlen($text, 'UTF-8') <= $maxCharacters) return $text;
    return mb_substr($text, 0, $maxCharacters - 3, 'UTF-8') . '...';
}
