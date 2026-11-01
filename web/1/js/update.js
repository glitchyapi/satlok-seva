/* ═══════════════════════════════════════════════════════════
   UPDATE — universal-URL manifest → file-level delta OTA
   ─────────────────────────────────────────────────────────
   Two independent tracks:
     • WEB track  (webVersion)  → hot-swap changed UI files,
                                  no reinstall, instant.
     • APK track  (versionCode) → native changes; download
                                  signed APK + system install.
   Every file is SHA-256 verified before commit. Commit is
   atomic; if the new bundle fails to confirm boot, the shell
   rolls back to the previous bundle automatically.
   ═══════════════════════════════════════════════════════════ */
(function(){
'use strict';

var CFG_KEY = 'satlok.update.cfg';
var DEFAULT_SOURCES = [
  'https://glitchyapi.github.io/satlok-seva/manifest.json',
  'https://raw.githubusercontent.com/glitchyapi/satlok-seva/main/release/manifest.json'
];

var Update = {
  config:{ sources:DEFAULT_SOURCES.slice(), channel:'stable', autoCheck:true, lastCheck:0, dismissed:'' },
  manifest:null,
  decision:null,
  busy:false,
  lastError:null,
  onProgress:null,
  onDecision:null,

  loadConfig:function(){
    try{
      var raw = localStorage.getItem(CFG_KEY);
      if(raw) Object.assign(this.config, JSON.parse(raw));
    }catch(e){}
    // build-time config shipped inside the bundle can override defaults
    if(window.APP_CONFIG && Array.isArray(APP_CONFIG.updateSources) && APP_CONFIG.updateSources.length){
      if(!localStorage.getItem(CFG_KEY)) this.config.sources = APP_CONFIG.updateSources.slice();
    }
    return this.config;
  },
  saveConfig:function(){ try{ localStorage.setItem(CFG_KEY, JSON.stringify(this.config)); }catch(e){} },

  setSources:function(list){
    this.config.sources = list.filter(Boolean);
    this.saveConfig();
  },

  /* ── fetch with multi-source failover ── */
  _get:async function(url){
    if(window.Native && Native.available){
      var r = Native.httpGet(url);
      if(r && r.status>=200 && r.status<300 && r.body) return r.body;
      if(r && r.status) throw new Error('HTTP '+r.status);
    }
    var res = await fetch(url, {cache:'no-store', headers:{'Cache-Control':'no-cache'}});
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.text();
  },

  fetchManifest:async function(){
    var errs=[];
    for(var i=0;i<this.config.sources.length;i++){
      var url=this.config.sources[i];
      try{
        var txt = await this._get(url);
        var m = JSON.parse(txt);
        if(!m || !m.latest) throw new Error('bad manifest shape');
        m.__source = url;
        this.manifest = m;
        this.lastError = null;
        return m;
      }catch(e){ errs.push(url+' → '+e.message); }
    }
    this.lastError = errs.join(' | ');
    throw new Error(this.lastError || 'no source');
  },

  /* ── decide what (if anything) to do ── */
  evaluate:function(m){
    m = m || this.manifest;
    if(!m) return {kind:'none'};
    var info = Native.info();
    var ota  = (Native.available && Native.otaState()) || {webVersion:0};
    var L = m.latest;
    var curAPK = Number(info.versionCode)||1;
    var curWeb = Number(ota.webVersion)||Number(window.WEB_VERSION)||0;

    // channel gate
    if(m.channel && this.config.channel && m.channel!==this.config.channel && !L.channels) return {kind:'none', reason:'channel'};

    var forced = !!L.mandatory || (m.minVersionCode && curAPK < Number(m.minVersionCode));

    if(Number(L.versionCode) > curAPK && L.apk && L.apk.url){
      return { kind:'apk', forced:forced, version:L.versionName, versionCode:L.versionCode,
               size:L.apk.size||0, sha256:L.apk.sha256||'', url:L.apk.url, notes:L.notes||{}, releasedAt:L.releasedAt };
    }
    if(L.web && Number(L.web.version) > curWeb){
      return { kind:'web', forced:forced, version:L.versionName||('web '+L.web.version), webVersion:Number(L.web.version),
               web:L.web, notes:L.notes||{}, releasedAt:L.releasedAt, curWeb:curWeb };
    }
    return {kind:'none', curAPK:curAPK, curWeb:curWeb};
  },

  /* ── main check ── */
  check:async function(opts){
    opts = opts||{};
    if(this.busy) return null;
    this.busy = true;
    var out;
    try{
      var m = await this.fetchManifest();
      this.config.lastCheck = Date.now(); this.saveConfig();
      out = this.evaluate(m);
      this.decision = out;

      if(out.kind!=='none'){
        var ver = out.version||'';
        if(Store.data.settings.updNotif !== false && this.config.dismissed !== ver){
          Native.notify(9001, t('upd.notifTitle'), t('upd.notifBody',{v:ver}), 'update');
        }
      }
      this.handleBroadcast(m.broadcast);
      if(this.onDecision) this.onDecision(out, m);
    }catch(e){
      this.lastError = e.message;
      out = {kind:'error', error:e.message};
      if(this.onDecision) this.onDecision(out, null);
    }
    this.busy = false;
    return out;
  },

  /* ── compute the delta: only files whose hash differs ── */
  computeDelta:function(web){
    var local = {};
    var st = (Native.available && Native.otaState()) || null;
    if(st && st.manifest && Array.isArray(st.manifest.files)){
      st.manifest.files.forEach(function(f){ local[f.path] = f.sha256; });
    }else if(window.BUNDLE_MANIFEST && Array.isArray(BUNDLE_MANIFEST.files)){
      BUNDLE_MANIFEST.files.forEach(function(f){ local[f.path] = f.sha256; });
    }
    var changed=[], kept=[], total=0;
    (web.files||[]).forEach(function(f){
      if(local[f.path] === f.sha256){ kept.push(f); }
      else { changed.push(f); total += Number(f.size)||0; }
    });
    var remotePaths = {}; (web.files||[]).forEach(function(f){ remotePaths[f.path]=1; });
    var removed = Object.keys(local).filter(function(p){ return !remotePaths[p]; });
    return {changed:changed, kept:kept, removed:removed, bytes:total, totalFiles:(web.files||[]).length};
  },

  /* ── apply a WEB delta ── */
  applyWeb:async function(dec){
    var self=this, web=dec.web;
    var delta = this.computeDelta(web);
    if(!Native.available) throw new Error('OTA needs the Android shell');
    if(!delta.changed.length && !delta.removed.length){
      // hashes all match — just bump the recorded version
      Native.otaCommit(String(dec.webVersion), JSON.stringify(web));
      return {ok:true, files:0, bytes:0, restart:true};
    }
    var begin = Native.otaBegin(String(dec.webVersion));
    if(!begin || !begin.ok) throw new Error((begin&&begin.error)||'staging failed');

    var done=0, bytes=0, n=delta.changed.length;
    for(var i=0;i<n;i++){
      var f = delta.changed[i];
      var url = f.url || joinUrl(web.baseUrl, f.path);
      self._progress('download', (i/n)*0.9, t('upd.downloading')+' '+(i+1)+'/'+n, f.path);
      var r;
      try{ r = await Native.task('otaFetch', {url:url, path:f.path, sha:f.sha256||''}); }
      catch(err){ Native.otaRollback(); throw new Error(err.message || ('failed: '+f.path)); }
      if(r.verified === false){ Native.otaRollback(); throw new Error(t('upd.badSig')+' ('+f.path+')'); }
      bytes += Number(r.size)||0; done++;
      self._progress('download', (done/n)*0.9, t('upd.downloading')+' '+done+'/'+n, f.path);
    }
    self._progress('verify', .93, t('upd.verifying'));
    var commit = Native.otaCommit(String(dec.webVersion), JSON.stringify(web));
    if(!commit || !commit.ok){ Native.otaRollback(); throw new Error((commit&&commit.error)||'commit failed'); }
    self._progress('done', 1, t('upd.done'));
    self.config.dismissed=''; self.saveConfig();
    return {ok:true, files:done, bytes:bytes, restart:true, removed:delta.removed.length};
  },

  /* ── apply an APK update ── */
  applyApk:async function(dec){
    var self=this;
    if(!Native.available) throw new Error('APK update needs the Android shell');
    if(!Native.canInstall()){
      Native.requestPermission('install');
      throw new Error(t('upd.permission'));
    }
    self._progress('download', 0, t('upd.downloading'));
    Native.on('downloadProgress', function(p){
      var frac = p.total>0 ? p.read/p.total : 0;
      self._progress('download', frac*0.9, t('upd.downloading')+' '+fmtBytes(p.read)+(p.total?' / '+fmtBytes(p.total):''));
    });
    var o = await Native.task('downloadApk', {url:dec.url, sha:dec.sha256||''});
    if(!o || !o.ok) throw new Error((o&&o.error)||'download failed');
    self._progress('verify', .95, t('upd.verifying'));
    if(o.verified === false) throw new Error(t('upd.badSig'));
    self._progress('install', 1, t('upd.apkPrompt'));
    Native.installApk(o.path);
    return {ok:true, installing:true, bytes:o.size||0};
  },

  apply:async function(dec){
    dec = dec || this.decision;
    if(!dec || dec.kind==='none') return {ok:false, reason:'nothing to do'};
    if(dec.kind==='web') return await this.applyWeb(dec);
    if(dec.kind==='apk') return await this.applyApk(dec);
    return {ok:false};
  },

  _progress:function(phase, frac, label, detail){
    if(this.onProgress) this.onProgress({phase:phase, frac:Math.max(0,Math.min(1,frac)), label:label, detail:detail});
  },

  dismiss:function(){
    if(this.decision && this.decision.version){ this.config.dismissed=this.decision.version; this.saveConfig(); }
  },

  /* ── admin broadcast → device notification, no app update needed ── */
  handleBroadcast:function(b){
    if(!b || !b.enabled || !b.id) return;
    if(b.expires && new Date(b.expires).getTime() < Date.now()) return;
    if(Store.data.settings.updNotif === false) return;
    var seen = Store.data.meta.lastBroadcast;
    if(seen === b.id) return;
    var lang = Store.data.settings.lang || 'hi';
    var body = (b.body && (b.body[lang] || b.body.en || b.body.hi)) || '';
    if(!b.title && !body) return;
    Native.notify(9002, b.title || t('app.name'), body, 'event');
    Store.data.meta.lastBroadcast = b.id;
    Store.data.meta.broadcast = {title:b.title, body:body, style:b.style||'info', url:b.url||'', at:Date.now()};
    Store.save().catch(function(){});
    window.dispatchEvent(new CustomEvent('satlok:broadcast', {detail:b}));
  },

  /* ── boot handshake: confirms the running bundle is healthy ── */
  confirmBoot:function(){
    if(Native.available) Native.otaConfirmBoot();
  }
};

function joinUrl(base, path){
  if(!base) return path;
  return base.replace(/\/+$/,'')+'/'+String(path).replace(/^\/+/,'');
}
function fmtBytes(n){
  n=Number(n)||0;
  if(n<1024) return n+' B';
  if(n<1048576) return (n/1024).toFixed(1)+' KB';
  return (n/1048576).toFixed(2)+' MB';
}
window.fmtBytes = fmtBytes;
window.Update = Update;
})();
