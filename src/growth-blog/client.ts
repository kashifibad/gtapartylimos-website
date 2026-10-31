import {readArticleFeed} from './content-adapter.mjs';
import {config} from './config';
export function pageNumber(raw:string|null){return raw&&/^[1-9][0-9]{0,3}$/.test(raw)?Math.min(Number(raw),1112):1;}
export function route(pathname:string){const path=pathname.replace(/\/$/,'');if(path===config.index.replace(/\/$/,''))return {kind:'index' as const};if(!pathname.startsWith(config.prefix))return null;const slug=pathname.slice(config.prefix.length).replace(/\/$/,'');return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)?{kind:'article' as const,slug}:{kind:'missing' as const};}
export async function readBlog(pathname:string,search:string,transport:typeof fetch=fetch){
 const selected=route(pathname);if(!selected)return null;if(selected.kind==='missing')return {available:true,articles:[],total:0,kind:'missing' as const,page:1,pages:1,canonical:''};
 const page=selected.kind==='index'?pageNumber(new URLSearchParams(search).get('page')):1;
 const safeTransport=async(address:URL,init?:RequestInit)=>{const u=new URL(address),root=new URL(config.endpoint);if(u.origin!==root.origin||!(u.pathname===root.pathname||u.pathname.startsWith(root.pathname+'/')&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(u.pathname.slice(root.pathname.length+1))))throw Error('Article source does not match this website');return transport('/api/growth-articles'+u.pathname.slice(root.pathname.length)+u.search,{...init,credentials:'omit'});};
 const v=await readArticleFeed({endpoint:config.endpoint,canonicalOrigin:config.website,...(selected.kind==='article'?{slug:selected.slug}:{limit:9,offset:(page-1)*9}),expectedSiteId:config.site_id,requireAttestation:true,transport:safeTransport});
 // A valid own-site article path is required as well as an own-site origin.
 if(v.articles.some(a=>a.canonical_url!==config.website+config.prefix+a.slug+"/"))return {...v,available:false,articles:[],page,pages:1,kind:selected.kind,canonical:''};
 return {...v,page,pages:Math.max(1,Math.ceil(v.total/9)),kind:selected.kind,canonical:selected.kind==='article'?(v.articles[0]?.canonical_url||''):config.website+config.index+(page>1?'?page='+page:'')};
}
