import React from 'react';
import { renderToString } from 'react-dom/server';
import { App, routeMetadata, routeTitles } from './main';

export const routes = Object.keys(routeTitles);
export function renderRoute(path: string) {
  const metadata = routeMetadata(path);
  if (!metadata.known) throw new Error('Only existing public routes can be prerendered.');
  return {
    ...metadata,
    html: renderToString(<React.StrictMode><App initialPath={path} /></React.StrictMode>),
    organization: {
      '@context': 'https://schema.org', '@type': 'Organization',
      '@id': 'https://gtapartylimos.com/#organization', name: 'GTA Party Limos',
      url: 'https://gtapartylimos.com/', telephone: '+1-647-222-7300',
      email: 'info@GTAPartyLimos.com', logo: 'https://gtapartylimos.com/favicon.svg?v=2',
    },
  };
}
