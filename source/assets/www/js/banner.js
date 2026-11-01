/* ═══════════════════════════════════════════════════════════
   BANNER — Bhandara announcement generator (canvas)
   Renders at print-grade resolution, wraps Devanagari/Latin,
   auto-fits type, exports PNG for share / gallery save.
   ═══════════════════════════════════════════════════════════ */
(function(){
'use strict';

var TEMPLATES = [
  {id:'saffron', name:'केसर',   bg:['#FF9A3D','#F97316','#C2410C'], ink:'#FFFFFF', soft:'rgba(255,255,255,.20)', accent:'#FFE7C6', panel:'rgba(255,255,255,.16)'},
  {id:'royal',   name:'नील',    bg:['#6366F1','#4338CA','#1E1B4B'], ink:'#FFFFFF', soft:'rgba(255,255,255,.18)', accent:'#C7D2FE', panel:'rgba(255,255,255,.14)'},
  {id:'emerald', name:'हरित',   bg:['#34D399','#059669','#064E3B'], ink:'#FFFFFF', soft:'rgba(255,255,255,.18)', accent:'#A7F3D0', panel:'rgba(255,255,255,.14)'},
  {id:'maroon',  name:'सिंदूर', bg:['#F43F5E','#BE123C','#4C0519'], ink:'#FFFFFF', soft:'rgba(255,255,255,.18)', accent:'#FECDD3', panel:'rgba(255,255,255,.14)'},
  {id:'night',   name:'रात्रि', bg:['#334155','#0F172A','#020617'], ink:'#FFFFFF', soft:'rgba(255,255,255,.14)', accent:'#FBBF24', panel:'rgba(255,255,255,.10)'},
  {id:'cream',   name:'श्वेत',  bg:['#FFFBEB','#FEF3C7','#FDE68A'], ink:'#7C2D12', soft:'rgba(124,45,18,.10)', accent:'#B45309', panel:'rgba(255,255,255,.66)'}
];

var RATIOS = { '4:5':[1080,1350], '1:1':[1080,1080], '9:16':[1080,1920], '16:9':[1920,1080] };

var Banner = {
  templates:TEMPLATES,
  current:'saffron',
  ratio:'4:5',
  data:{},

  setTemplate:function(id){ this.current=id; },
  setRatio:function(r){ if(RATIOS[r]) this.ratio=r; },

  render:function(canvas, data){
    var dims = RATIOS[this.ratio]||RATIOS['4:5'];
    var W=dims[0], H=dims[1];
    canvas.width=W; canvas.height=H;
    var g=canvas.getContext('2d');
    var T = TEMPLATES.find(function(x){return x.id===Banner.current;})||TEMPLATES[0];
    var d = Object.assign({
      title:'विशाल भंडारा', subtitle:'', date:'', time:'', venue:'', org:'', phone:'', greeting:'॥ सत साहिब जी ॥'
    }, data||{});
    this.data=d;

    var wide = W>H;
    var S = W/1080;
    var pad = Math.round(70*S);
    var fr  = Math.round(28*S);
    var cw  = W - pad*2;

    /* ══ PASS 1 — measure the content block so it can be optically
       centred between the greeting and the footer on any ratio ══ */
    function layout(paint, yStart){
      var y = yStart;

      if(paint){ g.textAlign='center'; g.textBaseline='alphabetic'; g.fillStyle=T.accent; }
      g.font='700 '+Math.round((wide?26:32)*S)+'px '+FONT;
      if(paint) g.fillText(d.greeting, W/2, y);
      y += (wide?26:34)*S;
      if(paint){ g.strokeStyle=T.soft; g.lineWidth=2*S;
        g.beginPath(); g.moveTo(W/2-90*S,y); g.lineTo(W/2+90*S,y); g.stroke(); }
      y += (wide?30:44)*S;

      var markR=(wide?42:62)*S;
      if(paint) drawDiya(g, W/2, y+markR*0.55, markR, T);
      y += markR*1.9 + (wide?14:26)*S;

      var titleSize=(wide?76:96)*S, titleLines;
      for(var ts=titleSize; ts>34*S; ts-=3*S){
        g.font='800 '+Math.round(ts)+'px '+FONT;
        titleLines=wrap(g,d.title,cw,3);
        titleSize=ts;
        if(titleLines.fitted) break;
      }
      if(paint){ g.fillStyle=T.ink; g.font='800 '+Math.round(titleSize)+'px '+FONT; }
      titleLines.lines.forEach(function(ln){ y+=titleSize*1.14; if(paint) g.fillText(ln,W/2,y); });
      y += (wide?16:24)*S;

      if(d.subtitle){
        var subSize=(wide?28:34)*S;
        g.font='600 '+Math.round(subSize)+'px '+FONT;
        var sl=wrap(g,d.subtitle,cw*0.94,2);
        if(paint){ g.fillStyle=T.ink; g.globalAlpha=.93; }
        sl.lines.forEach(function(ln){ y+=subSize*1.32; if(paint) g.fillText(ln,W/2,y); });
        if(paint) g.globalAlpha=1;
        y += (wide?18:28)*S;
      }

      var rows=[];
      if(d.date)  rows.push({icon:'date',   label:fmtDate(d.date,d.__lang), big:true});
      if(d.time)  rows.push({icon:'time',   label:fmtTime(d.time,d.__lang)});
      if(d.venue) rows.push({icon:'pin',    label:d.venue});
      if(d.org)   rows.push({icon:'people', label:d.org});
      if(d.phone) rows.push({icon:'phone',  label:d.phone});

      if(rows.length){
        var rowH=(wide?54:66)*S, panPad=(wide?26:34)*S;
        var panH=rows.length*rowH+panPad*2-(wide?8:12)*S;
        var panY=y+(wide?8:14)*S;
        var panX=pad+(wide?60:16)*S, panW=W-panX*2;

        if(paint){
          g.fillStyle=T.panel; roundRect(g,panX,panY,panW,panH,Math.round(26*S)); g.fill();
          g.strokeStyle=T.soft; g.lineWidth=1.6*S;
          roundRect(g,panX,panY,panW,panH,Math.round(26*S)); g.stroke();
        }
        var ry=panY+panPad;
        rows.forEach(function(row,idx){
          var fs=(row.big?(wide?32:40):(wide?26:32))*S;
          g.font=(row.big?'800 ':'600 ')+Math.round(fs)+'px '+FONT;
          var maxW=panW-panPad*2-52*S;
          var txt=ellipsize(g,row.label,maxW);
          if(paint){
            var tw=g.measureText(txt).width;
            var icx=W/2-tw/2-30*S;
            g.fillStyle=T.accent; drawIcon(g,row.icon,icx,ry+fs*0.34,18*S);
            g.fillStyle=T.ink; g.textAlign='left';
            g.fillText(txt, icx+26*S, ry+fs*0.78);
            g.textAlign='center';
          }
          ry+=rowH;
          if(paint && idx<rows.length-1){
            g.strokeStyle=T.soft; g.lineWidth=1*S;
            g.beginPath(); g.moveTo(panX+panPad,ry-rowH*0.30); g.lineTo(panX+panW-panPad,ry-rowH*0.30); g.stroke();
          }
        });
        y=panY+panH;
      }
      return y;
    }

    /* ══ background ═ */
    var grad=g.createLinearGradient(0,0,W*0.35,H);
    grad.addColorStop(0,T.bg[0]); grad.addColorStop(.52,T.bg[1]); grad.addColorStop(1,T.bg[2]);
    g.fillStyle=grad; g.fillRect(0,0,W,H);
    var r1=g.createRadialGradient(W*.85,H*.10,0,W*.85,H*.10,W*.75);
    r1.addColorStop(0,'rgba(255,255,255,.26)'); r1.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=r1; g.fillRect(0,0,W,H);
    var r2=g.createRadialGradient(W*.08,H*.95,0,W*.08,H*.95,W*.7);
    r2.addColorStop(0,'rgba(255,255,255,.14)'); r2.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=r2; g.fillRect(0,0,W,H);
    g.save(); g.globalAlpha=.10; g.strokeStyle=T.ink; g.lineWidth=2*S;
    for(var i=0;i<5;i++){ g.beginPath(); g.arc(W*.5,H*.34,(160+i*70)*S,0,Math.PI*2); g.stroke(); }
    g.restore();

    /* ══ frame ══ */
    g.strokeStyle=T.soft; g.lineWidth=Math.max(2,3*S);
    roundRect(g,fr,fr,W-fr*2,H-fr*2,Math.round(34*S)); g.stroke();
    g.strokeStyle=T.accent; g.globalAlpha=.5; g.lineWidth=Math.max(1,1.5*S);
    roundRect(g,fr+9*S,fr+9*S,W-(fr+9*S)*2,H-(fr+9*S)*2,Math.round(28*S)); g.stroke();
    g.globalAlpha=1;
    cornerFlourish(g,W,H,fr,S,T);

    /* ══ PASS 2 — centre the measured block, then paint ══ */
    var topLimit    = fr + (wide?46:74)*S;
    var footerH     = (wide?60:78)*S;
    var bottomLimit = H - fr - footerH;
    var probe       = layout(false, topLimit);
    var contentH    = probe - topLimit;
    var free        = (bottomLimit - topLimit) - contentH;
    var y0          = topLimit + Math.max(0, free) * 0.42;   // optical centre, slightly high
    layout(true, y0);

    /* ══ footer ══ */
    var footY=H-fr-(wide?34:52)*S;
    g.textAlign='center';
    g.fillStyle=T.accent; g.globalAlpha=.95;
    g.font='700 '+Math.round((wide?22:26)*S)+'px '+FONT;
    g.fillText('॥ सतलोक सेवा ॥', W/2, footY);
    g.globalAlpha=.7;
    g.font='500 '+Math.round((wide?16:19)*S)+'px '+FONT;
    g.fillText('सादर आमंत्रण — समस्त सतभक्त संगत', W/2, footY+(wide?26:32)*S);
    g.globalAlpha=1;

    return canvas;
  },

  toBase64:function(canvas){
    var u=canvas.toDataURL('image/png');
    return u.slice(u.indexOf(',')+1);
  },
  shareText:function(d){
    return t('bhan.shareText',{
      title:d.title||'', date:d.date?fmtDate(d.date,d.__lang):'', time:d.time?fmtTime(d.time,d.__lang):'',
      venue:d.venue||'', org:d.org||'', phone:d.phone||''
    }).replace(/\n{3,}/g,'\n\n');
  }
};

var FONT='"Noto Sans Devanagari","Noto Sans Gurmukhi","Nirmala UI",-apple-system,"Segoe UI",Roboto,sans-serif';

/* ── text helpers ── */
function wrap(g,text,maxW,maxLines){
  text=String(text||'').trim();
  if(!text) return {lines:[],fitted:true};
  var words=text.split(/\s+/), lines=[], cur='';
  for(var i=0;i<words.length;i++){
    var test=cur?cur+' '+words[i]:words[i];
    if(g.measureText(test).width<=maxW){ cur=test; }
    else{ if(cur) lines.push(cur); cur=words[i];
      if(g.measureText(cur).width>maxW){          // single overlong word → hard split
        var chunk='';
        for(var c=0;c<cur.length;c++){
          if(g.measureText(chunk+cur[c]).width>maxW){ lines.push(chunk); chunk=cur[c]; }
          else chunk+=cur[c];
        }
        cur=chunk;
      }
    }
  }
  if(cur) lines.push(cur);
  var fitted=lines.length<=maxLines;
  if(!fitted){ lines=lines.slice(0,maxLines); lines[maxLines-1]=ellipsize(g,lines[maxLines-1]+'…',maxW); }
  return {lines:lines,fitted:fitted};
}
function ellipsize(g,s,maxW){
  if(g.measureText(s).width<=maxW) return s;
  var t=String(s);
  while(t.length>1 && g.measureText(t+'…').width>maxW) t=t.slice(0,-1);
  return t+'…';
}
function roundRect(g,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  g.beginPath();
  g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath();
}

/* ── ornaments ── */
function cornerFlourish(g,W,H,fr,S,T){
  g.save(); g.strokeStyle=T.accent; g.globalAlpha=.55; g.lineWidth=2.6*S; g.lineCap='round';
  var L=42*S, o=fr+18*S;
  [[o,o,1,1],[W-o,o,-1,1],[o,H-o,1,-1],[W-o,H-o,-1,-1]].forEach(function(c){
    var x=c[0],y=c[1],sx=c[2],sy=c[3];
    g.beginPath(); g.moveTo(x+sx*L,y); g.quadraticCurveTo(x,y,x,y+sy*L); g.stroke();
    g.beginPath(); g.arc(x+sx*13*S,y+sy*13*S,3.4*S,0,Math.PI*2); g.fillStyle=T.accent; g.fill();
  });
  g.restore();
}
function drawDiya(g,cx,cy,R,T){
  g.save();
  // halo
  var halo=g.createRadialGradient(cx,cy-R*.25,0,cx,cy-R*.25,R*1.5);
  halo.addColorStop(0,'rgba(255,255,255,.34)'); halo.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=halo; g.beginPath(); g.arc(cx,cy-R*.25,R*1.5,0,Math.PI*2); g.fill();
  // rays
  g.strokeStyle=T.accent; g.globalAlpha=.75; g.lineWidth=R*.055; g.lineCap='round';
  for(var i=0;i<12;i++){
    var a=(i/12)*Math.PI*2 - Math.PI/2;
    var r1=R*1.02, r2=R*(i%2?1.20:1.32);
    g.beginPath(); g.moveTo(cx+Math.cos(a)*r1,cy-R*.22+Math.sin(a)*r1);
    g.lineTo(cx+Math.cos(a)*r2,cy-R*.22+Math.sin(a)*r2); g.stroke();
  }
  g.globalAlpha=1;
  // flame
  g.fillStyle=T.accent;
  g.beginPath();
  g.moveTo(cx,cy-R*.98);
  g.bezierCurveTo(cx+R*.36,cy-R*.50, cx+R*.30,cy-R*.10, cx,cy-R*.10);
  g.bezierCurveTo(cx-R*.30,cy-R*.10, cx-R*.36,cy-R*.50, cx,cy-R*.98);
  g.closePath(); g.fill();
  // lamp bowl
  g.fillStyle=T.ink; g.globalAlpha=.94;
  g.beginPath();
  g.moveTo(cx-R*.86,cy);
  g.quadraticCurveTo(cx,cy+R*.78, cx+R*.86,cy);
  g.quadraticCurveTo(cx,cy+R*.22, cx-R*.86,cy);
  g.closePath(); g.fill();
  g.globalAlpha=1;
  g.restore();
}
function drawIcon(g,kind,x,y,s){
  g.save(); g.strokeStyle=g.fillStyle; g.lineWidth=s*.16; g.lineCap='round'; g.lineJoin='round';
  g.translate(x,y);
  if(kind==='date'){
    roundRect(g,-s*.8,-s*.7,s*1.6,s*1.5,s*.22); g.stroke();
    g.beginPath(); g.moveTo(-s*.8,-s*.22); g.lineTo(s*.8,-s*.22); g.stroke();
    g.beginPath(); g.moveTo(-s*.4,-s*.95); g.lineTo(-s*.4,-s*.5); g.moveTo(s*.4,-s*.95); g.lineTo(s*.4,-s*.5); g.stroke();
  }else if(kind==='time'){
    g.beginPath(); g.arc(0,0,s*.82,0,Math.PI*2); g.stroke();
    g.beginPath(); g.moveTo(0,-s*.42); g.lineTo(0,s*.05); g.lineTo(s*.36,s*.24); g.stroke();
  }else if(kind==='pin'){
    g.beginPath(); g.moveTo(0,s*.9); g.bezierCurveTo(-s*.95,-s*.05,-s*.62,-s*.9,0,-s*.9);
    g.bezierCurveTo(s*.62,-s*.9,s*.95,-s*.05,0,s*.9); g.closePath(); g.stroke();
    g.beginPath(); g.arc(0,-s*.25,s*.28,0,Math.PI*2); g.stroke();
  }else if(kind==='people'){
    g.beginPath(); g.arc(-s*.32,-s*.3,s*.32,0,Math.PI*2); g.stroke();
    g.beginPath(); g.arc(s*.42,-s*.18,s*.26,0,Math.PI*2); g.stroke();
    g.beginPath(); g.moveTo(-s*.88,s*.75); g.quadraticCurveTo(-s*.32,s*.06,s*.24,s*.75); g.stroke();
    g.beginPath(); g.moveTo(s*.24,s*.62); g.quadraticCurveTo(s*.52,s*.16,s*.92,s*.62); g.stroke();
  }else if(kind==='phone'){
    g.beginPath();
    g.moveTo(-s*.7,-s*.75); g.quadraticCurveTo(-s*.2,-s*.85,-s*.15,-s*.3);
    g.quadraticCurveTo(-s*.05,s*.1,s*.4,s*.35);
    g.quadraticCurveTo(s*.85,s*.55,s*.72,s*.85);
    g.quadraticCurveTo(-s*.5,s*.95,-s*.82,-s*.5); g.closePath(); g.stroke();
  }
  g.restore();
}

/* ── locale formatting ── */
function fmtDate(iso,lang){
  if(!iso) return '';
  try{
    var d=new Date(iso+'T00:00:00');
    var loc=window.LANG_LOCALE&&LANG_LOCALE[lang||'hi']||'hi-IN';
    return d.toLocaleDateString(loc,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  }catch(e){ return iso; }
}
function fmtTime(hm,lang){
  if(!hm) return '';
  try{
    var p=hm.split(':'), d=new Date(); d.setHours(+p[0],+p[1],0,0);
    var loc=window.LANG_LOCALE&&LANG_LOCALE[lang||'hi']||'hi-IN';
    return d.toLocaleTimeString(loc,{hour:'numeric',minute:'2-digit'});
  }catch(e){ return hm; }
}
Banner.fmtDate=fmtDate; Banner.fmtTime=fmtTime;
window.Banner=Banner;
})();
