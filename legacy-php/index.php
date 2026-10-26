<?php

declare(strict_types=1);

$articles = require __DIR__ . '/articles.php';
$path = rtrim(rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/'), '/') ?: '/';

if ($delay = (int) getenv('LEGACY_DELAY_MS')) {
    usleep($delay * 1000);
}
if (getenv('LEGACY_DOWN')) {
    http_response_code(503);
    header('Retry-After: 30');
    exit('Legacy system unavailable');
}

function find_article(array $articles, string $slug): ?array
{
    foreach ($articles as $a) {
        if ($a['slug'] === $slug) {
            return $a;
        }
    }
    return null;
}

function json(mixed $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES);
}

function field(array $a, string ...$keys): string
{
    foreach ($keys as $key) {
        if (isset($a[$key]) && trim((string) $a[$key]) !== '') {
            return (string) $a[$key];
        }
    }
    return '';
}

function page(string $title, string $content, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    $query = $_SERVER['QUERY_STRING'] ?? '';
    $host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? '';
    ?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title><?= e($title) ?> - Acme News</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; margin: 0; background: #f4f1ea; color: #222; }
  header { background: #2b3a55; color: #fff; padding: 12px 24px; font-size: 22px; }
  header a { color: #fff; text-decoration: none; }
  main { max-width: 720px; margin: 24px auto; padding: 0 16px; }
  a { color: #1a0dab; }
  .meta { color: #666; font-size: 14px; }
  footer { max-width: 720px; margin: 40px auto; padding: 12px 16px; border-top: 1px dashed #999; font: 12px monospace; color: #555; }
</style>
</head>
<body>
<header><a href="/articles">Acme News</a> <small>&middot; <a href="/about">About</a></small></header>
<main><?= $content ?></main>
<footer>
  Served by legacy PHP &middot; host: <?= e($host) ?>
  &middot; query: <?= $query === '' ? '(none)' : e($query) ?>
</footer>
</body>
</html>
<?php
}

if ($path === '/api/articles') {
    json($articles);
} elseif (preg_match('#^/api/articles/([^/]+)$#', $path, $m)) {
    $article = find_article($articles, $m[1]);
    $article ? json($article) : json(['error' => 'Article not found'], 404);
} elseif ($path === '/' || $path === '/articles') {
    $items = '';
    foreach ($articles as $a) {
        $items .= sprintf(
            '<li><a href="/articles/%s">%s</a> <span class="meta">%s</span></li>',
            e($a['slug']),
            e(field($a, 'title', 'headline')),
            e(field($a, 'published_at', 'pub_date', 'date')),
        );
    }
    page('Articles', "<h1>Articles</h1><ul>$items</ul>");
} elseif (preg_match('#^/articles/([^/]+)$#', $path, $m)) {
    $a = find_article($articles, $m[1]);
    if (!$a) {
        page('Not found', '<h1>Article not found</h1>', 404);
        return;
    }
    $paragraphs = preg_split('/\R\s*\R/', field($a, 'body', 'content'));
    page(field($a, 'title', 'headline'), sprintf(
        '<h1>%s</h1><p class="meta">By %s &middot; %s</p>%s<p><a href="/articles">&larr; All articles</a></p>',
        e(field($a, 'title', 'headline')),
        e(field($a, 'author', 'author_name') ?: 'Staff'),
        e(field($a, 'published_at', 'pub_date', 'date')),
        implode('', array_map(fn ($p) => '<p>' . e(trim($p)) . '</p>', $paragraphs)),
    ));
} elseif ($path === '/about') {
    page('About', '<h1>About Acme News</h1><p>This page has not been migrated and is still rendered by the legacy PHP application.</p>');
} else {
    page('Not found', '<h1>Page not found</h1>', 404);
}
