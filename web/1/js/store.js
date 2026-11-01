/* ═══════════════════════════════════════════════════════════
   STORE — encrypted + compressed local persistence
   Pipeline:  JSON ──DEFLATE(9)──▶ AES-256-GCM ──▶ base64 file
   Native path uses Android Keystore (hardware-backed where
   available). Browser path uses WebCrypto + CompressionStream.
   ═══════════════════════════════════════════════════════════ */
(function(){
'use strict';

var SCHEMA = 3;
var KEY_NAME = 'satlok.master.v1';

function defaultData(){
  return {
    schema: SCHEMA,
    settings:{ name:'', lang:'hi', theme:'light', goal:3, reminder:false, remTime:'20:00',
               notif:false, updNotif:true, onboarded:false, channel:'stable' },
    sevas:[], bhandaras:[],
    meta:{ created:Date.now(), lastOpen:Date.now(), writes:0, lastRaw:0, lastStored:0 }
  };
}

var Store = {
  data: defaultData(),
  ready:false,
  stats:{raw:0, stored:0},
  mode:'browser',

  /* ───── boot ───── */
  init: async function(){
    this.mode = (window.Native && Native.available) ? 'native' : 'browser';
    this.data = defaultData();          // never leave app without a usable state
    var loaded = null;
    try{
      if(this.mode === 'native'){
        var r = Native.secureRead();               // -> {"json":"…","raw":N,"stored":N} | ""
        if(r){ var o = JSON.parse(r);
          if(o && o.json) loaded = {data:JSON.parse(o.json), raw:o.raw, stored:o.stored}; }
      }else{
        var blob = localStorage.getItem('satlok.vault');
        if(blob){
          try{ loaded = await this._unpackBrowser(blob); }
          catch(e){
            console.warn('[store] primary vault unreadable, trying backup', e);
            var bak = localStorage.getItem('satlok.vault.bak');
            if(bak) loaded = await this._unpackBrowser(bak);
            this.recovered = true;
          }
        }
      }
    }catch(e){ console.warn('[store] load failed — starting fresh', e); this.loadError = String(e); }

    if(loaded && loaded.data && typeof loaded.data === 'object'){
      this.data = this._migrate(loaded.data);
      this.stats.raw = loaded.raw||0; this.stats.stored = loaded.stored||0;
    }
    this.data.meta.lastOpen = Date.now();
    this.ready = true;
    return this.data;
  },

  _migrate: function(d){
    var base = defaultData();
    d.settings = Object.assign(base.settings, d.settings||{});
    d.meta = Object.assign(base.meta, d.meta||{});
    d.sevas = Array.isArray(d.sevas)? d.sevas : [];
    d.bhandaras = Array.isArray(d.bhandaras)? d.bhandaras : [];
    d.schema = SCHEMA;
    return d;
  },

  /* ───── persist ───── */
  save: async function(){
    this.data.meta.writes = (this.data.meta.writes||0)+1;
    var json = JSON.stringify(this.data);
    var raw = utf8Len(json);
    try{
      if(this.mode === 'native'){
        var res = Native.secureWrite(json);
        var o = typeof res === 'string' ? JSON.parse(res) : res;
        this.stats = {raw:o.raw||raw, stored:o.stored||0};
      }else{
        var blob = await this._packBrowser(json);
        var prev = localStorage.getItem('satlok.vault');
        if(prev) localStorage.setItem('satlok.vault.bak', prev);
        localStorage.setItem('satlok.vault', blob);
        this.stats = {raw:raw, stored:blob.length};
      }
      this.data.meta.lastRaw = this.stats.raw;
      this.data.meta.lastStored = this.stats.stored;
    }catch(e){ console.error('[store] save failed', e); throw e; }
    return this.stats;
  },

  /* ═══════ BROWSER CRYPTO FALLBACK ═══════ */
  _key: async function(){
    if(this.__key) return this.__key;
    var stored = localStorage.getItem(KEY_NAME);
    var rawKey;
    if(stored){ rawKey = b64d(stored); }
    else{ rawKey = crypto.getRandomValues(new Uint8Array(32)); localStorage.setItem(KEY_NAME, b64e(rawKey)); }
    this.__key = await crypto.subtle.importKey('raw', rawKey, {name:'AES-GCM'}, false, ['encrypt','decrypt']);
    return this.__key;
  },

  _packBrowser: async function(json){
    var bytes = new TextEncoder().encode(json);
    var c = await compress(bytes), flag = c.algo;
    var payload = c.data;
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var key = await this._key();
    var ct = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv:iv, tagLength:128}, key, payload));
    var out = new Uint8Array(1+12+ct.length);
    out[0]=flag; out.set(iv,1); out.set(ct,13);
    return 'SL1:'+b64e(out);
  },

  _unpackBrowser: async function(blob){
    if(blob.indexOf('SL1:')!==0) throw new Error('bad vault');
    var buf = b64d(blob.slice(4));
    var flag = buf[0], iv = buf.slice(1,13), ct = buf.slice(13);
    var key = await this._key();
    var plain = new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM', iv:iv, tagLength:128}, key, ct));
    var bytes = await decompress(plain, flag);
    var json = new TextDecoder().decode(bytes);
    return {data:JSON.parse(json), raw:utf8Len(json), stored:blob.length};
  },

  /* ═══════ SEVA CRUD ═══════ */
  addSeva: function(s){
    s.id = s.id || uid();
    s.created = s.created || Date.now();
    s.qty = Math.max(0, Number(s.qty)||0);
    s.minutes = Math.max(0, Number(s.minutes)||0);
    this.data.sevas.push(s);
    return this.save().then(function(){ return s; });
  },
  updateSeva: function(id, patch){
    var i = this.data.sevas.findIndex(function(x){return x.id===id;});
    if(i<0) return Promise.reject('not found');
    Object.assign(this.data.sevas[i], patch);
    var s = this.data.sevas[i];
    return this.save().then(function(){ return s; });
  },
  deleteSeva: function(id){
    this.data.sevas = this.data.sevas.filter(function(x){return x.id!==id;});
    return this.save();
  },
  getSeva: function(id){ return this.data.sevas.find(function(x){return x.id===id;}); },

  sevasOn: function(dateStr){ return this.data.sevas.filter(function(s){return s.date===dateStr;}); },
  sevasBetween: function(from, to){
    return this.data.sevas.filter(function(s){ return s.date>=from && s.date<=to; })
      .sort(function(a,b){ return a.date<b.date?1:a.date>b.date?-1:(b.created||0)-(a.created||0); });
  },

  /* ═══════ BHANDARA CRUD ═══════ */
  addBhandara: function(b){
    b.id = b.id || uid(); b.created = Date.now();
    this.data.bhandaras.push(b);
    return this.save().then(function(){ return b; });
  },
  updateBhandara: function(id, patch){
    var b = this.data.bhandaras.find(function(x){return x.id===id;});
    if(!b) return Promise.reject('not found');
    Object.assign(b, patch);
    return this.save().then(function(){ return b; });
  },
  deleteBhandara: function(id){
    this.data.bhandaras = this.data.bhandaras.filter(function(x){return x.id!==id;});
    return this.save();
  },
  upcomingBhandaras: function(){
    var today = dateStr(new Date());
    return this.data.bhandaras.filter(function(b){return b.date>=today;})
      .sort(function(a,b){return a.date<b.date?-1:1;});
  },

  /* ═══════ STATS ═══════ */
  computeStats: function(){
    var sv = this.data.sevas;
    var days = {}, malas = 0, minutes = 0, byType = {};
    sv.forEach(function(s){
      days[s.date] = (days[s.date]||0)+1;
      minutes += Number(s.minutes)||0;
      if(s.type==='jaap') malas += Number(s.qty)||0;
      byType[s.type] = (byType[s.type]||0)+1;
    });
    var keys = Object.keys(days).sort();
    // current streak (allow today not yet logged → count from yesterday)
    var streak = 0, cur = new Date();
    if(!days[dateStr(cur)]) cur.setDate(cur.getDate()-1);
    while(days[dateStr(cur)]){ streak++; cur.setDate(cur.getDate()-1); }
    // best streak
    var best=0, run=0, prev=null;
    keys.forEach(function(k){
      if(prev && dayDiff(prev,k)===1) run++; else run=1;
      if(run>best) best=run; prev=k;
    });
    return { total:sv.length, days:days, streak:streak, best:best, malas:malas,
             minutes:minutes, hours:Math.round(minutes/6)/10, byType:byType, activeDays:keys.length };
  },

  last7: function(){
    var out=[], st=this.computeStats();
    for(var i=6;i>=0;i--){ var d=new Date(); d.setDate(d.getDate()-i); var k=dateStr(d);
      out.push({date:k, count:st.days[k]||0, label:d}); }
    return out;
  },

  /* ═══════ BACKUP (password-optional) ═══════ */
  exportBackup: async function(password){
    var json = JSON.stringify({app:'satlok-seva', schema:SCHEMA, exported:Date.now(), data:this.data});
    var bytes = new TextEncoder().encode(json);
    var c = await compress(bytes);
    var usePass = !!password;
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var key;
    if(usePass){
      var km = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
      key = await crypto.subtle.deriveKey({name:'PBKDF2', salt:salt, iterations:210000, hash:'SHA-256'},
              km, {name:'AES-GCM', length:256}, false, ['encrypt']);
    }else{ key = await this._key(); }
    var ct = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv:iv, tagLength:128}, key, c.data));
    var out = new Uint8Array(2+16+12+ct.length);
    out[0] = usePass?1:0; out[1] = c.algo; out.set(salt,2); out.set(iv,18); out.set(ct,30);
    return { filename:'satlok-backup-'+dateStr(new Date())+'.satlok',
             content:'SATLOK1:'+b64e(out), size:out.length, raw:bytes.length };
  },

  importBackup: async function(text, password){
    if(text.indexOf('SATLOK1:')!==0) throw new Error('bad file');
    var buf = b64d(text.slice(8).trim());
    var mode=buf[0], algo=buf[1], salt=buf.slice(2,18), iv=buf.slice(18,30), ct=buf.slice(30);
    var key;
    if(mode===1){
      if(!password) throw new Error('need password');
      var km = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
      key = await crypto.subtle.deriveKey({name:'PBKDF2', salt:salt, iterations:210000, hash:'SHA-256'},
              km, {name:'AES-GCM', length:256}, false, ['decrypt']);
    }else{ key = await this._key(); }
    var plain = new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM', iv:iv, tagLength:128}, key, ct));
    var bytes = await decompress(plain, algo);
    var obj = JSON.parse(new TextDecoder().decode(bytes));
    if(!obj.data) throw new Error('bad payload');
    this.data = this._migrate(obj.data);
    await this.save();
    return this.data;
  },

  wipe: async function(){
    this.data = defaultData();
    this.data.settings.onboarded = true;
    await this.save();
  }
};

/* ═══════ helpers ═══════ */
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function utf8Len(s){ return new TextEncoder().encode(s).length; }
function b64e(u8){ var s='',C=0x8000; for(var i=0;i<u8.length;i+=C) s+=String.fromCharCode.apply(null,u8.subarray(i,i+C)); return btoa(s); }
function b64d(b){ var s=atob(b), u=new Uint8Array(s.length); for(var i=0;i<s.length;i++) u[i]=s.charCodeAt(i); return u; }
window.b64e=b64e; window.b64d=b64d; window.uid=uid;

function dateStr(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function dayDiff(a,b){ return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000); }
window.dateStr = dateStr; window.dayDiff = dayDiff;

/* ═══════ compression ═══════
   algo 1 = raw DEFLATE (CompressionStream, Chrome 80+)
   algo 2 = LZ77 fallback  (old WebViews — still real compression)
   algo 0 = stored uncompressed (incompressible payload)            */
async function compress(bytes){
  if(typeof CompressionStream !== 'undefined'){
    try{
      var res = await streamThrough(new CompressionStream('deflate-raw'), bytes);
      if(res.length < bytes.length) return {data:res, algo:1};
    }catch(e){}
  }
  var lz = lzPack(bytes);
  if(lz.length < bytes.length) return {data:lz, algo:2};
  return {data:bytes, algo:0};
}
async function decompress(bytes, algo){
  if(algo === 2) return lzUnpack(bytes);
  if(algo === 1){
    if(typeof DecompressionStream === 'undefined') throw new Error('no inflater');
    return await streamThrough(new DecompressionStream('deflate-raw'), bytes);
  }
  return bytes;
}
async function streamThrough(transform, bytes){
  var w = transform.writable.getWriter(); w.write(bytes); w.close();
  var r = transform.readable.getReader(), chunks=[], n=0;
  while(true){ var x = await r.read(); if(x.done) break; chunks.push(x.value); n += x.value.length; }
  var out = new Uint8Array(n), o=0;
  chunks.forEach(function(c){ out.set(c,o); o += c.length; });
  return out;
}
/* kept for API compatibility */
async function deflate(bytes){ var c = await compress(bytes); return c.algo ? c.data : null; }
async function inflate(bytes){ return (await decompress(bytes, (bytes[0]===0x4c&&bytes[1]===0x5a)?2:1)); }

/* ── LZ77: 32K window, 258-byte matches, 48-candidate hash chain ──
   token map:  0x00        end
               0x01..0x7F  literal run (1..127 bytes follow)
               0x80        extended literal run (u16 len, then bytes)
               0x81..0xFE  match, len = (tok-0x81)+3, then u16 distance
               0xFF        long match, next byte L, len = L+3, then u16 dist */
function lzPack(src){
  var out=[0x4c,0x5a, src.length&255,(src.length>>>8)&255,(src.length>>>16)&255,(src.length>>>24)&255];
  var HB=15, head=new Int32Array(1<<HB).fill(-1), prev=new Int32Array(src.length).fill(-1);
  var i=0, lits=[];
  function hash(p){ return ((src[p]<<10)^(src[p+1]<<5)^src[p+2])&((1<<HB)-1); }
  function flush(){
    var n=lits.length; if(!n) return;
    if(n<=127) out.push(n);
    else { out.push(0x80, n&255, (n>>>8)&255); }
    for(var k=0;k<n;k++) out.push(lits[k]);
    lits.length=0;
  }
  function touch(p){ if(p+2<src.length){ var h=hash(p); prev[p]=head[h]; head[h]=p; } }
  while(i<src.length){
    var bestLen=0, bestDist=0;
    if(i+2<src.length){
      var cand=head[hash(i)], tries=0;
      while(cand>=0 && tries<48 && i-cand<=32767){
        var len=0;
        while(len<258 && i+len<src.length && src[cand+len]===src[i+len]) len++;
        if(len>bestLen){ bestLen=len; bestDist=i-cand; if(len>=258) break; }
        cand=prev[cand]; tries++;
      }
    }
    if(bestLen>=3){
      flush();
      var L=bestLen-3;
      if(L<=125) out.push(0x81+L); else out.push(0xff, L);
      out.push(bestDist&255, (bestDist>>>8)&255);
      for(var k=0;k<bestLen;k++) touch(i+k);
      i+=bestLen;
    }else{
      lits.push(src[i]);
      if(lits.length===65535) flush();
      touch(i); i++;
    }
  }
  flush(); out.push(0);
  return new Uint8Array(out);
}
function lzUnpack(b){
  var p=6, len=(b[2]|(b[3]<<8)|(b[4]<<16)|(b[5]<<24))>>>0;
  var out=new Uint8Array(len), o=0;
  while(p<b.length && o<len){
    var tok=b[p++];
    if(tok===0) break;
    if(tok<=0x7f){ for(var k=0;k<tok&&o<len;k++) out[o++]=b[p++]; }
    else if(tok===0x80){ var n=b[p]|(b[p+1]<<8); p+=2; for(var k2=0;k2<n&&o<len;k2++) out[o++]=b[p++]; }
    else{
      var mlen = (tok===0xff) ? (b[p++]+3) : ((tok-0x81)+3);
      var dist=b[p]|(b[p+1]<<8); p+=2;
      if(dist<=0||dist>o) throw new Error('corrupt LZ stream');
      for(var k3=0;k3<mlen&&o<len;k3++){ out[o]=out[o-dist]; o++; }
    }
  }
  if(o!==len) throw new Error('LZ length mismatch');
  return out;
}
window.lzPack=lzPack; window.lzUnpack=lzUnpack;

window.Store = Store;
})();
