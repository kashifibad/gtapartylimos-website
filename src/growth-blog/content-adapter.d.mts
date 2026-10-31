export type Article={id:string;site_id:string;slug:string;title:string;seo_title:string;meta_description:string;excerpt:string;canonical_url:string;published_at:string;version:number;fingerprint:string;[key:string]:unknown};
export function readArticleFeed(input:{endpoint:string;canonicalOrigin:string;slug?:string;limit?:number;offset?:number;expectedSiteId?:string;requireAttestation?:boolean;transport?:(url:URL,init?:RequestInit)=>Promise<Response>}):Promise<{available:boolean;articles:Article[];total:number}>;
export function articleMarkup(article:Article):string;
export function articleJsonLd(article:Article):string;
