import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const dist = join(process.cwd(), 'dist');
const shell = join(dist, 'index.html');

const serviceSlugs = [
  'limo-rentals',
  'party-limos',
  'wedding-limos',
  'prom-limos',
  'bachelor-bachelorette-limos',
  'birthday-limos',
  'corporate-transportation',
  'airport-transfers',
  'nights-out-events',
];

const routes = [
  'fleet',
  'services',
  ...serviceSlugs,
  'service-areas',
  'about',
  'gallery',
  'reviews',
  'faq',
  'contact',
  'book-now',
  'terms-conditions',
  'privacy-policy',
];

if (!existsSync(shell)) {
  throw new Error('Vite build shell not found.');
}

const { renderRoute, routes: renderedRoutes } = await import(pathToFileURL(join(process.cwd(), '.prerender/entry-server.js')).href);
const expectedRoutes = ['', ...routes].map((route) => route ? '/' + route : '/');
if (JSON.stringify([...renderedRoutes].sort()) !== JSON.stringify([...expectedRoutes].sort())) throw new Error('Prerender and sitemap routes differ.');
const template = readFileSync(shell, 'utf8');
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
for (const route of expectedRoutes) {
  const page = renderRoute(route);
  if ((page.html.match(/<h1(?:\s|>)/g) || []).length !== 1) throw new Error('Expected exactly one initial heading: ' + route);
  if (!template.includes('<div id="root"></div>') || !/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i.test(template)) throw new Error('Build template changed; stop before writing routes.');
  const metadata = '<link rel="canonical" href="' + escape(page.canonical) + '">\n' +
    '<meta property="og:type" content="website">\n<meta property="og:site_name" content="GTA Party Limos">\n' +
    '<meta property="og:title" content="' + escape(page.title) + '">\n' +
    '<meta property="og:description" content="' + escape(page.description) + '">\n' +
    '<meta property="og:url" content="' + escape(page.canonical) + '">\n' +
    '<script type="application/ld+json">' + JSON.stringify(page.organization).replace(/</g, '\\u003c') + '</script>\n';
  const html = template.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + escape(page.title) + '</title>')
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, '<meta name="description" content="' + escape(page.description) + '">')
    .replace('</head>', metadata + '</head>').replace('<div id="root"></div>', '<div id="root" data-prerender-path="' + escape(route) + '">' + page.html + '</div>');
  const routeShell = route === '/' ? shell : join(dist, route.slice(1), 'index.html');
  mkdirSync(dirname(routeShell), { recursive: true });writeFileSync(routeShell, html);
}
console.log('Prerendered ' + expectedRoutes.length + ' existing routes with initial content and exact canonical metadata.');

const sitemapRoutes = ['', ...routes];

writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapRoutes.map((route) => `  <url><loc>https://gtapartylimos.com/${route}${route ? '/' : ''}</loc></url>`).join('\n')}
</urlset>
`,
);

writeFileSync(
  join(dist, '.htaccess'),
  `DirectoryIndex index.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [L]
</IfModule>
`,
);

writeFileSync(
  join(dist, 'README.md'),
  `# GTA Party Limos

Premium lead-generation website for gtapartylimos.com.

Built with React 18, TypeScript, Vite 5, Tailwind CSS 3.4, lucide-react, generated luxury transportation imagery, clean static routes, and Web3Forms quote/contact submissions.
`,
);
