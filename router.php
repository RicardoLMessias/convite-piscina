<?php

declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if (str_starts_with($path, '/api/')) {
    require __DIR__ . '/api/index.php';
    exit;
}

if ($path === '/admin' || $path === '/admin/') {
    require __DIR__ . '/admin.html';
    exit;
}

$filePath = __DIR__ . $path;
if ($path !== '/' && is_file($filePath)) {
    return false;
}

if ($path === '/') {
    readfile(__DIR__ . '/index.html');
    exit;
}

http_response_code(404);
echo 'Not Found';
