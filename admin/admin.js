/* ═══ Satlok Seva — Release Console ═══
   Talks only to api.github.com. Releases are published as ONE atomic
   commit via the Git Data API, so devices never see a half-written manifest. */
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const API = 'https://api.github.com';

const S = {
  owner:'glitchyapi', repo:'satlok-seva', branch:'main', token:'',
  manifest:null, manifestSha:null, headSha:null,
  webFiles:[], webDiff:null, apk:null
};

/* ─────────── session ─────────── */
function loadSession(){
  try{
    const raw = sessionStorage.getItem('slseva.console');
    if(raw){ Object.assign(S, JSON.parse(raw)); }
  }catch(e){}
  $('#inOwner').value=S.owner; $('#inRepo').value=S.repo; $('#inBranch').value=S.branch;
  if(S.token) $('#inToken').value=S.token;
}
function saveSession(){
  try{ sessionStorage.setItem('slseva.console', JSON.stringify({
    owner:S.owner, repo:S.repo, branch:S.branch, token:S.token })); }catch(e){}
}

/* ─────────── github ─────────── */
async function gh(path, opts={}){
  const res = await fetch(API+path, {
    ...opts,
    headers:{ 'Authorization':'Bearer '+S.token, 'Accept':'application/vnd.github+json',
              'X-GitHub-Api-Version':'2022-11-28', ...(opts.headers||{}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const txt = await res.text();
  let data; try{ data = txt?JSON.parse(txt):null; }catch(e){ data = txt; }
  if(!res.ok){
    const m = (data && data.message) || res.statusText;
    throw new Error(`${res.status} ${m}`);
  }
  return data;
}
const repoPath = p => `/repos/${S.owner}/${S.repo}${p}`;

/* ─────────── base64 helpers ─────────── */
function bufToB64(buf){
  const u8 = new Uint8Array(buf); let s=''; const C=0x8000;
  for(let i=0;i<u8.length;i+=C) s += String.fromCharCode.apply(null, u8.subarray(i,i+C));
  return btoa(s);
}
const strToB64 = s => bufToB64(new TextEncoder().encode(s));
function b64ToStr(b){
  const bin = atob(b.replace(/\s/g,''));
  const u8 = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
  return new TextDecoder().decode(u8);
}
async function sha256(buf){
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
const fmtBytes = n => n<1024 ? n+' B' : n<1048576 ? (n/1024).toFixed(1)+' KB' : (n/1048576).toFixed(2)+' MB';

/* ─────────── atomic commit ─────────── */
async function commitFiles(entries, message, onProgress){
  // entries: [{path, contentB64, binary}]  — path is repo-relative
  const ref = await gh(repoPath(`/git/ref/heads/${S.branch}`));
  const headSha = ref.object.sha;
  const head = await gh(repoPath(`/git/commits/${headSha}`));
  const baseTree = head.tree.sha;

  const tree = [];
  for(let i=0;i<entries.length;i++){
    const e = entries[i];
    if(onProgress) onProgress(i/entries.length, `Uploading ${e.path}`);
    if(e.delete){ tree.push({path:e.path, mode:'100644', type:'blob', sha:null}); continue; }
    const blob = await gh(repoPath('/git/blobs'), {method:'POST', body:{content:e.contentB64, encoding:'base64'}});
    tree.push({path:e.path, mode:'100644', type:'blob', sha:blob.sha});
  }
  if(onProgress) onProgress(0.92,'Creating tree…');
  const newTree = await gh(repoPath('/git/trees'), {method:'POST', body:{base_tree:baseTree, tree}});
  if(onProgress) onProgress(0.96,'Committing…');
  const commit = await gh(repoPath('/git/commits'), {method:'POST',
    body:{message, tree:newTree.sha, parents:[headSha]}});
  await gh(repoPath(`/git/refs/heads/${S.branch}`), {method:'PATCH', body:{sha:commit.sha, force:false}});
  if(onProgress) onProgress(1,'Published');
  return commit;
}

/* ─────────── manifest ─────────── */
const pagesBase = () => `https://${S.owner}.github.io/${S.repo}/`;
const manifestUrl = () => pagesBase()+'manifest.json';

function blankManifest(){
  return {
    schema:1, app:'satlok-seva', channel:'stable', minVersionCode:0,
    updatedAt:new Date().toISOString(),
    latest:{ versionName:'1.0.0', versionCode:1, releasedAt:new Date().toISOString(),
             mandatory:false, notes:{hi:[],en:[],pa:[]} },
    broadcast:{enabled:false}
  };
}

async function loadManifest(){
  // read through the API so we also get the blob sha and avoid Pages caching
  try{
    const f = await gh(repoPath(`/contents/manifest.json?ref=${S.branch}`));
    S.manifestSha = f.sha;
    S.manifest = JSON.parse(b64ToStr(f.content));
  }catch(e){
    if(String(e.message).startsWith('404')){ S.manifest = blankManifest(); S.manifestSha=null; }
    else throw e;
  }
  S.manifest.latest = S.manifest.latest || {};
  S.manifest.latest.notes = S.manifest.latest.notes || {hi:[],en:[],pa:[]};
  renderOverview(); fillMeta();
}

function renderOverview(){
  const m=S.manifest, L=m.latest||{};
  $('#ovVer').textContent = L.versionName||'—';
  $('#ovCode').textContent = 'versionCode '+(L.versionCode??'—');
  $('#ovWeb').textContent = L.web ? ('v'+L.web.version) : 'none';
  $('#ovFiles').textContent = L.web ? (L.web.files||[]).length+' files · '+fmtBytes(L.web.totalBytes||0) : '—';
  $('#ovApk').textContent = L.apk ? fmtBytes(L.apk.size||0) : 'none';
  $('#ovApkState').textContent = L.apk ? (L.apk.url||'').split('/').pop() : '—';
  $('#ovChan').textContent = m.channel||'stable';
  $('#ovMand').textContent = L.mandatory ? 'mandatory' : 'optional';
  $('#manifestUrl').textContent = manifestUrl();
  $('#lnkPages').href = pagesBase();
  $('#lnkRepo').href = `https://github.com/${S.owner}/${S.repo}`;
  $('#manifestJson').textContent = JSON.stringify(m,null,2);
  const nextWeb = (L.web? Number(L.web.version):0)+1;
  $('#webVer').value = nextWeb;
  $('#webLabel').value = L.versionName||'1.0.1';
  $('#apkCode').value = (Number(L.versionCode)||0)+1;
  $('#apkName').value = L.versionName||'1.0.0';
}

function fillMeta(){
  const m=S.manifest, n=(m.latest&&m.latest.notes)||{};
  $('#notesHi').value=(n.hi||[]).join('\n');
  $('#notesEn').value=(n.en||[]).join('\n');
  $('#notesPa').value=(n.pa||[]).join('\n');
  const b=m.broadcast||{};
  $('#bcEnabled').checked=!!b.enabled;
  $('#bcTitle').value=b.title||'';
  $('#bcHi').value=(b.body&&b.body.hi)||'';
  $('#bcEn').value=(b.body&&b.body.en)||'';
  $('#bcStyle').value=b.style||'info';
  $('#bcUrl').value=b.url||'';
  $('#bcExpires').value=b.expires?String(b.expires).slice(0,10):'';
  $('#chanSel').value=m.channel||'stable';
  $('#minCode').value=m.minVersionCode||0;
  $('#mandToggle').checked=!!(m.latest&&m.latest.mandatory);
}
function collectNotes(){
  const split = v => v.split('\n').map(x=>x.trim()).filter(Boolean);
  return {hi:split($('#notesHi').value), en:split($('#notesEn').value), pa:split($('#notesPa').value)};
}

/* ─────────── connect ─────────── */
$('#btnConnect').onclick = async ()=>{
  S.owner=$('#inOwner').value.trim(); S.repo=$('#inRepo').value.trim();
  S.branch=$('#inBranch').value.trim()||'main'; S.token=$('#inToken').value.trim();
  if(!S.token){ msg('#connectMsg','Enter a token','err'); return; }
  busy(true,'Connecting…');
  try{
    const me = await gh('/user');
    const r = await gh(repoPath(''));
    if(!r.permissions || !r.permissions.push) throw new Error('Token has no write access to this repository');
    saveSession();
    $('#connPill').textContent = '@'+me.login;
    $('#connPill').classList.add('ok');
    $('#connectCard').hidden = true;
    $('#console').hidden = false;
    $('#btnDisconnect').hidden = false;
    await loadManifest();
    toast('Connected as @'+me.login,'ok');
  }catch(e){ msg('#connectMsg', e.message, 'err'); }
  finally{ busy(false); }
};
$('#btnDisconnect').onclick = ()=>{
  sessionStorage.removeItem('slseva.console'); S.token='';
  $('#inToken').value=''; $('#connectCard').hidden=false; $('#console').hidden=true;
  $('#btnDisconnect').hidden=true; $('#connPill').textContent='Not connected';
  $('#connPill').classList.remove('ok');
};
$('#btnReload').onclick = async ()=>{ busy(true,'Reloading…'); try{ await loadManifest(); toast('Reloaded','ok'); }catch(e){toast(e.message,'err');} finally{busy(false);} };

/* ─────────── tabs ─────────── */
$$('.tabs button').forEach(b=> b.onclick = ()=>{
  $$('.tabs button').forEach(x=>x.classList.toggle('on',x===b));
  $$('.tabpane').forEach(p=>p.classList.toggle('on', p.id==='tab-'+b.dataset.tab));
});

/* ─────────── web bundle ─────────── */
$('#btnPickFolder').onclick = ()=> $('#webFiles').click();
$('#btnPickFiles').onclick  = ()=> $('#webFilesFlat').click();
$('#webFiles').onchange = e => handleWebFiles([...e.target.files], true);
$('#webFilesFlat').onchange = e => handleWebFiles([...e.target.files], false);
setupDrop($('#webDrop'), files => handleWebFiles(files, false));

async function handleWebFiles(files, isFolder){
  if(!files.length) return;
  busy(true,'Hashing files…');
  try{
    const out=[];
    for(let i=0;i<files.length;i++){
      const f=files[i];
      let rel = f.webkitRelativePath || f._relPath || f.name;
      if(isFolder){
        const parts = rel.split('/');
        if(parts.length>1) parts.shift();       // drop the top folder name
        rel = parts.join('/');
      }
      rel = rel.replace(/^\/+/,'');
      if(!rel || rel.startsWith('.') || rel.includes('/.') || rel==='bundle-manifest.json' || rel==='config.js') continue;
      const buf = await f.arrayBuffer();
      out.push({path:rel, size:buf.byteLength, sha256:await sha256(buf), buf});
      busyProgress(i/files.length, `Hashing ${rel}`);
    }
    out.sort((a,b)=>a.path.localeCompare(b.path));
    if(!out.some(f=>f.path==='index.html')) throw new Error('No index.html found — select the www folder itself');
    S.webFiles = out;
    computeWebDiff();
  }catch(e){ toast(e.message,'err'); }
  finally{ busy(false); }
}

function computeWebDiff(){
  const remote={};
  const cur = S.manifest.latest && S.manifest.latest.web;
  if(cur && cur.files) cur.files.forEach(f=> remote[f.path]=f.sha256);
  const localPaths = new Set(S.webFiles.map(f=>f.path));
  const changed=[], same=[];
  S.webFiles.forEach(f=> (remote[f.path]===f.sha256 ? same : changed).push(f));
  const removed = Object.keys(remote).filter(p=>!localPaths.has(p));
  S.webDiff = {changed, same, removed, bytes:changed.reduce((a,f)=>a+f.size,0)};

  $('#webSummary').hidden=false;
  $('#wsTotal').textContent=S.webFiles.length;
  $('#wsChanged').textContent=changed.length;
  $('#wsSame').textContent=same.length;
  $('#wsRemoved').textContent=removed.length;
  $('#wsBytes').textContent=fmtBytes(S.webDiff.bytes);
  const row = (f,cls,label) => `<div class="fitem ${cls}"><span class="fdot"></span><code>${esc(f.path||f)}</code><em>${label}</em><b>${f.size?fmtBytes(f.size):''}</b></div>`;
  $('#webList').innerHTML =
    changed.map(f=>row(f,'chg','changed')).join('') +
    removed.map(p=>row({path:p},'del','removed')).join('') +
    same.slice(0,8).map(f=>row(f,'sam','unchanged')).join('') +
    (same.length>8?`<div class="fmore">+ ${same.length-8} more unchanged files</div>`:'');
}

$('#btnClearWeb').onclick = ()=>{ S.webFiles=[]; S.webDiff=null; $('#webSummary').hidden=true; $('#webFiles').value=''; $('#webFilesFlat').value=''; };

$('#btnPublishWeb').onclick = async ()=>{
  if(!S.webDiff) return;
  const ver = Number($('#webVer').value);
  if(!ver || ver<1){ toast('Enter a valid web version','err'); return; }
  const label = $('#webLabel').value.trim() || (S.manifest.latest.versionName||'1.0.0');
  const dir = `web/${ver}/`;
  busy(true,'Publishing web bundle…');
  try{
    const entries=[];
    for(const f of S.webDiff.changed){
      entries.push({path:dir+f.path, contentB64:bufToB64(f.buf)});
    }
    // carry unchanged files forward so the versioned folder is complete
    for(const f of S.webDiff.same){
      entries.push({path:dir+f.path, contentB64:bufToB64(f.buf)});
    }
    const web = {
      version:ver, entry:'index.html', baseUrl:pagesBase()+dir,
      generatedAt:new Date().toISOString(),
      fileCount:S.webFiles.length,
      totalBytes:S.webFiles.reduce((a,f)=>a+f.size,0),
      deltaBytes:S.webDiff.bytes,
      files:S.webFiles.map(f=>({path:f.path, sha256:f.sha256, size:f.size}))
    };
    const m = structuredClone(S.manifest);
    m.updatedAt=new Date().toISOString();
    m.latest = m.latest||{};
    m.latest.web = web;
    m.latest.versionName = label;
    m.latest.releasedAt = new Date().toISOString();
    m.latest.notes = collectNotes();
    entries.push({path:'manifest.json', contentB64:strToB64(JSON.stringify(m,null,2))});
    entries.push({path:`web/latest.json`, contentB64:strToB64(JSON.stringify(web,null,2))});

    const c = await commitFiles(entries, `release(web): v${ver} — ${S.webDiff.changed.length} changed file(s)`, busyProgress);
    toast(`Published web v${ver} · ${S.webDiff.changed.length} files changed`,'ok');
    await loadManifest();
    $('#btnClearWeb').click();
  }catch(e){ toast(e.message,'err'); }
  finally{ busy(false); }
};

/* ─────────── APK ─────────── */
$('#btnPickApk').onclick = ()=> $('#apkFile').click();
$('#apkFile').onchange = e => e.target.files[0] && handleApk(e.target.files[0]);
setupDrop($('#apkDrop'), files => files[0] && handleApk(files[0]));

async function handleApk(file){
  busy(true,'Validating APK…');
  try{
    const buf = await file.arrayBuffer();
    const v = validateApk(buf);
    const sha = await sha256(buf);
    S.apk = {file, buf, sha, size:buf.byteLength, valid:v.ok, checks:v.checks, name:file.name};
    $('#apkSummary').hidden=false;
    $('#akName').textContent=file.name;
    $('#akSize').textContent=fmtBytes(buf.byteLength);
    $('#akSha').textContent=sha;
    $('#apkValidation').innerHTML = v.checks.map(c=>
      `<div class="vrow ${c.ok?'ok':'bad'}"><span>${c.ok?'✓':'✕'}</span><b>${esc(c.label)}</b><em>${esc(c.detail||'')}</em></div>`).join('');
    $('#btnPublishApk').disabled = !v.ok;
    if(!v.ok) toast('This file is not a valid APK — upload blocked','err');
  }catch(e){ toast(e.message,'err'); }
  finally{ busy(false); }
}

/** Parse the ZIP central directory — no libraries needed. */
function validateApk(buf){
  const checks=[]; const u8=new Uint8Array(buf); const dv=new DataView(buf);
  const okMagic = u8.length>4 && u8[0]===0x50 && u8[1]===0x4b && u8[2]===0x03 && u8[3]===0x04;
  const head = new TextDecoder('utf-8',{fatal:false}).decode(u8.subarray(0,Math.min(200,u8.length)));
  const looksHtml = /<!doctype html|<html/i.test(head);
  checks.push({ok:okMagic && !looksHtml, label:'ZIP / APK magic bytes',
    detail: looksHtml ? 'This is an HTML page, not an APK (a 404 download?)' : okMagic?'PK\\x03\\x04 present':'missing PK header'});
  if(!okMagic || looksHtml) return {ok:false, checks};

  // find End Of Central Directory
  let eocd=-1;
  for(let i=u8.length-22;i>=Math.max(0,u8.length-65557);i--){
    if(dv.getUint32(i,true)===0x06054b50){ eocd=i; break; }
  }
  checks.push({ok:eocd>=0, label:'ZIP central directory', detail:eocd>=0?'found':'not found — truncated file?'});
  if(eocd<0) return {ok:false, checks};

  const count=dv.getUint16(eocd+10,true); let off=dv.getUint32(eocd+16,true);
  const names=new Set();
  for(let i=0;i<count && off+46<=u8.length;i++){
    if(dv.getUint32(off,true)!==0x02014b50) break;
    const nlen=dv.getUint16(off+28,true), elen=dv.getUint16(off+30,true), clen=dv.getUint16(off+32,true);
    const name=new TextDecoder().decode(u8.subarray(off+46,off+46+nlen));
    names.add(name);
    off += 46+nlen+elen+clen;
  }
  const need=[['AndroidManifest.xml','compiled manifest'],['classes.dex','Dalvik bytecode'],['resources.arsc','resource table']];
  need.forEach(([n,label])=> checks.push({ok:names.has(n), label, detail:names.has(n)?n:'MISSING — '+n}));
  const signed=[...names].some(n=>/^META-INF\/.*\.(RSA|DSA|EC)$/i.test(n));
  checks.push({ok:signed, label:'Signature block', detail:signed?'v1 JAR signature present':'no META-INF signature (v2-only is acceptable on API 24+)'});
  checks.push({ok:u8.length>50000, label:'Plausible size', detail:fmtBytes(u8.length)+(u8.length<=50000?' — suspiciously small':'')});
  const hardOk = checks.slice(0,5).every(c=>c.ok) && u8.length>50000;
  return {ok:hardOk, checks};
}

$('#btnClearApk').onclick = ()=>{ S.apk=null; $('#apkSummary').hidden=true; $('#apkFile').value=''; };

$('#btnPublishApk').onclick = async ()=>{
  if(!S.apk || !S.apk.valid) return;
  const code=Number($('#apkCode').value), name=$('#apkName').value.trim()||'1.0.0';
  const cur=Number(S.manifest.latest.versionCode)||0;
  if(code<=cur){ toast(`versionCode must be greater than ${cur}`,'err'); return; }
  busy(true,'Uploading APK…');
  try{
    const path=`apk/SatlokSeva-${name}-${code}.apk`;
    const url=pagesBase()+path;
    const m=structuredClone(S.manifest);
    m.updatedAt=new Date().toISOString();
    m.latest=m.latest||{};
    m.latest.versionName=name; m.latest.versionCode=code;
    m.latest.mandatory=$('#apkMandatory').checked;
    m.latest.releasedAt=new Date().toISOString();
    m.latest.notes=collectNotes();
    m.latest.apk={url, sha256:S.apk.sha, size:S.apk.size, path, releasedAt:m.latest.releasedAt};
    const entries=[
      {path, contentB64:bufToB64(S.apk.buf)},
      {path:'apk/latest.json', contentB64:strToB64(JSON.stringify(m.latest.apk,null,2))},
      {path:'manifest.json', contentB64:strToB64(JSON.stringify(m,null,2))}
    ];
    await commitFiles(entries, `release(apk): ${name} (${code})`, busyProgress);
    toast(`Published APK ${name} (${code})`,'ok');
    await loadManifest(); $('#btnClearApk').click();
  }catch(e){ toast(e.message,'err'); }
  finally{ busy(false); }
};

/* ─────────── meta ─────────── */
$('#btnPublishMeta').onclick = async ()=>{
  busy(true,'Saving…');
  try{
    const m=structuredClone(S.manifest);
    m.updatedAt=new Date().toISOString();
    m.channel=$('#chanSel').value;
    m.minVersionCode=Number($('#minCode').value)||0;
    m.latest=m.latest||{};
    m.latest.notes=collectNotes();
    m.latest.mandatory=$('#mandToggle').checked;
    const exp=$('#bcExpires').value;
    m.broadcast={
      enabled:$('#bcEnabled').checked,
      id:'bc_'+Date.now().toString(36),
      title:$('#bcTitle').value.trim(),
      body:{hi:$('#bcHi').value.trim(), en:$('#bcEn').value.trim()},
      style:$('#bcStyle').value,
      url:$('#bcUrl').value.trim(),
      expires: exp? new Date(exp+'T23:59:59Z').toISOString() : null,
      createdAt:new Date().toISOString()
    };
    await commitFiles([{path:'manifest.json', contentB64:strToB64(JSON.stringify(m,null,2))}],
      'chore: update release notes / broadcast', busyProgress);
    toast('Saved — devices pick this up on next check','ok');
    await loadManifest();
  }catch(e){ toast(e.message,'err'); }
  finally{ busy(false); }
};

/* ─────────── health check ─────────── */
$('#btnHealth').onclick = async ()=>{
  busy(true,'Checking published release…');
  const out=[]; let pass=0, fail=0;
  const add=(ok,label,detail)=>{ ok?pass++:fail++; out.push({ok,label,detail}); };
  try{
    const mu=manifestUrl()+'?t='+Date.now();
    let m;
    try{
      const r=await fetch(mu,{cache:'no-store'});
      add(r.ok,'Manifest reachable', `HTTP ${r.status} · ${mu}`);
      if(!r.ok) throw new Error('manifest unreachable');
      m=await r.json();
      add(true,'Manifest is valid JSON', `schema ${m.schema}, channel ${m.channel}`);
    }catch(e){ add(false,'Manifest fetch', e.message); throw e; }

    const L=m.latest||{};
    if(L.apk && L.apk.url){
      try{
        const r=await fetch(L.apk.url+'?t='+Date.now(),{cache:'no-store'});
        add(r.ok,'APK URL resolves',`HTTP ${r.status} · ${L.apk.url}`);
        if(r.ok){
          const buf=await r.arrayBuffer();
          const v=validateApk(buf);
          add(v.ok,'APK is a real Android package', v.checks.filter(c=>!c.ok).map(c=>c.label).join(', ')||'all structural checks passed');
          const h=await sha256(buf);
          add(h===L.apk.sha256,'APK SHA-256 matches manifest', h===L.apk.sha256?h:`expected ${L.apk.sha256}, got ${h}`);
          add(buf.byteLength===L.apk.size,'APK size matches',`${fmtBytes(buf.byteLength)} vs ${fmtBytes(L.apk.size||0)}`);
        }
      }catch(e){ add(false,'APK check',e.message); }
    } else add(true,'APK track','not published (web-only release)');

    if(L.web && L.web.files){
      const base=L.web.baseUrl||'';
      add(true,'Web bundle declared',`v${L.web.version} · ${L.web.files.length} files`);
      const sample=L.web.files.slice(0,12);
      for(let i=0;i<sample.length;i++){
        const f=sample[i];
        busyProgress(i/sample.length,`Verifying ${f.path}`);
        try{
          const u=(f.url||base.replace(/\/+$/,'')+'/'+f.path)+'?t='+Date.now();
          const r=await fetch(u,{cache:'no-store'});
          if(!r.ok){ add(false,f.path,`HTTP ${r.status}`); continue; }
          const buf=await r.arrayBuffer();
          const h=await sha256(buf);
          add(h===f.sha256, f.path, h===f.sha256?`${fmtBytes(buf.byteLength)} · hash ok`:'HASH MISMATCH');
        }catch(e){ add(false,f.path,e.message); }
      }
      if(L.web.files.length>sample.length)
        add(true,'Remaining files',`${L.web.files.length-sample.length} not sampled (first 12 verified)`);
    }
  }catch(e){ /* already recorded */ }
  finally{ busy(false); }
  $('#healthSum').textContent=`${pass} passed · ${fail} failed`;
  $('#healthSum').className='msg '+(fail?'err':'ok');
  $('#healthOut').innerHTML=out.map(o=>
    `<div class="hrow ${o.ok?'ok':'bad'}"><span class="hico">${o.ok?'✓':'✕'}</span><div><b>${esc(o.label)}</b><em>${esc(o.detail||'')}</em></div></div>`).join('');
};

/* ─────────── ui utils ─────────── */
function setupDrop(el, cb){
  ['dragenter','dragover'].forEach(ev=> el.addEventListener(ev,e=>{e.preventDefault();el.classList.add('over');}));
  ['dragleave','drop'].forEach(ev=> el.addEventListener(ev,e=>{e.preventDefault();el.classList.remove('over');}));
  el.addEventListener('drop', e=>{
    const files=[...(e.dataTransfer.files||[])];
    if(files.length) cb(files);
  });
}
function esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
let toastT;
function toast(m,kind){ const el=$('#toast'); el.textContent=m; el.className='toast on'+(kind?' '+kind:''); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('on'),3600); }
function msg(sel,m,kind){ const el=$(sel); el.textContent=m; el.className='msg '+(kind||''); }
function busy(on,text){ $('#busy').hidden=!on; if(text) $('#busyText').textContent=text; if(!on) $('#busyBar').style.width='0%'; }
function busyProgress(f,t){ $('#busyBar').style.width=Math.round(f*100)+'%'; if(t) $('#busyText').textContent=t; }

$('#btnTheme').onclick = ()=>{
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  document.documentElement.setAttribute('data-theme',dark?'light':'dark');
  $('#btnTheme').textContent=dark?'🌙':'☀️';
  localStorage.setItem('slseva.theme',dark?'light':'dark');
};
$$('[data-copy]').forEach(b=> b.onclick=()=>{
  navigator.clipboard.writeText($(b.dataset.copy).textContent).then(()=>toast('Copied','ok'));
});

/* ─────────── init ─────────── */
(function init(){
  const th=localStorage.getItem('slseva.theme');
  if(th){ document.documentElement.setAttribute('data-theme',th); $('#btnTheme').textContent=th==='dark'?'☀️':'🌙'; }
  $('#ftrTime').textContent=new Date().toLocaleString();
  loadSession();
  if(S.token){ $('#btnConnect').click(); }
})();
