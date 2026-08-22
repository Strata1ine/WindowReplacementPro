import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),dist=path.join(root,'dist'),origin='https://windowreplacement.pro',errors=[];
const categoryRoots=['/windows/','/doors/','/patio-doors/'];
const prohibited=new Set(['brand','manufacturer','offers','price','priceCurrency','availability','review','reviews','aggregateRating','sku','mpn','gtin','gtin8','gtin12','gtin13','gtin14']);
const walk=async d=>{const files=[];for(const entry of await readdir(d,{withFileTypes:true})){const full=path.join(d,entry.name);entry.isDirectory()?files.push(...await walk(full)):files.push(full)}return files};
const routeFor=file=>{const relative=path.relative(dist,file).replaceAll('\\','/');return relative==='index.html'?'/':'/'+relative.replace(/index\.html$/,'')};
const inspectKeys=(value,route,trail='schema')=>{if(Array.isArray(value)){value.forEach((item,index)=>inspectKeys(item,route,trail+'['+index+']'));return}if(!value||typeof value!=='object')return;for(const[key,item]of Object.entries(value)){if(prohibited.has(key))errors.push(route+': prohibited JSON-LD field '+trail+'.'+key);inspectKeys(item,route,trail+'.'+key)}};
let productCount=0,productGroupCount=0;
for(const file of(await walk(dist)).filter(file=>file.endsWith('.html'))){
  const route=routeFor(file),html=await readFile(file,'utf8'),schemas=[];
  for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const value=JSON.parse(match[1]);schemas.push(...(Array.isArray(value)?value:[value]))}catch(error){errors.push(route+': invalid JSON-LD: '+error.message)}}
  const types=schemas.map(item=>item?.['@type']).filter(Boolean);productCount+=types.filter(type=>type==='Product').length;productGroupCount+=types.filter(type=>type==='ProductGroup').length;
  if(route!=='/404.html'&&!types.includes('Organization'))errors.push(route+': Organization schema missing');
  const category=categoryRoots.some(rootRoute=>route.startsWith(rootRoute));
  if(category&&!types.includes('Service'))errors.push(route+': Service schema missing');
  if(category&&!types.includes('BreadcrumbList'))errors.push(route+': BreadcrumbList schema missing');
  if(route.startsWith('/guides/')&&route!=='/guides/'&&!types.includes('Article'))errors.push(route+': Article schema missing');
  if(route.startsWith('/products/')){
    const groups=schemas.filter(schema=>schema?.['@type']==='ProductGroup');
    if(groups.length!==1)errors.push(route+': expected exactly one ProductGroup schema');
    if(types.includes('Product'))errors.push(route+': discrete Product schema is not valid for a public comparison group');
    for(const group of groups){
      if(!/^WRP-[WDGP]\d{3}$/.test(group.productGroupID??''))errors.push(route+': ProductGroup public reference is missing or invalid');
      if(group.url!==origin+route)errors.push(route+': ProductGroup URL does not match canonical route');
      if(!Array.isArray(group.variesBy)||group.variesBy.length<3)errors.push(route+': ProductGroup variesBy is incomplete');
      if('hasVariant'in group)errors.push(route+': unsupported public variants must not be emitted');
    }
  }
  for(const schema of schemas){
    inspectKeys(schema,route);
    if(schema?.['@type']==='BreadcrumbList'){
      const items=schema.itemListElement??[];
      if(!Array.isArray(items)||!items.length)errors.push(route+': breadcrumb items missing');
      items.forEach((item,index)=>{if(item.position!==index+1)errors.push(route+': breadcrumb positions are invalid');if(typeof item.item!=='string'||!item.item.startsWith(origin+'/'))errors.push(route+': breadcrumb URL is not first-party absolute')});
      if(items.at(-1)?.item!==origin+route)errors.push(route+': final breadcrumb URL does not match canonical route');
    }
  }
}
if(productGroupCount!==40)errors.push('expected 40 ProductGroup schemas, found '+productGroupCount);if(productCount!==0)errors.push('expected 0 Product schemas, found '+productCount);
if(errors.length){console.error('Structured data audit: FAILED ('+errors.length+' issue(s))');for(const error of[...new Set(errors)].sort())console.error('ERROR: '+error);process.exitCode=1}
else console.log(`Structured data audit: OK (${productGroupCount} ProductGroup, ${productCount} Product; prohibited commercial and identity fields: 0).`);