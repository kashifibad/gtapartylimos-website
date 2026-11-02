const SETTINGS = {"marker":"growth-seo:08c91b35f36ea92b77fd73ef","website":"https://gtapartylimos.com","routes":["https://gtapartylimos.com/limo-rentals/"],"manifest":"/growth-seo-overrides.json"};

const normalize = path => path.replace(/\/$/, '') || '/';
export function applyGrowthSeo(pathname) {
  const target = SETTINGS.routes.find(url => normalize(new URL(url).pathname) === normalize(pathname));
  if (!target || location.origin !== SETTINGS.website || normalize(location.pathname) !== normalize(pathname)) return () => {};
  let active = true, restore = () => {};
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 10000);
  fetch(SETTINGS.manifest, {credentials:'omit', cache:'no-store', redirect:'error', signal:abort.signal})
    .then(async response => {
      if (!response.ok || !/application\/json/i.test(response.headers.get('content-type') || '')) throw Error('metadata_unavailable');
      const content = await response.text();
      if (content.length > 131072) throw Error('metadata_unavailable');
      const value = JSON.parse(content), metadata = value.routes?.[target];
      const exact = (object, keys) => object && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).sort().join('|') === keys.sort().join('|');
      if (!exact(value,['version','marker','website','routes']) || value.version !== 1 || value.marker !== SETTINGS.marker || value.website !== SETTINGS.website || !exact(value.routes,SETTINGS.routes.slice())) throw Error('metadata_unavailable');
      const ordered = {};
      for (const url of SETTINGS.routes) {
        const entry = value.routes[url];
        if (!exact(entry,['canonical','title','description']) || entry.canonical !== url || typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > 180 || typeof entry.description !== 'string' || !entry.description.trim() || entry.description.length > 300) throw Error('metadata_unavailable');
        ordered[url] = {canonical:entry.canonical,title:entry.title,description:entry.description};
      }
      if (content !== JSON.stringify({version:1,marker:SETTINGS.marker,website:SETTINGS.website,routes:ordered},null,2)+'\n') throw Error('metadata_unavailable');
      if (!active || normalize(location.pathname) !== normalize(pathname)) return;
      const head = document.head;
      if (!head || head.querySelector('[data-growth-seo]')) return;
      const selectors = ['title','meta[name="description" i]','link[rel~="canonical" i]'];
      if (selectors.some(selector => head.querySelectorAll(selector).length > 1)) return;
      const originals = selectors.flatMap(selector => [...head.querySelectorAll(selector)].map(node=>({node,selector})));
      const slots = originals.map(({node,selector}) => {const slot = document.createComment(SETTINGS.marker);node.replaceWith(slot);return {node,slot,selector};});
      const title = document.createElement('title'), description = document.createElement('meta'), canonical = document.createElement('link');
      title.textContent = metadata.title;description.name = 'description';description.content = metadata.description;canonical.rel = 'canonical';canonical.href = metadata.canonical;
      const owned = [title,description,canonical];owned.forEach(node => {node.dataset.growthSeo = SETTINGS.marker;head.appendChild(node);});
      const exactOwned = owned.map(node=>node.outerHTML);
      restore = () => {
        // Remove only nodes still owned by this installation. Never delete a
        // later page effect's metadata or recreate nodes after another owner.
        owned.forEach((node,index) => {if(node.parentNode !== head || node.dataset.growthSeo !== SETTINGS.marker)return;if(node.outerHTML === exactOwned[index])node.remove();else delete node.dataset.growthSeo;});
        slots.forEach(({node,slot,selector}) => {if(slot.parentNode !== head)return;if(head.querySelector(selector))slot.remove();else slot.replaceWith(node);});
      };
    }).catch(() => {}).finally(() => clearTimeout(timer));
  return () => {active = false;clearTimeout(timer);abort.abort();restore();};
}
