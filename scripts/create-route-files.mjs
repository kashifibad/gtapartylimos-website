import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

for (const route of routes) {
  const routeShell = join(dist, route, 'index.html');
  mkdirSync(dirname(routeShell), { recursive: true });
  copyFileSync(shell, routeShell);
}

const sitemapRoutes = ['', ...routes];

writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapRoutes.map((route) => `  <url><loc>https://gtapartylimos.com/${route}</loc></url>`).join('\n')}
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
