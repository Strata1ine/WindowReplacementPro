import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const dist=path.join(process.cwd(),'dist'),errors=[];
const prohibited=['approved public catalogue','approved public-neutral identities','public-neutral families','public-neutral','reviewed options','reviewed systems','reviewed configurations','reviewed technical evidence','reviewed customer-facing identity','approved specifications','clean product media','published canonical record','eligible public product','a reviewed configuration to support comparison','public examples are limited to products with approved public-neutral identities','approved public products','approved catalogue','reviewed product media','reviewed public details','reviewed public-safe','neutral reviewed derivative','internal evidence','repository does not contain','public hero gate','selected deterministically','public page remains withheld','published until its evidence','confidential trade pricing','wholesale or margin data','content coming soon','coming soon','placeholder copy'];
const exact=['The sash opens outward for.','Awning windows are often.','The operation is useful where an outward-projecting sash.','Double sliders suit wider openings.','The restrained face supports contemporary hardware, colour and.','Reviewed slabs include flush and panelled faces, allowing.','Full-lite.','The arrangement balances daylight and outward visibility with more.'];
const walk=async d=>{const files=[];for(const e of await readdir(d,{withFileTypes:true})){const f=path.join(d,e.name);e.isDirectory()?files.push(...await walk(f)):files.push(f)}return files};
const plain=h=>h.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|amp|quot|#39);/gi,' ').replace(/\s+/g,' ').trim();
for(const file of(await walk(dist)).filter(f=>f.endsWith('.html'))){
  const relative=path.relative(dist,file).replaceAll('\\','/'),html=await readFile(file,'utf8'),copy=plain(html),lower=copy.toLowerCase();
  for(const phrase of prohibited)if(lower.includes(phrase))errors.push(relative+': prohibited internal phrase "'+phrase+'"');
  for(const fragment of exact)if(copy.includes(fragment))errors.push(relative+': broken excerpt "'+fragment+'"');
  for(const card of html.matchAll(/<p\b[^>]*class=["'][^"']*(?:product-card__summary|category-card__summary)[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi)){
    const value=plain(card[1]);if(/\b(?:and|or|for|with|to|of|in|where|allowing|more)\.$/i.test(value))errors.push(relative+': suspicious card fragment "'+value+'"');
  }
}
if(errors.length){console.error('Public copy audit: FAILED ('+errors.length+' issue(s))');for(const error of[...new Set(errors)].sort())console.error('ERROR: '+error);process.exitCode=1}
else console.log('Public copy audit: OK (no internal workflow language or broken public excerpts).');
