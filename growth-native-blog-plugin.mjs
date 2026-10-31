// Build only this new blog index; keep the existing application and all other output.
const config={"site_id":"cbc8f422-c35f-41e2-89cd-26a2dd8bb2a9","website":"https://gtapartylimos.com","index_path":"/blog/","folder":"blog"};
export default function growthNativeBlog(){return {name:'growth-native-blog-index',apply:'build',enforce:'post',generateBundle(options,bundle){
 const shell=bundle['index.html'];if(!shell||shell.type!=='asset'||typeof shell.source!=='string')throw Error('Growth needs the existing Vite HTML shell; nothing substituted');
 const destination=config.folder+'/index.html';if(bundle[destination])throw Error('An existing native blog index needs website-owner review');
 const root=/<div\s+id=["']root["']\s*>\s*<\/div>/;if(!root.test(shell.source))throw Error('Growth needs the current empty React root; preserve custom rendering and review separately');
 let html=shell.source.replace(/<title>[^]*?<\/title>/i,'<title>Articles</title>');
 html=html.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi,'');
 html=html.replace('</head>','<link rel="canonical" data-growth-blog="'+config.site_id+'" href="'+config.website+config.index_path+'"></head>');
 html=html.replace(root,'<div id="root"><main data-growth-native-index="'+config.site_id+'"><h1>Articles</h1><p>Published articles load when this page opens. If publishing is paused, no articles are released.</p></main></div>');
 this.emitFile({type:'asset',fileName:destination,source:html});
}};}
