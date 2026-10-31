function historicalPublic(a) { const b = a.publication_basis; return !!b && b.kind === 'native_archive' && /^[a-f0-9]{64}$/.test(b.manifest_sha256) && /^[a-f0-9]{64}$/.test(b.record_sha256) && b.record_key === a.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug); }
function declaredPublic(a) { return a.publication_basis ? historicalPublic(a) && a.approved === undefined : a.approved === true; }
// The same identity rule is used in preview, build and production. A missing
// optional environment binding selects the configured website, never a default tenant.
export function selectConfiguredSiteIdentity(input) {
    const origin = new URL(input.canonical_origin);
    if (origin.protocol !== 'https:' || origin.origin !== input.canonical_origin || !Array.isArray(input.sites) || !input.sites.length)
        throw Error('invalid_site_identity');
    const matches = input.sites.filter(s => s.canonical_origin === input.canonical_origin);
    if (matches.length !== 1 || typeof matches[0].site_id !== 'string' || !matches[0].site_id || input.sites.filter(s => s.site_id === matches[0].site_id).length !== 1)
        throw Error('invalid_site_identity');
    const declared = input.environment_site_id;
    if (declared !== undefined && declared !== null && declared !== '' && declared !== matches[0].site_id)
        throw Error('site_identity_mismatch');
    return { ...matches[0] };
}
// Native websites expose only their complete public metadata, never private
// content or credentials. The count must come from the authoritative own-site
// public selection; it is not inferred from one selected detail or one page.
export function publicMetadataInventory(input) {
    if (!/^[a-f0-9]{40}$/.test(input.source_commit) || !/^[a-f0-9]{64}$/.test(input.rules_fingerprint))
        throw Error('invalid_site_inventory_binding');
    const at = Date.parse(input.captured_at);
    if (!Number.isFinite(at))
        throw Error('invalid_site_inventory_time');
    const audit = auditSiteMetadata({ ...input, now: input.captured_at });
    const articles = input.articles.filter(a => a.site_id === input.site_id && declaredPublic(a) && a.visibility === 'public' && Number.isFinite(Date.parse(a.published_at)) && Date.parse(a.published_at) <= at).map(a => ({ id: a.id, site_id: a.site_id, slug: a.slug, canonical_url: a.canonical_url, published_at: a.published_at, ...(a.publication_basis ? { publication_basis: { kind: a.publication_basis.kind, manifest_sha256: a.publication_basis.manifest_sha256, record_sha256: a.publication_basis.record_sha256, record_key: a.publication_basis.record_key } } : { approved: true }), visibility: 'public', title: a.title, seo_title: a.seo_title, meta_description: a.meta_description }));
    return { contract: articles.some(a => 'publication_basis' in a) ? 'growth_public_metadata_v2' : 'growth_public_metadata_v1', site_id: input.site_id, canonical_origin: input.canonical_origin, source_commit: input.source_commit, rules_fingerprint: input.rules_fingerprint, captured_at: input.captured_at, complete: audit.inventory_complete, expected_count: input.expected_count, articles };
}
export function auditSiteMetadata(inventory, policy = { title_collision: 'report_only', duplicate_descriptions: 'warn' }) {
    const origin = new URL(inventory.canonical_origin), at = Date.parse(inventory.now);
    if (origin.protocol !== 'https:' || origin.origin !== inventory.canonical_origin || !inventory.site_id || !Number.isFinite(at) || typeof inventory.complete !== 'boolean' || !Number.isSafeInteger(inventory.expected_count) || inventory.expected_count < 0 || inventory.expected_count > 10000 || !Array.isArray(inventory.articles) || inventory.articles.length > 10000 || !policy || Object.keys(policy).sort().join(',') !== 'duplicate_descriptions,title_collision' || !['report_only', 'approved_heading'].includes(policy.title_collision) || !['warn', 'block'].includes(policy.duplicate_descriptions))
        throw Error('invalid_site_metadata_policy');
    const normalize = (s) => s.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US'), ids = new Set(), urls = new Set();
    const articles = inventory.articles.filter(a => a.site_id === inventory.site_id && declaredPublic(a) && a.visibility === 'public' && Number.isFinite(Date.parse(a.published_at)) && Date.parse(a.published_at) <= at);
    for (const a of articles) {
        const u = new URL(a.canonical_url);
        if (u.origin !== origin.origin || u.username || u.password || u.search || u.hash || typeof a.id !== 'string' || !a.id || ids.has(a.id) || urls.has(a.canonical_url) || typeof a.title !== 'string' || a.title.length > 180 || typeof a.seo_title !== 'string' || a.seo_title.length > 180 || typeof a.meta_description !== 'string' || a.meta_description.length > 300)
            throw Error('invalid_site_metadata_inventory');
        ids.add(a.id);
        urls.add(a.canonical_url);
    }
    const complete = inventory.complete && articles.length === inventory.expected_count;
    const groups = (values) => { const map = new Map(); for (const x of values) {
        const key = normalize(x.value);
        if (key)
            map.set(key, [...(map.get(key) || []), x.id]);
    } return [...map.values()].filter(g => g.length > 1); };
    const sourceDuplicates = groups(articles.map(a => ({ id: a.id, value: a.seo_title }))), colliding = new Set(sourceDuplicates.flat()), issues = [];
    if (!complete)
        issues.push({ code: 'public_inventory_incomplete', article_ids: [], severity: 'blocker' });
    // An explicitly selected fallback reuses the exact already-approved H1. It
    // changes presentation metadata only, never stored versions, body or canonical.
    const metadata = articles.map(a => { const fallback = complete && policy.title_collision === 'approved_heading' && colliding.has(a.id) && !!normalize(a.title); return { id: a.id, canonical_url: a.canonical_url, source_title: a.seo_title, title: fallback ? a.title : a.seo_title, description: a.meta_description, title_source: fallback ? 'approved_heading' : 'seo_title' }; });
    for (const article_ids of sourceDuplicates)
        issues.push({ code: 'duplicate_source_seo_title', article_ids, severity: 'warning' });
    for (const article_ids of groups(metadata.map(a => ({ id: a.id, value: a.title }))))
        issues.push({ code: 'duplicate_effective_seo_title', article_ids, severity: 'blocker' });
    for (const article_ids of groups(metadata.map(a => ({ id: a.id, value: a.description }))))
        issues.push({ code: 'duplicate_meta_description', article_ids, severity: policy.duplicate_descriptions === 'block' ? 'blocker' : 'warning' });
    for (const a of metadata) {
        if (!normalize(a.title))
            issues.push({ code: 'missing_seo_title', article_ids: [a.id], severity: 'blocker' });
        if (!normalize(a.description))
            issues.push({ code: 'missing_meta_description', article_ids: [a.id], severity: 'blocker' });
    }
    return { inventory_complete: complete, public_count: articles.length, ready: !issues.some(x => x.severity === 'blocker'), metadata, issues, publication_changed: false };
}
const escape = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Callers supply the exact tenant's public inventory, not all tenants or private draft routes.
// This portable resolver is shared by raw HTML and browser adapters; it never writes content.
export function createSiteLinkResolver(policy) {
    const origin = new URL(policy.canonical_origin), now = Date.parse(policy.now);
    const clean = (raw) => {
        if (typeof raw !== 'string' || !raw || raw !== raw.trim() || !/^(?:\/|https?:\/\/)/.test(raw) || /[\\\u0000-\u0020\u007f]/.test(raw) || raw.startsWith('//') || /(?:^|\/)\.{1,2}(?:\/|$)/.test(raw) || /%(?![a-f0-9]{2})|%(?:2f|5c|2e|0[0-9a-f]|1[0-9a-f]|7f)/i.test(raw))
            return null;
        try {
            const u = new URL(raw, origin);
            if (u.username || u.password || !['https:', 'http:'].includes(u.protocol))
                return null;
            for (const k of [...u.searchParams.keys()])
                if (/^(utm_\w+|gclid|fbclid|msclkid)$/i.test(k))
                    u.searchParams.delete(k);
            return u;
        }
        catch {
            return null;
        }
    };
    if (!policy.site_id || origin.protocol !== 'https:' || origin.origin !== policy.canonical_origin || !Number.isFinite(now))
        throw Error('invalid_site_link_policy');
    const localPath = (raw) => { const u = clean(raw); if (!u || !raw.startsWith('/') || u.origin !== origin.origin || u.search || u.hash || u.pathname !== raw)
        throw Error('invalid_site_link_policy'); return u.pathname; };
    const paths = new Set(policy.valid_paths.map(localPath)), published = new Map(), slugs = new Map(), nonPublic = new Set();
    for (const a of policy.articles) {
        if (a.site_id !== policy.site_id || !declaredPublic(a) || a.visibility !== 'public' || !Number.isFinite(Date.parse(a.published_at)) || Date.parse(a.published_at) > now) {
            const u = clean(a.canonical_url);
            if (u && u.origin === origin.origin) {
                nonPublic.add(u.pathname);
                if (u.pathname !== '/')
                    nonPublic.add(u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname + '/');
            }
            if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug)) {
                nonPublic.add('/' + a.slug);
                nonPublic.add('/' + a.slug + '/');
            }
            continue;
        }
        const u = clean(a.canonical_url);
        if (!u || u.origin !== origin.origin || u.search || u.hash || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug))
            throw Error('invalid_site_link_policy');
        if (slugs.has(a.slug) && slugs.get(a.slug) !== u.pathname || published.has(u.pathname) && published.get(u.pathname) !== a.slug)
            throw Error('invalid_site_link_policy');
        published.set(u.pathname, a.slug);
        slugs.set(a.slug, u.pathname);
    }
    const known = (p) => paths.has(p) || published.has(p);
    const aliases = new Map(Object.entries(policy.aliases).map(([from, to]) => { localPath(from); localPath(to); if (!known(to) || known(from) && from !== to)
        throw Error('invalid_site_link_policy'); return [from, to]; }));
    const intents = new Map(Object.entries(policy.intent_paths).map(([intent, to]) => { localPath(to); if (!intent || !known(to))
        throw Error('invalid_site_link_policy'); return [intent, to]; }));
    const protocols = [...(policy.external_protocols || ['https:'])];
    if (protocols.some(p => !['https:', 'http:'].includes(p)))
        throw Error('invalid_site_link_policy');
    return (raw, kind = 'internal', intent) => {
        const u = clean(raw);
        if (!u)
            return { url: null, reason: 'unsafe_link' };
        if (u.origin !== origin.origin)
            return kind === 'source' && protocols.includes(u.protocol) ? { url: u.href, reason: 'external_source' } : { url: null, reason: 'foreign_internal_link' };
        if (published.has(u.pathname))
            return { url: u.pathname + u.search + u.hash, reason: 'published_article' };
        if (nonPublic.has(u.pathname))
            return { url: null, reason: 'non_public_target' };
        if (paths.has(u.pathname))
            return { url: u.pathname + u.search + u.hash, reason: 'valid_local_path' };
        // Normalize only an exact own published canonical's optional final slash.
        // This never guesses an article prefix or admits a private/future path.
        const alternate = u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname + '/';
        if (published.has(alternate))
            return { url: alternate + u.search + u.hash, reason: 'published_article' };
        // Only an exact slug in the due/approved public inventory can resolve a historic /slug.
        const article = slugs.get(u.pathname.replace(/^\//, '').replace(/\/$/, ''));
        if (article)
            return { url: article + u.search + u.hash, reason: 'exact_article_identity' };
        const alias = aliases.get(u.pathname);
        if (alias)
            return { url: alias + u.search + u.hash, reason: 'configured_alias' };
        // Explicit intent IDs only: never infer insurance/booking routes from article titles.
        const target = intent && intents.get(intent);
        if (target)
            return { url: target, reason: 'configured_intent' };
        return { url: null, reason: 'unknown_local_target' };
    };
}
export function contentLink(raw) { try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password)
        return null;
    for (const k of [...u.searchParams.keys()])
        if (/^(utm_\w+|gclid|fbclid|msclkid)$/i.test(k))
            u.searchParams.delete(k);
    return u.toString();
}
catch {
    return null;
} }
function inline(raw, resolver) { const re = /\[([^\]\n]+)\]\(([^\s)]+)\)/g; let s = '', start = 0, m; while ((m = re.exec(raw))) {
    s += escape(raw.slice(start, m.index));
    const url = resolver ? resolver(m[2], 'source').url : contentLink(m[2]);
    s += url ? '<a href="' + escape(url) + '" rel="noopener noreferrer">' + escape(m[1]) + '</a>' : escape(resolver ? m[1] : m[0]);
    start = re.lastIndex;
} return s + escape(raw.slice(start)); }
export function renderArticleBody(body, resolver) {
    let out = '', paragraph = [], list = [], table = [];
    const flush = () => { if (paragraph.length) {
        out += '<p>' + inline(paragraph.join(' '), resolver) + '</p>';
        paragraph = [];
    } if (list.length) {
        out += '<ul>' + list.map(s => '<li>' + inline(s, resolver) + '</li>').join('') + '</ul>';
        list = [];
    } if (table.length) {
        const header = table.shift();
        out += '<table><thead><tr>' + header.map(s => '<th scope="col">' + inline(s, resolver) + '</th>').join('') + '</tr></thead><tbody>' + table.filter(row => !row.every(s => /^:?-{3,}:?$/.test(s))).map(row => '<tr>' + header.map((_, i) => '<td>' + inline(row[i] || '', resolver) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
        table = [];
    } };
    for (const line of body.replace(/\r/g, '').split('\n')) {
        if (!line.trim()) {
            flush();
            continue;
        }
        const heading = line.match(/^(#{1,5})\s+(.+)$/);
        if (heading) {
            flush();
            const level = Math.min(6, heading[1].length + 1);
            out += '<h' + level + '>' + inline(heading[2], resolver) + '</h' + level + '>';
            continue;
        }
        const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
        if (bullet) {
            if (paragraph.length || table.length)
                flush();
            list.push(bullet[1]);
            continue;
        }
        if (/^\s*\|.*\|\s*$/.test(line)) {
            if (paragraph.length || list.length)
                flush();
            table.push(line.trim().slice(1, -1).split('|').map(s => s.trim()));
            continue;
        }
        if (list.length || table.length)
            flush();
        paragraph.push(line.trim());
    }
    flush();
    return out;
}
function publicImageUrl(raw) { try {
    const u = new URL(raw);
    return u.protocol === 'https:' && !u.port && !u.username && !u.password && !u.search && !u.hash && (/^\/api\/(?:growth-)?content\/[a-f0-9-]{36}\/articles\/[a-z0-9]+(?:-[a-z0-9]+)*\/media\/[a-f0-9]{64}\/(?:hero|author|inline-[0-2])\.png$/.test(u.pathname) || /^\/article-media\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-f0-9]{64}\/(?:hero|author|inline-[0-2])\.png$/.test(u.pathname) || /^\/delegated-article-media\/[a-f0-9-]{36}\/[a-f0-9]{64}\/(?:hero|author|inline-[0-2])\.png$/.test(u.pathname));
}
catch {
    return false;
} }
export function articleImage(image, photo = false) { if (!image || !(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image.image) || publicImageUrl(image.image)) || image.image.length > 270000)
    return ''; return '<figure class="article-image"><img' + (photo ? ' class="article-author-photo"' : '') + ' src="' + escape(image.image) + '" alt="' + escape(image.alt) + '" width="' + image.width + '" height="' + image.height + '" loading="lazy">' + (image.credit ? '<figcaption>' + escape(image.credit) + '</figcaption>' : '') + '</figure>'; }
export function renderArticleContent(body, media, resolver) { let html = renderArticleBody(body, resolver); if (media) {
    const positions = [...html.matchAll(/<h[2-4]>/g)].map(m => m.index), insertions = media.inline.map(image => ({ at: image.after_heading === 0 ? 0 : positions[image.after_heading || 0] ?? html.length, image })).sort((a, b) => b.at - a.at);
    for (const x of insertions)
        html = html.slice(0, x.at) + articleImage(x.image) + html.slice(x.at);
    html = articleImage(media.hero) + html;
} return html; }
export function renderOriginalArticleElements(elements, body, resolver) {
    if (!elements?.length)
        return '';
    const normalize = (s) => s.replace(/\s+/g, ' ').trim(), seen = new Set(), existing = normalize(body);
    return elements.map(element => {
        const signature = normalize(element.title) + ' ' + normalize(element.content);
        if (seen.has(signature) || existing.includes(signature))
            return '';
        seen.add(signature);
        // Types are source metadata, not permission to invent steps, expertise or clinical review.
        return '<section class="article-original-element"><h2>' + escape(element.title) + '</h2>' + renderArticleBody(element.content, resolver) + '</section>';
    }).join('');
}
export function articlePublicBody(a, resolver) {
    const sources = a.sources.map(s => { const link = resolver ? resolver(s.url, 'source').url : contentLink(s.url); return '<li>' + (link ? '<a href="' + escape(link) + '" rel="noopener noreferrer">' + escape(s.title) + '</a>' : escape(s.title)) + ' — ' + escape(s.publisher) + '<p>' + escape(s.claim) + '</p></li>'; }).join('');
    const author = a.author;
    const authorLink = resolver ? resolver(author.url, 'source').url : contentLink(author.url), cta = resolver ? resolver(a.cta_url, 'internal').url : contentLink(a.cta_url);
    const links = a.internal_links.map(l => { const url = resolver ? resolver(l.url, 'internal').url : contentLink(l.url); return url ? '<li><a href="' + escape(url) + '">' + escape(l.label) + '</a></li>' : resolver ? '<li>' + escape(l.label) + '</li>' : ''; }).join('');
    return renderArticleContent(a.body, a.media, resolver) + renderOriginalArticleElements(a.original_elements, a.body, resolver) + '<section aria-label="Sources"><h2>Sources</h2><ol>' + sources + '</ol></section><section aria-label="About the author"><h2>About the author</h2>' + articleImage(a.media?.author_photo, true) + '<p>' + (authorLink ? '<a href="' + escape(authorLink) + '">' + escape(author.name) + '</a>' : escape(author.name)) + (author.role ? ' · ' + escape(author.role) : '') + '</p><p>' + escape(author.bio) + '</p></section>' + (links ? '<nav aria-label="Related resources"><ul>' + links + '</ul></nav>' : '') + (cta ? '<p><a href="' + escape(cta) + '">' + escape(a.cta_label) + '</a></p>' : '');
}
export function articleMarkup(a, resolver) { return '<article data-growth-article="' + escape(a.id + ':' + a.version + ':' + a.fingerprint) + '"><header><h1>' + escape(a.title) + '</h1><p>' + escape(a.excerpt) + '</p><time datetime="' + escape(a.published_at) + '">' + escape(a.published_at.slice(0, 10)) + '</time></header><div data-growth-body>' + articlePublicBody(a, resolver) + '</div></article>'; }
export function createSiteArticleRenderer(policy) {
    const resolve = createSiteLinkResolver(policy);
    const eligible = new Set(policy.articles.filter(p => p.site_id === policy.site_id && p.approved === true && p.visibility === 'public' && Date.parse(p.published_at) <= Date.parse(policy.now)).map(p => p.slug + '\n' + p.canonical_url));
    return { resolve, render(a) {
            const own = resolve(a.canonical_url);
            if (own.reason !== 'published_article' || !eligible.has(a.slug + '\n' + a.canonical_url))
                throw Error('article_not_in_public_site_inventory');
            const warnings = new Map();
            const tracked = (url, kind, intent) => { const result = resolve(url, kind, intent); if (!result.url && url)
                warnings.set(kind + ':' + url, { url, reason: result.reason }); return result; };
            const body = articlePublicBody(a, tracked), markup = articleMarkup(a, tracked);
            return { body, markup, warnings: [...warnings.values()] };
        } };
}
export function createCompleteSiteArticleRenderer(policy, inventory) {
    const at = Date.parse(policy.now), publicRows = policy.articles.filter(a => a.site_id === policy.site_id && a.approved === true && a.visibility === 'public' && Number.isFinite(Date.parse(a.published_at)) && Date.parse(a.published_at) <= at);
    if (inventory?.complete !== true || !Number.isSafeInteger(inventory.expected_count) || inventory.expected_count < 0 || inventory.expected_count > 10000 || publicRows.length !== inventory.expected_count || new Set(publicRows.map(a => a.canonical_url)).size !== publicRows.length || new Set(publicRows.map(a => a.slug)).size !== publicRows.length)
        throw Error('site_public_inventory_required');
    return createSiteArticleRenderer(policy);
}
// Historical structured archives keep their native renderer and immutable data.
// This hook guards every URL without manufacturing workflow IDs or approvals.
export function createNativeArchiveLinkGuard(policy, inventory) {
    if (inventory?.complete !== true || !Array.isArray(inventory.manifests) || !inventory.manifests.length || inventory.manifests.length > 20 || !Number.isSafeInteger(inventory.expected_count) || inventory.expected_count < 0 || inventory.expected_count > 10000)
        throw Error('site_public_inventory_required');
    const pinned = new Map();
    for (const manifest of inventory.manifests) {
        if (!/^[a-f0-9]{64}$/.test(manifest.sha256) || !Array.isArray(manifest.records))
            throw Error('site_archive_binding_mismatch');
        for (const row of manifest.records) {
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) || !/^[a-f0-9]{64}$/.test(row.sha256) || pinned.has(row.slug))
                throw Error('site_archive_binding_mismatch');
            pinned.set(row.slug, { canonical: row.canonical, sha256: row.sha256, manifest: manifest.sha256 });
        }
    }
    if (pinned.size !== inventory.expected_count || policy.articles.length !== pinned.size || new Set(policy.articles.map(a => a.slug)).size !== pinned.size)
        throw Error('site_public_inventory_required');
    for (const a of policy.articles) {
        const row = pinned.get(a.slug), basis = a.publication_basis;
        if (a.site_id !== policy.site_id || a.approved !== undefined || !historicalPublic(a) || a.visibility !== 'public' || !Number.isFinite(Date.parse(a.published_at)) || Date.parse(a.published_at) > Date.parse(policy.now) || !row || row.canonical !== a.canonical_url || row.sha256 !== basis.record_sha256 || row.manifest !== basis.manifest_sha256)
            throw Error('site_archive_binding_mismatch');
    }
    const resolve = createSiteLinkResolver(policy);
    return { resolve, assertSelection(selected) { const row = pinned.get(selected.slug); if (!row || row.canonical !== selected.canonical_url || row.sha256 !== selected.record_sha256)
            throw Error('site_archive_binding_mismatch'); return { publication_basis: 'historical_public_archive', record_key: selected.slug, record_sha256: row.sha256 }; } };
}
export function articleJsonLd(a) { const v = { "@context": "https://schema.org", "@type": "BlogPosting", headline: a.title, description: a.meta_description, datePublished: a.published_at, dateModified: a.published_at, mainEntityOfPage: a.canonical_url, author: { "@type": "Person", name: a.author.name, ...(contentLink(a.author.url) ? { url: contentLink(a.author.url) } : {}) } }; return JSON.stringify(v).replace(/</g, '\\u003c'); }
export async function readArticleFeed({ endpoint, canonicalOrigin, slug, limit = 9, offset = 0, transport = fetch, expectedSiteId, requireAttestation = false }) {
    const url = new URL(endpoint), origin = new URL(canonicalOrigin);
    if (url.protocol !== 'https:' || url.username || url.password || origin.protocol !== 'https:' || origin.origin !== canonicalOrigin || !Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 10000)
        throw Error('invalid_content_configuration');
    if (slug !== undefined) {
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
            return { available: true, articles: [], total: 0 };
        url.pathname += '/' + slug;
    }
    else {
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('offset', String(offset));
    }
    try {
        const response = await transport(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
        if (response.status === 410)
            return { available: false, articles: [], total: 0 };
        if (response.status === 404 && slug !== undefined)
            return { available: true, articles: [], total: 0 };
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json') || Number(response.headers.get('content-length') || 0) > 10000000)
            throw Error();
        const reader = response.body?.getReader();
        if (!reader)
            throw Error();
        let size = 0;
        const chunks = [];
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                size += value.length;
                if (size > 10000000)
                    throw Error();
                chunks.push(value);
            }
        }
        catch {
            await reader.cancel().catch(() => { });
            throw Error();
        }
        const joined = new Uint8Array(size);
        let cursor = 0;
        for (const chunk of chunks) {
            joined.set(chunk, cursor);
            cursor += chunk.length;
        }
        const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined));
        if (value.canonical_origin !== canonicalOrigin || !Array.isArray(value.articles) || value.articles.length > 100 || value.total !== undefined && (!Number.isSafeInteger(value.total) || value.total < 0))
            throw Error();
        if (expectedSiteId !== undefined && value.site_id !== expectedSiteId || requireAttestation && (!expectedSiteId || value.site_id !== expectedSiteId))
            throw Error();
        const string = (x, max) => typeof x === 'string' && x.length <= max;
        for (const a of value.articles) {
            if (!a || !string(a.id, 36) || !/^[a-f0-9-]{36}$/.test(a.id) || !string(a.title, 180) || !string(a.body, 60000) || !string(a.slug, 100) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug) || !string(a.excerpt, 500) || !string(a.seo_title, 180) || !string(a.meta_description, 300) || !string(a.cta_label, 120) || !string(a.cta_url, 2000) || a.cta_url && !contentLink(a.cta_url) || !string(a.published_at, 40) || !Number.isFinite(Date.parse(a.published_at)) || !a.author || !string(a.author.name, 120) || !string(a.author.role, 160) || !string(a.author.bio, 1000) || !string(a.author.url, 2000) || !Array.isArray(a.sources) || a.sources.length > 12 || !Array.isArray(a.internal_links) || a.internal_links.length > 10 || !string(a.fingerprint, 64) || !/^[a-f0-9]{64}$/.test(a.fingerprint) || !Number.isSafeInteger(a.version) || a.version < 1 || new URL(a.canonical_url).origin !== canonicalOrigin || new URL(a.canonical_url).username || new URL(a.canonical_url).password || slug !== undefined && a.slug !== slug)
                throw Error();
            if (a.original_elements !== undefined && (!Array.isArray(a.original_elements) || a.original_elements.length > 12 || a.original_elements.some((e) => !e || !string(e.type, 80) || !e.type.trim() || !string(e.title, 240) || !e.title.trim() || !string(e.content, 12000) || !e.content.trim())))
                throw Error();
            if (requireAttestation || ['site_id', 'approved', 'visibility', 'approved_version', 'approved_fingerprint'].some(k => Object.hasOwn(a, k))) {
                if (a.site_id !== value.site_id || expectedSiteId !== undefined && a.site_id !== expectedSiteId || a.approved !== true || a.visibility !== 'public' || a.approved_version !== a.version || a.approved_fingerprint !== a.fingerprint || Date.parse(a.published_at) > Date.now())
                    throw Error();
            }
            if (a.media) {
                if (!Array.isArray(a.media.inline) || a.media.inline.length > 3)
                    throw Error();
                const images = [a.media.hero, a.media.author_photo, ...a.media.inline].filter(Boolean);
                if (!Array.isArray(a.media.inline) || a.media.inline.length > 3)
                    throw Error();
                for (const x of images)
                    if (!string(x.image, 270000) || !(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(x.image) || (publicImageUrl(x.image) && x.image.startsWith(endpoint + '/' + a.slug + '/media/' + a.fingerprint + '/'))) || !string(x.alt, 300) || !x.alt.trim() || !string(x.credit, 200) || !Number.isInteger(x.width) || x.width < 16 || x.width > 2400 || !Number.isInteger(x.height) || x.height < 16 || x.height > 2400)
                        throw Error();
                for (const x of a.media.inline)
                    if (!Number.isInteger(x.after_heading) || x.after_heading < 0 || x.after_heading > 12)
                        throw Error();
            }
            for (const s of a.sources)
                if (!string(s.title, 240) || !string(s.publisher, 160) || !string(s.claim, 800) || !string(s.url, 2000) || !contentLink(s.url))
                    throw Error();
            for (const l of a.internal_links)
                if (!string(l.label, 120) || !string(l.url, 2000) || !contentLink(l.url))
                    throw Error();
        }
        return { available: true, articles: value.articles, total: value.total ?? value.articles.length };
    }
    catch {
        return { available: false, articles: [], total: 0 };
    }
}
