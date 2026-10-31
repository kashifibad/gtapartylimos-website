import React,{useEffect,useState} from 'react';
import {articleMarkup,articleJsonLd} from './content-adapter.mjs';
import {config} from './config';import {route,readBlog} from './client';import './growth-blog.css';
type Result=Awaited<ReturnType<typeof readBlog>>;
export default function GrowthBlog({pathname,children}:{pathname:string;children?:React.ReactNode}){
 const [search,setSearch]=useState(()=>window.location.search),[loaded,setLoaded]=useState<{key:string;value:Result}|null>(null);
 const selected=route(pathname),key=pathname+search;
 useEffect(()=>{const update=()=>setSearch(window.location.search);window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update);},[]);
 useEffect(()=>{let current=true;if(selected)void readBlog(pathname,search).then(value=>{if(current)setLoaded({key,value});}).catch(()=>{if(current)setLoaded({key,value:null});});return()=>{current=false;};},[key,Boolean(selected)]);
 const value=loaded?.key===key?loaded.value:undefined,article=value?.kind==='article'?value.articles[0]:undefined;
 useEffect(()=>{if(!selected||value===undefined)return;const oldTitle=document.title,nodes:Element[]=[];
  document.title=article?.seo_title||article?.title||(value?.available?'Articles':'Articles temporarily unavailable');
  const add=(tag:string,attributes:Record<string,string>,text?:string)=>{const element=document.createElement(tag);for(const [k,v]of Object.entries(attributes))element.setAttribute(k,v);if(text)element.textContent=text;element.setAttribute('data-growth-blog',config.site_id);document.head.append(element);nodes.push(element);};
  const ownCanonical=document.head.querySelector('link[rel~="canonical" i][data-growth-blog="'+config.site_id+'"]'),priorCanonical=ownCanonical?.getAttribute('href');
  if(value?.canonical){if(ownCanonical)ownCanonical.setAttribute('href',value.canonical);else if(!document.head.querySelector('link[rel~="canonical" i]'))add('link',{rel:'canonical',href:value.canonical});}
  if(!value?.available||value.kind==='missing'||value.kind==='article'&&!article||value.page>value.pages)add('meta',{name:'robots',content:'noindex,follow'});
  if(article){if(!document.head.querySelector('meta[name="description"]'))add('meta',{name:'description',content:article.meta_description});add('script',{type:'application/ld+json'},articleJsonLd(article));}
  return()=>{document.title=oldTitle;if(ownCanonical&&priorCanonical!==null&&priorCanonical!==undefined)ownCanonical.setAttribute('href',priorCanonical);for(const n of nodes)n.remove();};
 },[value,article,Boolean(selected)]);
 if(!selected)return <>{children}</>;
 if(value===undefined)return <section className="growth-native-blog" aria-busy="true"><h1>Articles</h1><p role="status">Loading articles…</p></section>;
 if(!value?.available)return <section className="growth-native-blog"><h1>Articles temporarily unavailable</h1><p role="status">Please try again shortly. No older copy has been substituted.</p></section>;
 if(value.kind==='missing'||value.kind==='article'&&!article)return <section className="growth-native-blog"><h1>Article not found</h1><a href={config.index}>Back to articles</a></section>;
 if(article)return <section className="growth-native-blog"><a href={config.index}>Back to articles</a><div dangerouslySetInnerHTML={{__html:articleMarkup(article)}}/></section>;
 if(value.page>value.pages)return <section className="growth-native-blog"><h1>Article page not found</h1><a href={config.index+(value.pages>1?'?page='+value.pages:'')}>Go to the last page</a></section>;
 return <section className="growth-native-blog"><h1>Articles</h1>{value.articles.length?<div className="growth-native-grid">{value.articles.map(a=><article key={a.id}><h2><a href={a.canonical_url}>{a.title}</a></h2><p>{a.excerpt}</p><time dateTime={a.published_at}>{a.published_at.slice(0,10)}</time></article>)}</div>:<p>New articles will appear here.</p>}<nav aria-label="Article pages">{value.page>1&&<a href={config.index+(value.page>2?'?page='+(value.page-1):'')}>Previous</a>}<span>Page {value.page} of {value.pages}</span>{value.page<value.pages&&<a href={config.index+'?page='+(value.page+1)}>Next</a>}</nav></section>;
}
