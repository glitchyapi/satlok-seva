/* ═══════════════════════════════════════════════════════════
   APP — screens, navigation, rendering, lifecycle
   ═══════════════════════════════════════════════════════════ */
(function(){
'use strict';

var $=function(s,r){return (r||document).querySelector(s);};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};

var TYPES=[
  {id:'jaap',     emo:'📿', color:'#FFF1E3', unit:'mala',    defQty:1,  defMin:20},
  {id:'satsang',  emo:'🎧', color:'#E8F1FF', unit:'session', defQty:1,  defMin:45},
  {id:'paath',    emo:'📖', color:'#EDE9FE', unit:'page',    defQty:5,  defMin:20},
  {id:'seva',     emo:'🙌', color:'#DCFCE7', unit:'task',    defQty:1,  defMin:30},
  {id:'bhandara', emo:'🎪', color:'#FEE7EF', unit:'help',    defQty:1,  defMin:60},
  {id:'daan',     emo:'🤲', color:'#FEF3C7', unit:'time',    defQty:1,  defMin:5},
  {id:'sangat',   emo:'👥', color:'#E0F2FE', unit:'task',    defQty:1,  defMin:30},
  {id:'prachar',  emo:'📣', color:'#FFE4E6', unit:'count',   defQty:1,  defMin:20},
  {id:'other',    emo:'✨', color:'#F1F5F9', unit:'count',   defQty:1,  defMin:15}
];
var QUICK=TYPES.slice(0,8);
var TYPE_COLORS={jaap:'#F97316',satsang:'#2E90FA',paath:'#8B5CF6',seva:'#12B76A',
                 bhandara:'#EC4899',daan:'#F59E0B',sangat:'#0EA5E9',prachar:'#F43F5E',other:'#64748B'};

var VERSES=[
  {hi:'सतगुरु मिले तो जागिए, दुविधा भागे दूर।',en:'When the true Guru is met, one awakens and doubt flees far away.',pa:'ਸਤਿਗੁਰੂ ਮਿਲੇ ਤਾਂ ਜਾਗੀਏ, ਦੁਬਿਧਾ ਭੱਜੇ ਦੂਰ।'},
  {hi:'सेवा से बड़ा कोई धर्म नहीं, सत भक्ति से बड़ा कोई कर्म नहीं।',en:'No duty is greater than service; no act greater than true devotion.',pa:'ਸੇਵਾ ਤੋਂ ਵੱਡਾ ਕੋਈ ਧਰਮ ਨਹੀਂ, ਸਤ ਭਗਤੀ ਤੋਂ ਵੱਡਾ ਕੋਈ ਕਰਮ ਨਹੀਂ।'},
  {hi:'कबीरा खड़ा बाज़ार में, लिए लुकाठी हाथ। जो घर फूँके आपना, चले हमारे साथ।',en:'Kabir stands in the marketplace, torch in hand: one who burns their own ego, come walk with me.',pa:'ਕਬੀਰਾ ਖੜਾ ਬਾਜ਼ਾਰ ਵਿੱਚ, ਲਈ ਲੁਕਾਠੀ ਹਾਥ। ਜੋ ਘਰ ਫੂਕੇ ਆਪਣਾ, ਚਲੇ ਹਮਾਰੇ ਸਾਥ।'},
  {hi:'नाम जपत मन शांत है, सेवा से सुख होय।',en:'Chanting the Naam brings peace to the mind; through service, joy arises.',pa:'ਨਾਮ ਜਪਦਿਆਂ ਮਨ ਸ਼ਾਂਤ ਹੈ, ਸੇਵਾ ਨਾਲ ਸੁਖ ਹੋਏ।'},
  {hi:'गुरु कुम्हार शिष्य कुंभ है, गढ़ि गढ़ि काढ़ै खोट।',en:'The Guru is the potter, the disciple the clay — shaping again and again, removing every flaw.',pa:'ਗੁਰੂ ਕੁਮ੍ਹਾਰ ਸਿੱਖ ਕੁੰਭ ਹੈ, ਗੜ੍ਹਿ ਗੜ੍ਹਿ ਕਾਢੈ ਖੋਟ।'},
  {hi:'बड़ा हुआ तो क्या हुआ, जैसे पेड़ खजूर। पंथी को छाया नहीं, फल लागे अति दूर।',en:'What use is greatness, like the date palm — no shade for the traveller, its fruit hangs too high.',pa:'ਵੱਡਾ ਹੋਇਆ ਤਾਂ ਕੀ ਹੋਇਆ, ਜਿਵੇਂ ਪੇੜ ਖਜੂਰ। ਪਾਂਧੀ ਨੂੰ ਛਾਂ ਨਹੀਂ, ਫਲ ਲੱਗੇ ਅਤਿ ਦੂਰ।'}
];

var ACHIEVEMENTS=[
  {id:'first', emo:'🌱', key:'ach.first',    test:function(s){return s.total>=1;}},
  {id:'week',  emo:'🔥', key:'ach.week',     test:function(s){return s.best>=7;}},
  {id:'month', emo:'🏆', key:'ach.month',    test:function(s){return s.best>=30;}},
  {id:'fifty', emo:'⭐', key:'ach.fifty',    test:function(s){return s.total>=50;}},
  {id:'hundred',emo:'💎',key:'ach.hundred',  test:function(s){return s.total>=100;}},
  {id:'mala108',emo:'📿',key:'ach.mala108',  test:function(s){return s.malas>=108;}}
];

var App={
  screen:'home', sevaRange:'today', bhanTab:'events',
  filterType:null, search:'', editId:null, addType:'jaap', pickCb:null, infoCb:null,
  pendingRestore:null, booted:false
};

/* ═══════════ BOOT ═══════════ */
document.addEventListener('DOMContentLoaded', boot);

async function boot(){
  var t0=Date.now();
  Update.loadConfig();
  await Store.init();

  // build-time config
  if(window.APP_CONFIG){
    if(APP_CONFIG.defaultLang && !Store.data.settings.onboarded) Store.data.settings.lang=APP_CONFIG.defaultLang;
  }
  applyTheme(Store.data.settings.theme);
  applyI18n();

  var minSplash = 1250;
  var wait = Math.max(0, minSplash-(Date.now()-t0));
  setTimeout(function(){
    $('#splash').classList.add('out');
    setTimeout(function(){ $('#splash').classList.add('hidden'); }, 520);
    if(!Store.data.settings.onboarded) showOnboarding();
    else startApp();
  }, wait);
}

function showOnboarding(){
  $('#onboarding').classList.remove('hidden');
  var idx=0;
  function go(i){
    idx=i;
    $$('.ob-slide').forEach(function(s,k){ s.classList.toggle('active',k===i); });
    $$('.ob-dots i').forEach(function(d,k){ d.classList.toggle('on',k===i); });
    $('#obSkip').style.visibility = i===2 ? 'hidden':'visible';
    $('#obNext').querySelector('span').textContent = i===2 ? t('common.done') : t('common.next');
  }
  $$('#obLangs .lang-chip').forEach(function(b){
    b.onclick=function(){
      $$('#obLangs .lang-chip').forEach(function(x){x.classList.remove('on');});
      b.classList.add('on');
      Store.data.settings.lang=b.getAttribute('data-lang');
      applyI18n(); go(idx);
    };
  });
  $('#obNext').onclick=function(){
    if(idx<2){ go(idx+1); return; }
    finish();
  };
  $('#obSkip').onclick=finish;
  function finish(){
    Store.data.settings.name = ($('#obName').value||'').trim();
    Store.data.settings.onboarded = true;
    Store.save().then(function(){
      $('#onboarding').classList.add('hidden');
      startApp();
      toast(t('ob.ready'),'ok');
    });
  }
  go(0);
}

function startApp(){
  $('#app').classList.remove('hidden');
  buildTypes(); buildQuickGrid(); buildTemplates();
  wireNav(); wireSheets(); wireSettings(); wireBanner(); wireUpdate();
  renderAll();
  App.booted=true;
  Update.confirmBoot();
  syncPermissionUI();

  // background update check (non-blocking)
  setTimeout(function(){
    if(Update.config.autoCheck!==false){
      Update.check().then(function(d){
        if(d && d.kind!=='none' && d.kind!=='error'){
          if(d.forced || Update.config.dismissed!==d.version) showUpdateModal(d);
        }
      });
    }
  }, 1400);
}

/* ═══════════ NAVIGATION ═══════════ */
function wireNav(){
  $$('[data-goto]').forEach(function(b){
    b.onclick=function(){
      var to=b.getAttribute('data-goto');
      if(to==='add'){ openAdd(); return; }
      go(to);
    };
  });
  $('#btnAvatar').onclick=function(){ go('settings'); };
  $('#btnNotif').onclick=showNotifications;
  $('#fabAdd').onclick=function(){ openAdd(); };
  $('#heroAdd').onclick=function(){ openAdd(); };
  $('#btnSearch').onclick=function(){
    $('#searchBar').classList.toggle('hidden');
    if(!$('#searchBar').classList.contains('hidden')) $('#searchInput').focus();
    else { $('#searchInput').value=''; App.search=''; renderSeva(); }
  };
  $('#searchInput').oninput=function(e){ App.search=e.target.value.toLowerCase(); renderSeva(); };
  $('#btnFilter').onclick=showFilter;
  $('#btnNewBhan').onclick=function(){ openBhanSheet(); };
  $('#btnExport').onclick=doBackup;

  $$('#sevaSeg button').forEach(function(b){
    b.onclick=function(){
      $$('#sevaSeg button').forEach(function(x){x.classList.remove('on');});
      b.classList.add('on'); App.sevaRange=b.getAttribute('data-range'); renderSeva();
    };
  });
  $$('#bhanSeg button').forEach(function(b){
    b.onclick=function(){
      $$('#bhanSeg button').forEach(function(x){x.classList.remove('on');});
      b.classList.add('on'); App.bhanTab=b.getAttribute('data-tab');
      $('#bhanEvents').classList.toggle('hidden',App.bhanTab!=='events');
      $('#bhanBanner').classList.toggle('hidden',App.bhanTab!=='banner');
      if(App.bhanTab==='banner') drawBanner();
    };
  });

  // hardware back
  window.SatlokBack=function(){
    if($('.sheet.on')){ closeSheets(); return true; }
    if($('#updateModal').classList.contains('on')){
      if(Update.decision && Update.decision.forced) return false;
      closeUpdateModal(); return true;
    }
    if(App.screen!=='home'){ go('home'); return true; }
    return false;
  };
}

function go(name){
  if(name===App.screen) return;
  var cur=$('#scr-'+App.screen), next=$('#scr-'+name);
  if(!next) return;
  if(cur) cur.classList.remove('active');
  next.classList.add('active');
  App.screen=name;
  $$('.tab').forEach(function(t){ t.classList.toggle('on', t.getAttribute('data-goto')===name); });
  var sa=$('.scroll-area',next); if(sa) sa.scrollTop=0;
  Native.vibrate(8);
  if(name==='stats') renderStats();
  if(name==='settings') renderSettings();
  if(name==='bhandara') renderBhandaras();
  if(name==='seva') renderSeva();
}

/* ═══════════ RENDER ═══════════ */
function renderAll(){ renderHome(); renderSeva(); renderBhandaras(); renderStats(); renderSettings(); }

function lang(){ return Store.data.settings.lang||'hi'; }
function typeName(id){ return t('type.'+id); }
function typeUnit(id){ var T=TYPES.find(function(x){return x.id===id;}); return t('unit.'+(T?T.unit:'count')); }
function typeOf(id){ return TYPES.find(function(x){return x.id===id;})||TYPES[TYPES.length-1]; }

function fmtDay(iso){
  var today=dateStr(new Date());
  if(iso===today) return t('range.today');
  var y=new Date(); y.setDate(y.getDate()-1);
  if(iso===dateStr(y)) return lang()==='en'?'Yesterday':(lang()==='pa'?'ਕੱਲ੍ਹ':'कल');
  try{ return new Date(iso+'T00:00:00').toLocaleDateString(LANG_LOCALE[lang()],{day:'numeric',month:'short',year:'numeric'}); }
  catch(e){ return iso; }
}

function renderHome(){
  var s=Store.data.settings, st=Store.computeStats(), today=dateStr(new Date());
  var todayCount=Store.sevasOn(today).length;
  var goal=Math.max(1,Number(s.goal)||3);
  var pct=Math.min(100,Math.round(todayCount/goal*100));

  $('#homeName').textContent = s.name || (lang()==='en'?'Bhagat Ji':(lang()==='pa'?'ਭਗਤ ਜੀ':'भगत जी'));
  $('#avatarLetter').textContent = (s.name||'भ').trim().charAt(0).toUpperCase();
  try{ $('#todayDate').textContent=new Date().toLocaleDateString(LANG_LOCALE[lang()],{day:'numeric',month:'short'}); }
  catch(e){ $('#todayDate').textContent=today; }
  $('#streakChip').textContent='🔥 '+st.streak;
  $('#ringPct').textContent=pct+'%';
  $('#ringFg').style.strokeDashoffset = String(327-(327*pct/100));
  $('#goalLine').textContent = todayCount===0 ? t('home.noSeva')
      : (todayCount>=goal ? t('home.goalDone') : todayCount+' '+t('home.of')+' '+goal+' — '+t('home.goalLeft',{n:goal-todayCount}));
  $('#stTotal').textContent=st.total; $('#stStreak').textContent=st.streak; $('#stJaap').textContent=st.malas;

  // upcoming
  var up=Store.upcomingBhandaras();
  var w=$('#upcomingWrap');
  if(up.length){ w.innerHTML=bhanHero(up[0]); wireBhanHero(w); }
  else{
    w.innerHTML='<div class="card" style="text-align:center;padding:20px 16px;margin-bottom:22px">'+
      '<div style="font-size:30px;margin-bottom:7px">🎪</div>'+
      '<b style="font-size:14px;display:block;margin-bottom:4px">'+t('home.noBhan')+'</b>'+
      '<button class="btn btn-outline btn-sm" id="homeAddBhan" style="margin-top:10px">'+t('home.addBhan')+'</button></div>';
    var b=$('#homeAddBhan'); if(b) b.onclick=function(){ openBhanSheet(); };
  }

  // recent
  var recent=Store.data.sevas.slice().sort(function(a,b){
    return a.date<b.date?1:a.date>b.date?-1:(b.created||0)-(a.created||0); }).slice(0,4);
  $('#recentList').innerHTML = recent.length ? recent.map(sevaItem).join('') : emptyBlock('🪔',t('seva.empty'),t('seva.emptyDesc'));
  wireSevaItems($('#recentList'));

  var v=VERSES[new Date().getDate()%VERSES.length];
  $('#verseText').textContent=v[lang()]||v.hi;
  $('#verseSrc').textContent=t('verse.src');
}

function bhanHero(b){
  var days=dayDiff(dateStr(new Date()),b.date);
  var when = days===0?t('bhan.today'):days===1?t('bhan.tomorrow'):t('bhan.inDays',{n:days});
  return '<div class="bhan-hero" data-bhan="'+b.id+'">'+
    '<div class="bhan-hero-bg"></div><div class="bhan-hero-in">'+
    '<div class="bh-top"><h4>'+esc(b.title)+'</h4><span class="countdown">'+when+'</span></div>'+
    '<div class="bh-meta">'+
      '<span>📅 '+esc(Banner.fmtDate(b.date,lang()))+'</span>'+
      (b.time?'<span>🕐 '+esc(Banner.fmtTime(b.time,lang()))+'</span>':'')+
      (b.venue?'<span>📍 '+esc(b.venue)+'</span>':'')+
    '</div>'+
    '<div class="bh-actions">'+
      '<button class="btn btn-light btn-sm" data-mkbanner="'+b.id+'">🎨 '+t('bhan.makeBanner')+'</button>'+
      '<button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff" data-sharebhan="'+b.id+'">'+t('common.share')+'</button>'+
    '</div></div></div>';
}
function wireBhanHero(root){
  $$('[data-mkbanner]',root).forEach(function(b){
    b.onclick=function(e){ e.stopPropagation(); loadBhanToBanner(b.getAttribute('data-mkbanner')); };
  });
  $$('[data-sharebhan]',root).forEach(function(b){
    b.onclick=function(e){ e.stopPropagation(); shareBhanText(b.getAttribute('data-sharebhan')); };
  });
}

function sevaItem(s){
  var T=typeOf(s.type);
  return '<div class="seva-item" data-seva="'+s.id+'">'+
    '<div class="si-emo" style="background:'+T.color+'">'+T.emo+'</div>'+
    '<div class="si-body"><b>'+esc(typeName(s.type))+'</b>'+
    '<small>'+esc(fmtDay(s.date))+(s.minutes?' · '+s.minutes+' '+t('seva.minutes'):'')+(s.place?' · '+esc(s.place):'')+'</small></div>'+
    '<div class="si-right"><span class="si-qty">'+s.qty+'</span><span class="si-unit">'+esc(typeUnit(s.type))+'</span></div>'+
  '</div>';
}
function wireSevaItems(root){
  $$('[data-seva]',root).forEach(function(el){
    el.onclick=function(){ openSevaDetail(el.getAttribute('data-seva')); };
  });
}
function emptyBlock(emo,title,desc){
  return '<div class="empty"><div class="empty-emo">'+emo+'</div><b>'+esc(title)+'</b><p>'+esc(desc)+'</p></div>';
}

function renderSeva(){
  var today=new Date(), from, to=dateStr(today);
  if(App.sevaRange==='today') from=to;
  else if(App.sevaRange==='week'){ var d=new Date(); d.setDate(d.getDate()-6); from=dateStr(d); }
  else if(App.sevaRange==='month'){ var d2=new Date(); d2.setDate(d2.getDate()-29); from=dateStr(d2); }
  else from='0000-00-00';

  var list=Store.sevasBetween(from,to);
  if(App.filterType) list=list.filter(function(s){return s.type===App.filterType;});
  if(App.search){
    var q=App.search;
    list=list.filter(function(s){
      return typeName(s.type).toLowerCase().indexOf(q)>=0 ||
             (s.note||'').toLowerCase().indexOf(q)>=0 || (s.place||'').toLowerCase().indexOf(q)>=0;
    });
  }
  var mins=list.reduce(function(a,s){return a+(Number(s.minutes)||0);},0);
  $('#rangeSummary').innerHTML=
    '<div class="rs-pill"><b>'+list.length+'</b><span>'+t('seva.entries')+'</span></div>'+
    '<div class="rs-pill"><b>'+Math.round(mins/6)/10+'</b><span>'+t('stats.hours')+'</span></div>'+
    '<div class="rs-pill"><b>'+list.filter(function(s){return s.type==='jaap';}).reduce(function(a,s){return a+(Number(s.qty)||0);},0)+'</b><span>'+t('home.malas')+'</span></div>';

  if(!list.length){ $('#sevaList').innerHTML=emptyBlock('🪔',t('seva.empty'),t('seva.emptyDesc')); return; }
  var groups={};
  list.forEach(function(s){ (groups[s.date]=groups[s.date]||[]).push(s); });
  var html='';
  Object.keys(groups).sort().reverse().forEach(function(d){
    html+='<div class="day-head"><b>'+esc(fmtDay(d))+'</b><span>'+t('home.entries',{n:groups[d].length})+'</span></div>';
    html+=groups[d].map(sevaItem).join('');
  });
  $('#sevaList').innerHTML=html;
  wireSevaItems($('#sevaList'));
}

function renderBhandaras(){
  var all=Store.data.bhandaras.slice().sort(function(a,b){return a.date<b.date?1:-1;});
  var el=$('#bhanList');
  if(!all.length){ el.innerHTML=emptyBlock('🎪',t('bhan.empty'),t('bhan.emptyDesc'))+
    '<button class="btn btn-dark btn-block" id="emptyAddBhan">'+t('bhan.newEvent')+'</button>';
    var b=$('#emptyAddBhan'); if(b) b.onclick=function(){openBhanSheet();};
    return; }
  var today=dateStr(new Date());
  el.innerHTML=all.map(function(b){
    var past=b.date<today, days=dayDiff(today,b.date);
    var when=past?t('bhan.past'):days===0?t('bhan.today'):days===1?t('bhan.tomorrow'):t('bhan.inDays',{n:days});
    return '<div class="seva-item" data-bhanopen="'+b.id+'" style="'+(past?'opacity:.6':'')+'">'+
      '<div class="si-emo" style="background:#EDE9FE">🎪</div>'+
      '<div class="si-body"><b>'+esc(b.title)+'</b><small>'+esc(Banner.fmtDate(b.date,lang()))+(b.venue?' · '+esc(b.venue):'')+'</small></div>'+
      '<div class="si-right"><span class="si-qty" style="font-size:11.5px;color:'+(past?'var(--muted)':'var(--brand)')+'">'+esc(when)+'</span></div></div>';
  }).join('');
  $$('[data-bhanopen]',el).forEach(function(x){
    x.onclick=function(){ openBhanDetail(x.getAttribute('data-bhanopen')); };
  });
}

function renderStats(){
  var st=Store.computeStats();
  $('#bsTotal').textContent=st.total; $('#bsBest').textContent=st.best;
  $('#bsMala').textContent=st.malas; $('#bsHours').textContent=st.hours;

  var l7=Store.last7(), max=Math.max(1,Math.max.apply(null,l7.map(function(x){return x.count;})));
  $('#bars7').innerHTML=l7.map(function(d){
    var h=Math.max(4,Math.round(d.count/max*104));
    var lbl; try{ lbl=d.label.toLocaleDateString(LANG_LOCALE[lang()],{weekday:'short'}).slice(0,3); }catch(e){ lbl=d.date.slice(8); }
    return '<div class="bar-col"><div class="bar'+(d.count?'':' zero')+'" style="height:'+h+'px">'+
      (d.count?'<span class="bar-v">'+d.count+'</span>':'')+'</div><span class="bar-l">'+esc(lbl)+'</span></div>';
  }).join('');

  var entries=Object.keys(st.byType).map(function(k){return {id:k,n:st.byType[k]};}).sort(function(a,b){return b.n-a.n;});
  var total=entries.reduce(function(a,x){return a+x.n;},0)||1;
  var off=0, C=2*Math.PI*15.9155;
  var svg='<circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--surface-3)" stroke-width="5.5"></circle>';
  entries.forEach(function(e){
    var frac=e.n/total, len=frac*C;
    svg+='<circle cx="21" cy="21" r="15.9155" fill="none" stroke="'+(TYPE_COLORS[e.id]||'#999')+'" stroke-width="5.5" '+
      'stroke-dasharray="'+len.toFixed(2)+' '+(C-len).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'"></circle>';
    off+=len;
  });
  $('#donut').innerHTML=svg;
  $('#donutTotal').textContent=st.total;
  $('#legend').innerHTML = entries.length ? entries.slice(0,6).map(function(e){
    return '<div class="lg-row"><i class="lg-dot" style="background:'+(TYPE_COLORS[e.id]||'#999')+'"></i>'+
      '<span>'+esc(typeName(e.id))+'</span><b>'+e.n+'</b></div>';
  }).join('') : '<p style="font-size:12.5px;color:var(--muted)">'+t('stats.noData')+'</p>';

  $('#achGrid').innerHTML=ACHIEVEMENTS.map(function(a){
    return '<div class="ach'+(a.test(st)?' got':'')+'"><span class="ach-emo">'+a.emo+'</span><span>'+esc(t(a.key))+'</span></div>';
  }).join('');
}

/* ═══════════ ADD / EDIT SEVA ═══════════ */
function buildTypes(){
  $('#typeGrid').innerHTML=TYPES.map(function(T){
    return '<button class="type-btn'+(T.id===App.addType?' on':'')+'" data-type="'+T.id+'">'+
      '<span class="te">'+T.emo+'</span><span>'+esc(t('type.'+T.id))+'</span></button>';
  }).join('');
  $$('#typeGrid .type-btn').forEach(function(b){
    b.onclick=function(){
      App.addType=b.getAttribute('data-type');
      $$('#typeGrid .type-btn').forEach(function(x){x.classList.toggle('on',x===b);});
      var T=typeOf(App.addType);
      $('#aQtyLbl').textContent=t('add.qty')+' ('+typeUnit(App.addType)+')';
      if(!App.editId){ $('#aQty').value=T.defQty; $('#aMin').value=T.defMin; $('#stVal').textContent=T.defQty; }
      Native.vibrate(8);
    };
  });
}
function buildQuickGrid(){
  $('#quickGrid').innerHTML=QUICK.map(function(T,i){
    return '<button class="q-item" data-quick="'+T.id+'" style="animation-delay:'+(i*35)+'ms">'+
      '<span class="q-emo" style="background:'+T.color+'">'+T.emo+'</span><span>'+esc(t('type.'+T.id))+'</span></button>';
  }).join('');
  $$('#quickGrid [data-quick]').forEach(function(b){
    b.onclick=function(){ openAdd(b.getAttribute('data-quick')); };
  });
}

function openAdd(type,edit){
  App.editId = edit? edit.id : null;
  App.addType = type || (edit&&edit.type) || 'jaap';
  buildTypes();
  var T=typeOf(App.addType);
  $('#sheetAdd').querySelector('h3').textContent = edit? t('add.editTitle') : t('add.title');
  $('#aDate').value = edit? edit.date : dateStr(new Date());
  $('#aQty').value  = edit? edit.qty  : T.defQty;
  $('#aMin').value  = edit? edit.minutes : T.defMin;
  $('#aPlace').value= edit? (edit.place||'') : '';
  $('#aNote').value = edit? (edit.note||'') : '';
  $('#stVal').textContent=$('#aQty').value;
  $('#aQtyLbl').textContent=t('add.qty')+' ('+typeUnit(App.addType)+')';
  openSheet('sheetAdd');
}

function wireSheets(){
  $('#scrim').onclick=closeSheets;
  $$('[data-close]').forEach(function(b){ b.onclick=closeSheets; });
  $('#stPlus').onclick=function(){ var v=Math.max(0,(Number($('#aQty').value)||0)+1); $('#aQty').value=v; $('#stVal').textContent=v; Native.vibrate(8); };
  $('#stMinus').onclick=function(){ var v=Math.max(0,(Number($('#aQty').value)||0)-1); $('#aQty').value=v; $('#stVal').textContent=v; Native.vibrate(8); };
  $('#aQty').oninput=function(){ $('#stVal').textContent=$('#aQty').value||0; };

  $('#btnSaveSeva').onclick=async function(){
    var rec={ type:App.addType, date:$('#aDate').value||dateStr(new Date()),
      qty:Number($('#aQty').value)||0, minutes:Number($('#aMin').value)||0,
      place:$('#aPlace').value.trim(), note:$('#aNote').value.trim() };
    try{
      if(App.editId){ await Store.updateSeva(App.editId,rec); toast(t('seva.updated'),'ok'); }
      else{ await Store.addSeva(rec); toast(t('seva.saved'),'ok'); }
      closeSheets(); renderAll(); Native.vibrate(18);
    }catch(e){ toast('⚠️ '+e.message,'err'); }
  };

  $('#btnSaveBhan').onclick=async function(){
    var title=$('#eTitle').value.trim(), date=$('#eDate').value;
    if(!title||!date){ toast(t('bhan.needTitle'),'err'); return; }
    var rec={title:title,date:date,time:$('#eTime').value,venue:$('#eVenue').value.trim(),
      org:$('#eOrg').value.trim(),phone:$('#ePhone').value.trim(),note:$('#eNote').value.trim()};
    try{
      if(App.editBhanId){
        await Store.updateBhandara(App.editBhanId,rec);
        if($('#eRemind').checked) scheduleBhanReminder(Object.assign({id:App.editBhanId},rec));
      }else{
        var b=await Store.addBhandara(rec);
        if($('#eRemind').checked) scheduleBhanReminder(b);
      }
      App.editBhanId=null;
      closeSheets(); renderAll(); toast(t('bhan.saved'),'ok');
    }catch(e){ toast('⚠️ '+e.message,'err'); }
  };
}

function openBhanSheet(b){
  App.editBhanId = b? b.id : null;
  $('#sheetBhan').querySelector('h3').textContent = b? t('common.edit') : t('bhan.newEvent');
  $('#eTitle').value=b?b.title:''; $('#eDate').value=b?b.date:dateStr(new Date());
  $('#eTime').value=b?(b.time||''):'11:00'; $('#eVenue').value=b?(b.venue||''):'';
  $('#eOrg').value=b?(b.org||''):''; $('#ePhone').value=b?(b.phone||''):'';
  $('#eNote').value=b?(b.note||''):''; $('#eRemind').checked=true;
  openSheet('sheetBhan');
}
function scheduleBhanReminder(b){
  if(!b.date) return;
  var tm=(b.time||'09:00').split(':');
  var d=new Date(b.date+'T00:00:00'); d.setHours(Math.max(0,(+tm[0]||9)-2),+tm[1]||0,0,0);
  if(d.getTime()<Date.now()) return;
  Native.scheduleEvent('bhan_'+b.id, d.getTime(), t('notif.bhanTitle'),
    t('notif.bhanBody',{title:b.title, when:Banner.fmtDate(b.date,lang())}));
}

function openSevaDetail(id){
  var s=Store.getSeva(id); if(!s) return;
  var T=typeOf(s.type);
  var body='<div style="text-align:center;padding:6px 0 16px">'+
    '<div style="width:66px;height:66px;border-radius:22px;background:'+T.color+';display:grid;place-items:center;font-size:32px;margin:0 auto 11px">'+T.emo+'</div>'+
    '<h3 style="font-size:19px;font-weight:800;letter-spacing:-.4px">'+esc(typeName(s.type))+'</h3></div>'+
    kv(t('add.date'),fmtDay(s.date))+ kv(t('add.qty'),s.qty+' '+typeUnit(s.type))+
    kv(t('add.minutes'),s.minutes||'—')+ (s.place?kv(t('add.place'),esc(s.place)):'')+
    (s.note?'<h4>'+t('add.note')+'</h4><p>'+esc(s.note)+'</p>':'');
  showInfo('', body, [
    {label:t('common.delete'), cls:'btn-outline', style:'color:var(--danger);border-color:var(--danger)', fn:function(){
      closeSheets();
      confirmSheet(t('seva.deleteQ'),'',async function(){ await Store.deleteSeva(id); renderAll(); toast(t('seva.deleted')); });
    }},
    {label:t('common.edit'), cls:'btn-dark', fn:function(){ closeSheets(); setTimeout(function(){openAdd(s.type,s);},260); }}
  ]);
}
function openBhanDetail(id){
  var b=Store.data.bhandaras.find(function(x){return x.id===id;}); if(!b) return;
  var body='<div style="text-align:center;font-size:38px;margin-bottom:8px">🎪</div>'+
    '<h3 style="text-align:center;font-size:19px;font-weight:800;margin-bottom:14px">'+esc(b.title)+'</h3>'+
    kv(t('bhan.fDate'),Banner.fmtDate(b.date,lang()))+ (b.time?kv(t('bhan.fTime'),Banner.fmtTime(b.time,lang())):'')+
    (b.venue?kv(t('bhan.fVenue'),esc(b.venue)):'')+ (b.org?kv(t('bhan.fOrg'),esc(b.org)):'')+
    (b.phone?kv(t('bhan.fPhone'),esc(b.phone)):'')+ (b.note?'<h4>'+t('bhan.fNote')+'</h4><p>'+esc(b.note)+'</p>':'');
  showInfo('', body, [
    {label:'🗑️', cls:'btn-outline', style:'color:var(--danger);border-color:var(--danger)', fn:function(){
      closeSheets();
      confirmSheet(t('common.delete')+'?',b.title,async function(){
        Native.cancelEvent('bhan_'+id); await Store.deleteBhandara(id); renderAll(); toast(t('bhan.deleted'));
      });
    }},
    {label:t('common.share'), cls:'btn-outline', fn:function(){ shareBhanText(id); }},
    {label:'🎨 '+t('bhan.makeBanner'), cls:'btn-dark', fn:function(){ closeSheets(); loadBhanToBanner(id); }}
  ]);
}
function shareBhanText(id){
  var b=Store.data.bhandaras.find(function(x){return x.id===id;}); if(!b) return;
  Native.shareText(Banner.shareText(Object.assign({__lang:lang()},b)));
}
function loadBhanToBanner(id){
  var b=Store.data.bhandaras.find(function(x){return x.id===id;}); if(!b) return;
  go('bhandara');
  $$('#bhanSeg button').forEach(function(x){ x.classList.toggle('on',x.getAttribute('data-tab')==='banner'); });
  App.bhanTab='banner';
  $('#bhanEvents').classList.add('hidden'); $('#bhanBanner').classList.remove('hidden');
  $('#bTitle').value=b.title; $('#bDate').value=b.date; $('#bTime').value=b.time||'';
  $('#bVenue').value=b.venue||''; $('#bOrg').value=b.org||''; $('#bPhone').value=b.phone||'';
  drawBanner();
}

/* ═══════════ BANNER ═══════════ */
function buildTemplates(){
  $('#tplRow').innerHTML=Banner.templates.map(function(T){
    return '<button class="tpl'+(T.id===Banner.current?' on':'')+'" data-tpl="'+T.id+'">'+
      '<i style="background:linear-gradient(140deg,'+T.bg[0]+','+T.bg[1]+' 55%,'+T.bg[2]+')"></i><b>'+esc(T.name)+'</b></button>';
  }).join('');
  $$('#tplRow [data-tpl]').forEach(function(b){
    b.onclick=function(){
      Banner.setTemplate(b.getAttribute('data-tpl'));
      $$('#tplRow .tpl').forEach(function(x){x.classList.toggle('on',x===b);});
      drawBanner(); Native.vibrate(8);
    };
  });
}
function wireBanner(){
  ['bTitle','bSub','bDate','bTime','bVenue','bOrg','bPhone'].forEach(function(id){
    var el=$('#'+id); if(el) el.oninput=debounce(drawBanner,180);
  });
  $('#bRatio').onchange=function(){ Banner.setRatio(this.value); drawBanner(); };
  $('#bTitle').value=t('bhan.titleDef'); $('#bSub').value=t('bhan.subDef');
  $('#bDate').value=dateStr(new Date()); $('#bTime').value='11:00';
  $('#bVenue').value=t('bhan.venueDef'); $('#bOrg').value=t('bhan.orgDef');
  drawBanner();

  $('#btnSaveBanner').onclick=function(){
    var c=$('#bannerCanvas');
    var r=Native.saveImage(Banner.toBase64(c),'bhandara-'+Date.now()+'.png');
    if(r&&r.ok) toast(t('bhan.bannerSaved'),'ok'); else toast('⚠️','err');
  };
  $('#btnShareBanner').onclick=function(){
    var c=$('#bannerCanvas');
    Native.shareImage(Banner.toBase64(c),'bhandara-'+Date.now()+'.png',Banner.shareText(bannerData()));
    toast(t('common.share')+'…');
  };
}
function bannerData(){
  return { title:$('#bTitle').value||t('bhan.titleDef'), subtitle:$('#bSub').value,
    date:$('#bDate').value, time:$('#bTime').value, venue:$('#bVenue').value,
    org:$('#bOrg').value, phone:$('#bPhone').value, __lang:lang() };
}
function drawBanner(){ try{ Banner.render($('#bannerCanvas'),bannerData()); }catch(e){ console.error(e); } }

/* ═══════════ SETTINGS ═══════════ */
function applyTheme(mode){
  var dark = mode==='dark' || (mode==='auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark?'dark':'light');
  var bg=dark?'#0A0C10':'#F4F5F7';
  var meta=$('meta[name="theme-color"]'); if(meta) meta.content=bg;
  Native.setStatusBar(bg,!dark);
}
function renderSettings(){
  var s=Store.data.settings;
  $('#setName').textContent=s.name||(lang()==='en'?'Bhagat Ji':'भगत जी');
  $('#setAvatar').querySelector('span').textContent=(s.name||'भ').trim().charAt(0).toUpperCase();
  $('#valLang').textContent=LANG_NAMES[s.lang]||s.lang;
  $('#valTheme').textContent=t('theme.'+(s.theme||'light'));
  $('#valGoal').textContent=s.goal;
  $('#valRemTime').textContent=s.remTime;
  $('#swReminder').checked=!!s.reminder;
  $('#swUpdNotif').checked=s.updNotif!==false;
  $('#swNotif').checked=Native.hasNotifPermission();

  var st=Store.stats, raw=st.raw||0, stored=st.stored||0;
  $('#smSize').textContent=fmtBytes(stored);
  $('#smRawTxt').textContent=fmtBytes(raw); $('#smEncTxt').textContent=fmtBytes(stored);
  var pct=raw?Math.max(2,Math.round(stored/raw*100)):2;
  $('#smRaw').style.width=(100-pct)+'%'; $('#smEnc').style.width=pct+'%';
  $('#smSaved').textContent = raw? (100-Math.round(stored/raw*100))+'%' : '—';

  var info=Native.info();
  var ota=(Native.available&&Native.otaState())||null;
  var ver='v'+info.versionName+(ota&&ota.webVersion?' · web'+ota.webVersion:'');
  $('#verPill').textContent=ver;
  $('#footNote').textContent=t('app.name')+' · '+ver;
  $('#updChannel').textContent=Update.config.channel||'stable';
  syncPermissionUI();
}
function syncPermissionUI(){
  var p=Native.permissions();
  $('#swNotif').checked=!!p.notif;
  var n=[p.notif,p.storage,p.install].filter(Boolean).length;
  $('#valPerms').textContent=n+'/3';
}

function wireSettings(){
  $('#btnEditName').onclick=function(){
    promptSheet(t('set.nameTitle'),Store.data.settings.name,'text',async function(v){
      Store.data.settings.name=v.trim(); await Store.save(); renderAll(); toast(t('set.nameSaved'),'ok');
    });
  };
  $('#rowLang').onclick=function(){
    pickSheet(t('set.language'),Object.keys(LANG_NAMES).map(function(k){
      return {id:k,label:LANG_NAMES[k],emo:'🌐',on:Store.data.settings.lang===k};
    }),async function(k){
      Store.data.settings.lang=k; await Store.save(); applyI18n();
      buildTypes(); buildQuickGrid(); buildTemplates(); renderAll();
      $('#bTitle').value=t('bhan.titleDef'); $('#bSub').value=t('bhan.subDef');
      $('#bVenue').value=t('bhan.venueDef'); $('#bOrg').value=t('bhan.orgDef'); drawBanner();
      closeSheets(); toast(t('set.langChanged'),'ok');
    });
  };
  $('#rowTheme').onclick=function(){
    pickSheet(t('set.theme'),['light','dark','auto'].map(function(k){
      return {id:k,label:t('theme.'+k),emo:k==='light'?'☀️':k==='dark'?'🌙':'🔄',on:Store.data.settings.theme===k};
    }),async function(k){
      Store.data.settings.theme=k; await Store.save(); applyTheme(k); renderSettings(); closeSheets();
    });
  };
  $('#rowGoal').onclick=function(){
    pickSheet(t('set.goalTitle'),[1,2,3,5,7,10].map(function(n){
      return {id:String(n),label:String(n),emo:'🎯',on:Number(Store.data.settings.goal)===n};
    }),async function(v){ Store.data.settings.goal=Number(v); await Store.save(); renderAll(); closeSheets(); });
  };
  $('#rowRemTime').onclick=function(){
    promptSheet(t('set.remTime'),Store.data.settings.remTime,'time',async function(v){
      Store.data.settings.remTime=v; await Store.save(); applyReminder(); renderSettings();
    });
  };
  $('#swNotif').onchange=function(e){
    if(e.target.checked){
      Native.requestNotifPermission();
      setTimeout(function(){
        var ok=Native.hasNotifPermission();
        Store.data.settings.notif=ok; Store.save(); renderSettings();
        toast(ok?t('set.notifOn'):t('perm.denied'), ok?'ok':'err');
        if(ok && Store.data.settings.reminder) applyReminder();
      },900);
    }else{ Native.openSettings('notification'); setTimeout(renderSettings,900); }
  };
  $('#swReminder').onchange=async function(e){
    if(e.target.checked && !Native.hasNotifPermission()){
      e.target.checked=false; toast(t('set.needNotif'),'err'); Native.requestNotifPermission(); return;
    }
    Store.data.settings.reminder=e.target.checked; await Store.save(); applyReminder();
    toast(e.target.checked?t('set.remOn'):t('set.remOff'),'ok');
  };
  $('#swUpdNotif').onchange=async function(e){ Store.data.settings.updNotif=e.target.checked; await Store.save(); };

  $('#rowBackup').onclick=doBackup;
  $('#rowRestore').onclick=function(){ Native.pickFile('restore'); };
  $('#rowPerms').onclick=showPermissions;
  $('#rowWipe').onclick=function(){
    confirmSheet(t('set.wipeQ'),t('set.wipeDesc'),async function(){
      if(Native.available) Native.secureWipe();
      await Store.wipe(); renderAll(); toast(t('set.wiped'));
    });
  };
  $('#rowAbout').onclick=showAbout;
  $('#rowDiag').onclick=showDiagnostics;

  Native.on('filePicked',async function(p){
    if(p.reqId!=='restore') return;
    App.pendingRestore=p.content;
    promptSheet(t('set.enterPass'),'','password',async function(pass){
      try{
        await Store.importBackup(App.pendingRestore,pass);
        applyTheme(Store.data.settings.theme); applyI18n();
        buildTypes(); buildQuickGrid(); buildTemplates(); renderAll();
        toast(t('set.restoreDone'),'ok');
      }catch(e){
        try{
          await Store.importBackup(App.pendingRestore,'');
          applyI18n(); renderAll(); toast(t('set.restoreDone'),'ok');
        }catch(e2){ toast(t('set.wrongPass'),'err'); }
      }
      App.pendingRestore=null;
    });
  });
  Native.on('permissionChanged',function(){ syncPermissionUI(); renderSettings(); });
  if(window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(){
    if(Store.data.settings.theme==='auto') applyTheme('auto');
  });
}
function applyReminder(){
  var s=Store.data.settings, p=(s.remTime||'20:00').split(':');
  Native.scheduleReminder(+p[0]||20,+p[1]||0,!!s.reminder);
}

async function doBackup(){
  promptSheet(t('set.passTitle'),'','password',async function(pass){
    try{
      var bk=await Store.exportBackup(pass);
      var r=Native.saveText(bk.content,bk.filename,'application/octet-stream');
      if(r&&r.ok) toast(t('set.backupDone'),'ok'); else toast('⚠️','err');
    }catch(e){ toast('⚠️ '+e.message,'err'); }
  }, t('set.passDesc'));
}

function showPermissions(){
  var p=Native.permissions();
  var rows=[
    {k:'notif', emo:'🔔', label:t('perm.notif'), note:t('set.pushNotif'), on:p.notif},
    {k:'storage', emo:'📁', label:t('perm.storage'), note:t('perm.storageNote'), on:p.storage},
    {k:'install', emo:'⬇️', label:t('perm.install'), note:t('perm.installNote'), on:p.install},
    {k:'alarm', emo:'⏰', label:t('perm.alarm'), note:t('set.dailyReminder'), on:p.exactAlarm}
  ];
  var body=rows.map(function(r){
    return '<div class="kv" style="align-items:center;padding:13px 0">'+
      '<span style="display:flex;align-items:center;gap:9px;font-size:13.5px;color:var(--ink)">'+r.emo+' '+esc(r.label)+'</span>'+
      '<b style="color:'+(r.on?'var(--ok)':'var(--muted)')+'">'+(r.on?t('perm.granted'):t('perm.denied'))+'</b></div>'+
      '<p style="font-size:11.5px;color:var(--muted);margin:-4px 0 8px">'+esc(r.note)+'</p>'+
      (r.on?'':'<button class="btn btn-outline btn-sm btn-block" data-perm="'+r.k+'" style="margin-bottom:10px">'+t('perm.grant')+'</button>');
  }).join('');
  showInfo(t('perm.title'),body,[{label:t('common.close'),cls:'btn-dark',fn:closeSheets}]);
  setTimeout(function(){
    $$('[data-perm]').forEach(function(b){
      b.onclick=function(){ Native.requestPermission(b.getAttribute('data-perm')); setTimeout(function(){ closeSheets(); showPermissions(); },1200); };
    });
  },60);
}

function showAbout(){
  var i=Native.info(), ota=(Native.available&&Native.otaState())||{};
  var body='<div style="text-align:center;margin-bottom:14px"><div style="font-size:44px">🪔</div>'+
    '<h3 style="font-size:20px;font-weight:800;margin-top:6px">'+t('app.name')+'</h3>'+
    '<p style="color:var(--muted);font-size:12.5px">'+t('app.tagline')+'</p></div>'+
    '<p>'+t('about.body')+'</p><h4>🔐 '+t('set.dataSec')+'</h4><p>'+t('about.privacy')+'</p>'+
    '<h4>ℹ️</h4><p>'+t('about.note')+'</p>'+
    kv(t('about.version'),i.versionName+' ('+i.versionCode+')')+
    kv('Web bundle',String(ota.webVersion||window.WEB_VERSION||1))+
    kv('Android',String(i.androidVersion)+' · API '+i.sdk)+
    kv('WebView',String(i.webviewVersion||'—'))+
    kv(t('about.updateSrc'),'<span style="font-size:10.5px">'+esc(Update.config.sources[0]||'—')+'</span>');
  showInfo(t('set.aboutApp'),body,[{label:t('common.close'),cls:'btn-dark',fn:closeSheets}]);
}

function showDiagnostics(){
  var i=Native.info(), ota=(Native.available&&Native.otaState())||{};
  var body=kv('Bridge',Native.available?'native ✅':'browser')+
    kv('Storage mode',Store.mode)+ kv('Schema',String(Store.data.schema))+
    kv('Sevas',String(Store.data.sevas.length))+ kv('Bhandaras',String(Store.data.bhandaras.length))+
    kv('Raw → stored',fmtBytes(Store.stats.raw)+' → '+fmtBytes(Store.stats.stored))+
    kv('Writes',String(Store.data.meta.writes||0))+
    kv('OTA active',JSON.stringify(ota.source||'assets')+' / web'+(ota.webVersion||0))+
    kv('OTA pending',String(!!ota.pending))+
    kv('Last check',Update.config.lastCheck?new Date(Update.config.lastCheck).toLocaleString():'—')+
    kv('Last error','<span style="font-size:10.5px">'+esc(Update.lastError||'none')+'</span>')+
    kv('Source','<span style="font-size:10.5px">'+esc(Update.config.sources[0]||'—')+'</span>');
  showInfo(t('set.diag'),body,[
    {label:'Reset OTA',cls:'btn-outline',fn:function(){ if(Native.available){Native.otaReset(); toast('OTA reset');} closeSheets(); }},
    {label:t('common.close'),cls:'btn-dark',fn:closeSheets}
  ]);
}

function showFilter(){
  var opts=[{id:'',label:t('seva.allTypes'),emo:'🗂️',on:!App.filterType}].concat(TYPES.map(function(T){
    return {id:T.id,label:t('type.'+T.id),emo:T.emo,on:App.filterType===T.id};
  }));
  pickSheet(t('seva.filter'),opts,function(id){ App.filterType=id||null; renderSeva(); closeSheets(); });
}

function showNotifications(){
  var up=Store.upcomingBhandaras();
  var items=[];
  var bc=Store.data.meta.broadcast;
  if(bc && bc.title) items.push('<div class="seva-item" id="notifBc"><div class="si-emo" style="background:'+
    (bc.style==='warning'?'#FEF3C7':bc.style==='event'?'#EDE9FE':'#E8F1FF')+'">'+
    (bc.style==='warning'?'⚠️':bc.style==='event'?'🎪':'📢')+'</div>'+
    '<div class="si-body"><b>'+esc(bc.title)+'</b><small>'+esc(bc.body||'')+'</small></div></div>');
  if(Update.decision && Update.decision.kind!=='none' && Update.decision.kind!=='error')
    items.push('<div class="seva-item" id="notifUpd"><div class="si-emo" style="background:var(--brand-soft)">⬆️</div>'+
      '<div class="si-body"><b>'+t('upd.available')+'</b><small>'+esc(Update.decision.version||'')+'</small></div></div>');
  up.slice(0,4).forEach(function(b){
    items.push('<div class="seva-item"><div class="si-emo" style="background:#EDE9FE">🎪</div>'+
      '<div class="si-body"><b>'+esc(b.title)+'</b><small>'+esc(Banner.fmtDate(b.date,lang()))+'</small></div></div>');
  });
  var body=items.length?'<div class="list">'+items.join('')+'</div>':emptyBlock('🔔',t('home.noBhan'),'');
  showInfo(t('set.notifications'),body,[{label:t('common.close'),cls:'btn-dark',fn:closeSheets}]);
  setTimeout(function(){
    var e=$('#notifUpd'); if(e) e.onclick=function(){ closeSheets(); setTimeout(function(){showUpdateModal(Update.decision);},280); };
    var bcn=$('#notifBc'); if(bcn && bc.url) bcn.onclick=function(){ Native.shareText(bc.url); };
  },60);
}

/* ═══════════ UPDATE UI ═══════════ */
function wireUpdate(){
  $('#btnCheckUpdate').onclick=async function(){
    $('#updStatus').textContent=t('upd.checking');
    var d=await Update.check();
    if(!d||d.kind==='error'){ $('#updStatus').textContent=navigator.onLine===false?t('upd.offline'):t('upd.failed'); toast(t('upd.failed'),'err'); return; }
    if(d.kind==='none'){ $('#updStatus').textContent=t('upd.upToDate'); $('#updBody').classList.add('hidden'); toast(t('upd.upToDate'),'ok'); return; }
    showUpdateModal(d);
  };
  $('#btnDoUpdate').onclick=function(){ if(Update.decision) showUpdateModal(Update.decision); };
  $('#btnLater').onclick=function(){ Update.dismiss(); $('#updBody').classList.add('hidden'); };
  $('#umLater').onclick=function(){ Update.dismiss(); closeUpdateModal(); };
  $('#umPrimary').onclick=runUpdate;

  Update.onDecision=function(d){
    if(!d||d.kind==='none'){ $('#updStatus').textContent=t('upd.upToDate'); $('#updBody').classList.add('hidden'); }
    else if(d.kind==='error'){ $('#updStatus').textContent=navigator.onLine===false?t('upd.offline'):t('upd.failed'); }
    else{
      $('#updStatus').textContent=t('upd.newVer',{v:d.version});
      $('#updBody').classList.remove('hidden');
      $('#updNotes').textContent=notesText(d.notes);
      var delta = d.kind==='web'?Update.computeDelta(d.web):null;
      $('#updMeta').innerHTML=
        '<span class="meta-tag hot">'+t(d.kind==='web'?'upd.type.hot':'upd.type.apk')+'</span>'+
        (delta?'<span class="meta-tag">'+t('upd.filesChanged',{n:delta.changed.length})+'</span>':'')+
        '<span class="meta-tag">'+fmtBytes(delta?delta.bytes:(d.size||0))+'</span>';
      $('#notifDot').classList.remove('hidden');
    }
  };
  Update.onProgress=function(p){
    $('#umProgress').classList.remove('hidden');
    $('#umBar').style.width=Math.round(p.frac*100)+'%';
    $('#umStatus').classList.remove('hidden');
    $('#umStatus').textContent=p.label+(p.detail?' · '+p.detail:'');
    $('#updProgress').classList.remove('hidden');
    $('#updBar').style.width=Math.round(p.frac*100)+'%';
  };
}
function notesText(notes){
  if(!notes) return '';
  var arr=notes[lang()]||notes.en||notes.hi||[];
  return Array.isArray(arr)?arr.join(' • '):String(arr);
}
function showUpdateModal(d){
  if(!d||d.kind==='none'||d.kind==='error') return;
  var delta=d.kind==='web'?Update.computeDelta(d.web):null;
  $('#umTitle').textContent=t('upd.available');
  $('#umSub').textContent=t('upd.newVer',{v:d.version});
  var arr=(d.notes&&(d.notes[lang()]||d.notes.en))||[];
  $('#umNotes').innerHTML=Array.isArray(arr)&&arr.length?'<ul>'+arr.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>':esc(notesText(d.notes));
  $('#umMeta').innerHTML='<span class="meta-tag hot">'+t(d.kind==='web'?'upd.type.hot':'upd.type.apk')+'</span>'+
    (delta?'<span class="meta-tag">'+t('upd.filesChanged',{n:delta.changed.length})+' / '+delta.totalFiles+'</span>':'')+
    '<span class="meta-tag">'+fmtBytes(delta?delta.bytes:(d.size||0))+'</span>';
  $('#umForce').classList.toggle('hidden',!d.forced);
  $('#umLater').classList.toggle('hidden',!!d.forced);
  $('#umProgress').classList.add('hidden'); $('#umStatus').classList.add('hidden');
  $('#umPrimary').disabled=false; $('#umPrimary').textContent=t('upd.updateNow');
  $('#updateModal').classList.add('on');
}
function closeUpdateModal(){ $('#updateModal').classList.remove('on'); }

async function runUpdate(){
  var d=Update.decision; if(!d) return;
  $('#umPrimary').disabled=true; $('#umPrimary').textContent=t('upd.downloading');
  Native.keepAwake(true);
  try{
    var r=await Update.apply(d);
    Native.keepAwake(false);
    if(r.restart){
      $('#umPrimary').textContent=t('upd.restart');
      $('#umPrimary').disabled=false;
      $('#umStatus').textContent=t('upd.done');
      $('#umPrimary').onclick=function(){ Native.restart(); };
      toast(t('upd.done'),'ok');
      setTimeout(function(){ Native.restart(); },2200);
    }else if(r.installing){
      $('#umStatus').textContent=t('upd.apkPrompt');
      $('#umPrimary').disabled=false; $('#umPrimary').textContent=t('common.ok');
      $('#umPrimary').onclick=closeUpdateModal;
    }
  }catch(e){
    Native.keepAwake(false);
    $('#umStatus').classList.remove('hidden');
    $('#umStatus').textContent='⚠️ '+e.message;
    $('#umPrimary').disabled=false; $('#umPrimary').textContent=t('upd.updateNow');
    $('#umPrimary').onclick=runUpdate;
    toast('⚠️ '+e.message,'err');
  }
}

/* ═══════════ SHEET PRIMITIVES ═══════════ */
function openSheet(id){
  closeSheets(true);
  $('#scrim').classList.add('on');
  $('#'+id).classList.add('on');
  Native.vibrate(10);
}
function closeSheets(silent){
  $('#scrim').classList.remove('on');
  $$('.sheet').forEach(function(s){s.classList.remove('on');});
}
function pickSheet(title,opts,cb){
  $('#pickTitle').textContent=title;
  $('#pickList').innerHTML=opts.map(function(o){
    return '<button class="pick'+(o.on?' on':'')+'" data-pick="'+esc(String(o.id))+'">'+
      '<span class="pick-emo">'+(o.emo||'')+'</span><b>'+esc(o.label)+'</b>'+
      '<svg viewBox="0 0 24 24" class="ico ck"><path d="M20 6L9 17l-5-5"/></svg></button>';
  }).join('');
  $$('#pickList [data-pick]').forEach(function(b){
    b.onclick=function(){ cb(b.getAttribute('data-pick')); };
  });
  openSheet('sheetPick');
}
function promptSheet(title,value,type,cb,desc){
  $('#infoTitle').textContent=title;
  $('#infoBody').innerHTML=(desc?'<p style="font-size:12.5px;color:var(--muted);margin-bottom:12px">'+esc(desc)+'</p>':'')+
    '<label class="field"><input id="promptInput" type="'+(type||'text')+'" value="'+esc(value||'')+'" '+
    (type==='password'?'placeholder="'+t('set.passPh')+'"':'')+' autocomplete="off"></label>';
  $('#infoFoot').innerHTML='<div class="btn-row" style="margin:0"><button class="btn btn-ghost" id="promptCancel">'+t('common.cancel')+
    '</button><button class="btn btn-dark flex1" id="promptOk">'+t('common.save')+'</button></div>';
  openSheet('sheetInfo');
  setTimeout(function(){ var i=$('#promptInput'); if(i){ i.focus(); i.select(); } },340);
  $('#promptCancel').onclick=closeSheets;
  $('#promptOk').onclick=function(){ var v=$('#promptInput').value; closeSheets(); cb(v); };
  $('#promptInput').onkeydown=function(e){ if(e.key==='Enter'){ $('#promptOk').click(); } };
}
function confirmSheet(title,desc,cb){
  $('#infoTitle').textContent=title;
  $('#infoBody').innerHTML='<p>'+esc(desc)+'</p>';
  $('#infoFoot').innerHTML='<div class="btn-row" style="margin:0"><button class="btn btn-ghost" id="cfNo">'+t('common.cancel')+
    '</button><button class="btn btn-danger flex1" id="cfYes">'+t('common.confirm')+'</button></div>';
  openSheet('sheetInfo');
  $('#cfNo').onclick=closeSheets;
  $('#cfYes').onclick=function(){ closeSheets(); cb(); };
}
function showInfo(title,bodyHtml,buttons){
  $('#infoTitle').textContent=title;
  $('#infoBody').innerHTML=bodyHtml;
  $('#infoFoot').innerHTML=buttons&&buttons.length?
    '<div class="btn-row" style="margin:0">'+buttons.map(function(b,i){
      return '<button class="btn '+(b.cls||'btn-outline')+(b.cls==='btn-dark'?' flex1':'')+'" data-info="'+i+'" style="'+(b.style||'')+'">'+esc(b.label)+'</button>';
    }).join('')+'</div>':'';
  if(buttons) buttons.forEach(function(b,i){
    var el=$('[data-info="'+i+'"]'); if(el) el.onclick=b.fn;
  });
  openSheet('sheetInfo');
}
function kv(k,v){ return '<div class="kv"><span>'+esc(k)+'</span><b>'+v+'</b></div>'; }

/* ═══════════ UTIL ═══════════ */
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function debounce(fn,ms){ var t; return function(){ clearTimeout(t); var a=arguments,c=this; t=setTimeout(function(){fn.apply(c,a);},ms); }; }
var toastTimer;
function toast(msg,kind){
  var el=$('#toast'); el.textContent=msg; el.className='toast on'+(kind?' '+kind:'');
  clearTimeout(toastTimer); toastTimer=setTimeout(function(){ el.classList.remove('on'); },2600);
}
window.toast=toast; window.App=App; window.go=go;
})();
