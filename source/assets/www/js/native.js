/* ═══════════════════════════════════════════════════════════
   NATIVE BRIDGE — thin, defensive wrapper over the Java
   @JavascriptInterface object. Every call degrades gracefully
   in a plain browser so the UI is testable without Android.
   ═══════════════════════════════════════════════════════════ */
(function(){
'use strict';
var B = window.SatlokNative || null;

function call(method){
  var args = Array.prototype.slice.call(arguments,1);
  if(!B || typeof B[method] !== 'function') return null;
  try{ return B[method].apply(B, args); }
  catch(e){ console.warn('[native] '+method+' failed', e); return null; }
}
function jcall(method){
  var r = call.apply(null, arguments);
  if(r === null || r === undefined || r === '') return null;
  try{ return JSON.parse(r); }catch(e){ console.warn('[native] bad JSON from '+method, r); return null; }
}

var Native = {
  available: !!B,

  info: function(){
    var i = jcall('getAppInfo');
    return i || { versionName:'1.0.0', versionCode:1, packageName:'org.satlok.seva',
                  sdk:0, androidVersion:'browser', webviewVersion:'web', abi:'-', debug:true, browser:true };
  },

  /* ── secure storage ── */
  secureRead:  function(){ return call('secureRead'); },
  secureWrite: function(json){ return call('secureWrite', json); },
  secureWipe:  function(){ return call('secureWipe'); },

  /* ── notifications ── */
  notify: function(id, title, body, tag){ return call('notify', id|0, String(title), String(body), String(tag||'general')); },
  hasNotifPermission: function(){
    if(!B) return (typeof Notification!=='undefined' && Notification.permission==='granted');
    return !!call('hasNotifPermission');
  },
  requestNotifPermission: function(){
    if(!B){ if(typeof Notification!=='undefined') Notification.requestPermission(); return; }
    return call('requestNotifPermission');
  },
  cancelNotification: function(tag){ return call('cancelNotification', String(tag)); },
  scheduleReminder: function(h, m, on){ return call('scheduleReminder', h|0, m|0, !!on); },
  scheduleEvent: function(id, ts, title, body){ return call('scheduleEvent', String(id), Number(ts), String(title), String(body)); },
  cancelEvent: function(id){ return call('cancelEvent', String(id)); },

  /* ── permissions ── */
  permissions: function(){
    return jcall('getPermissions') || { notif:false, storage:true, install:false, exactAlarm:false, sdk:0 };
  },
  requestPermission: function(kind){ return call('requestPermission', String(kind)); },
  openSettings: function(kind){ return call('openSettings', String(kind||'app')); },

  /* ── files & sharing ── */
  saveImage: function(b64, filename){ return jcall('saveImage', String(b64), String(filename)); },
  shareImage: function(b64, filename, text){ return jcall('shareImage', String(b64), String(filename), String(text||'')); },
  saveText: function(content, filename, mime){ return jcall('saveText', String(content), String(filename), String(mime||'application/octet-stream')); },
  shareText: function(text){ return call('shareText', String(text)); },
  pickFile: function(reqId){ return call('pickFile', String(reqId)); },

  /* ── networking (native avoids CORS + gives progress) ── */
  httpGet: function(url){ return jcall('httpGet', String(url)); },
  downloadApk: function(url, sha256){ return call('downloadApk', String(url), String(sha256||'')); },
  installApk: function(path){ return call('installApk', String(path||'')); },
  canInstall: function(){ return !!call('canInstall'); },

  /* ── OTA (file-level hot update) ── */
  otaState:    function(){ return jcall('otaState'); },
  otaBegin:    function(v){ return jcall('otaBegin', String(v)); },
  otaFetch:    function(url, relPath, sha){ return jcall('otaFetch', String(url), String(relPath), String(sha||'')); },
  otaCommit:   function(v, manifestJson){ return jcall('otaCommit', String(v), String(manifestJson)); },
  otaRollback: function(){ return jcall('otaRollback'); },
  otaConfirmBoot: function(){ return call('otaConfirmBoot'); },
  otaReset:    function(){ return jcall('otaReset'); },

  /* ── misc ── */
  vibrate: function(ms){ return call('vibrate', ms|0); },
  restart: function(){ return call('restartApp'); },
  exit: function(){ return call('exitApp'); },
  log: function(tag, msg){ return call('log', String(tag), String(msg)); },
  setStatusBar: function(hex, darkIcons){ return call('setStatusBar', String(hex), !!darkIcons); },
  keepAwake: function(on){ return call('keepAwake', !!on); }
};

/* ── async task API: long native ops run off the JS thread ── */
var pendingTasks = {};
Native.task = function(op, args){
  return new Promise(function(resolve, reject){
    if(!B || typeof B.startTask !== 'function'){ reject(new Error('native tasks unavailable')); return; }
    var reqId = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
    var timer = setTimeout(function(){
      if(pendingTasks[reqId]){ delete pendingTasks[reqId]; reject(new Error('task timeout: '+op)); }
    }, 8*60*1000);
    pendingTasks[reqId] = function(res){
      clearTimeout(timer);
      if(res && res.ok) resolve(res); else reject(new Error((res && res.error) || (op+' failed')));
    };
    try{
      var r = B.startTask(reqId, op, JSON.stringify(args||{}));
      var o = typeof r === 'string' ? JSON.parse(r) : r;
      if(!o || !o.ok){ clearTimeout(timer); delete pendingTasks[reqId]; reject(new Error((o&&o.error)||'start failed')); }
    }catch(e){ clearTimeout(timer); delete pendingTasks[reqId]; reject(e); }
  });
};

/* ── event bus: Java → JS ── */
var listeners = {};
Native.on = function(evt, fn){ (listeners[evt] = listeners[evt]||[]).push(fn); return Native; };
Native.off = function(evt, fn){ if(listeners[evt]) listeners[evt] = listeners[evt].filter(function(f){return f!==fn;}); };
window.SatlokEvent = function(name, payload){
  var data = payload;
  if(typeof payload === 'string'){ try{ data = JSON.parse(payload); }catch(e){ data = {raw:payload}; } }
  if(name === 'task' && data && data.reqId && pendingTasks[data.reqId]){
    var cb = pendingTasks[data.reqId]; delete pendingTasks[data.reqId]; cb(data); return;
  }
  (listeners[name]||[]).forEach(function(fn){ try{ fn(data); }catch(e){ console.error('[event:'+name+']', e); } });
  window.dispatchEvent(new CustomEvent('satlok:'+name, {detail:data}));
};

/* browser fallback for file picking (used in preview/testing) */
if(!B){
  Native.pickFile = function(reqId){
    var el = document.getElementById('filePick');
    if(!el) return;
    el.onchange = function(){
      var f = el.files && el.files[0]; if(!f) return;
      var r = new FileReader();
      r.onload = function(){ window.SatlokEvent('filePicked', {reqId:reqId, content:r.result, name:f.name}); };
      r.readAsText(f); el.value='';
    };
    el.click();
  };
  Native.saveText = function(content, filename){
    var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([content],{type:'application/octet-stream'}));
    a.download=filename; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);},4000);
    return {ok:true, path:filename};
  };
  Native.saveImage = function(b64, filename){
    var a=document.createElement('a'); a.href='data:image/png;base64,'+b64; a.download=filename; a.click();
    return {ok:true, path:filename};
  };
  Native.shareImage = function(b64, filename, text){
    return Promise.resolve(Native.saveImage(b64, filename));
  };
  Native.shareText = function(text){
    if(navigator.share) navigator.share({text:text}).catch(function(){});
    else if(navigator.clipboard) navigator.clipboard.writeText(text);
    return true;
  };
  Native.vibrate = function(ms){ if(navigator.vibrate) navigator.vibrate(ms); };
  Native.restart = function(){ location.reload(); };
}

window.Native = Native;
})();
