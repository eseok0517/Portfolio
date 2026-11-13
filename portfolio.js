'use strict';
const moneyShort=n=>'$'+(n/1e6).toFixed(2)+'M';
const dollars=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
async function purchasingPreview(){
 const r=await fetch('projects/purchasing/data/public/summary.json');if(!r.ok)throw Error('Purchasing data unavailable');const d=await r.json();
 const labels={'Manufacturing Components and Supplies':'Manufacturing components','Tools and General Machinery':'Tools & machinery','Electrical Systems and Lighting and Components and Accessories and Supplies':'Electrical supplies'};
 const rows=Object.entries(d.categories).map(([name,v])=>({name:labels[name]||name,value:v.positive_spend}));const max=Math.max(...rows.map(x=>x.value));
 document.getElementById('purchase-bars').innerHTML=rows.map(x=>`<div class="preview-bar"><div class="preview-bar-label"><span>${x.name}</span><strong>${moneyShort(x.value)}</strong></div><div class="preview-track"><i style="width:${100*x.value/max}%"></i></div></div>`).join('');
 document.getElementById('purchasing-finding').textContent=`${d.all.flagged.toLocaleString()} of ${d.all.rows.toLocaleString()} selected records trigger review rules. Flags identify follow-up candidates, not confirmed errors or savings.`;
}
async function macroPreview(){
 const r=await fetch('data/equities.json',{cache:'no-store'});if(!r.ok)throw Error('Equity data unavailable');
 const d=await r.json(),n=Math.min(121,d.months.length),start=d.months.length-n;
 const cols={SPY:'#1d2b27',QQQ:'#2f6f9f',AAPL:'#7d8a86',MSFT:'#4aa3a0',NVDA:'#1a6247',JPM:'#9b522e',GS:'#c28a2e',XOM:'#8a4f9e',JNJ:'#b5527a',TLT:'#6b7fd7'};
 const series=d.tickers.map(t=>{const p=t.prices.slice(start),b=p.find(x=>x!=null);return{s:t.symbol,v:p.map(x=>x==null?null:100*x/b)}}).filter(x=>x.v.some(y=>y!=null));
 const all=series.flatMap(x=>x.v.filter(y=>y!=null)),lo=Math.log(Math.min(...all)),hi=Math.log(Math.max(...all));
 const W=460,H=250,pl=34,pr=34,pt=10,pb=14,X=i=>pl+(W-pl-pr)*i/(n-1),Y=v=>pt+(H-pt-pb)*(1-(Math.log(v)-lo)/(hi-lo||1));
 const ticks=[100,300,1000,3000,10000].filter(t=>Math.log(t)>=lo&&Math.log(t)<=hi);
 let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Growth of 100 dollars in ten stocks and ETFs, log scale, ${d.months[start]} to ${d.months.at(-1)}">`;
 ticks.forEach(t=>{svg+=`<path d="M${pl} ${Y(t)}H${W-pr}" stroke="#d3dde3" stroke-width="1"/><text x="${pl-5}" y="${Y(t)+3}" font-size="9" text-anchor="end" fill="#55655f">${t>=1000?(t/1000)+'k':t}</text>`});
 const ends=[];
 series.forEach(x=>{const pts=x.v.map((y,i)=>y==null?null:X(i)+','+Y(y)).filter(Boolean);svg+=`<polyline points="${pts.join(' ')}" fill="none" stroke="${cols[x.s]||'#555'}" stroke-width="${x.s==='SPY'?2.4:1.5}" stroke-linejoin="round"/>`;const l=x.v.at(-1);if(l!=null)ends.push({s:x.s,y:Y(l)})});
 ends.sort((a,b)=>a.y-b.y);for(let i=1;i<ends.length;i++)if(ends[i].y-ends[i-1].y<11)ends[i].y=ends[i-1].y+11;
 ends.forEach(e=>{svg+=`<text x="${W-pr+4}" y="${e.y+3}" font-size="9" font-weight="700" fill="${cols[e.s]||'#555'}">${e.s}</text>`});
 document.getElementById('macro-chart').innerHTML=svg+'</svg>';
}
purchasingPreview().catch(()=>{});macroPreview().catch(()=>{});

(function(){const els=document.querySelectorAll('.rc-viz');if(!els.length)return;
 const show=e=>e.classList.add('in');
 if(!('IntersectionObserver'in window)){els.forEach(show);return}
 const io=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){show(x.target);io.unobserve(x.target)}}),{threshold:.35});els.forEach(e=>io.observe(e));})();
async function macroMonths(){
 const box=document.getElementById('rc-months');if(!box)return;
 const r=await fetch('data/macro_results.json',{cache:'no-store'});if(!r.ok)return;const d=await r.json(),rows=d.monthly.filter(m=>m.curve_regime);if(!rows.length)return;
 box.style.gridTemplateColumns='repeat('+rows.length+',1fr)';document.getElementById('rc-ends').innerHTML='<span>'+rows[0].month.slice(0,4)+'</span><span>'+rows.at(-1).month.slice(0,4)+'</span>';
 box.innerHTML=rows.map((m,i)=>'<i style="--i:'+i+'" class="'+(m.curve_regime==='Inverted'?'inv':'')+'" title="'+m.month+'"></i>').join('');
 const n=rows.filter(m=>m.curve_regime==='Inverted').length;
 document.getElementById('rc-macro-count').textContent=rows.length+' months';
 document.getElementById('rc-macro-inv').textContent='Inverted curve ('+n+' months, one run)';
}
macroMonths().catch(()=>{});

async function bankCard(){
 const r=await fetch('data/banks.json',{cache:'no-store'});if(!r.ok)return;const D=await r.json();
 const last=b=>b.quarters.at(-1),yoy=b=>{const q=b.quarters;return q.length>=5&&q.at(-5).deposits?(q.at(-1).deposits/q.at(-5).deposits-1)*100:null};
 const flags=b=>{const q=last(b),qs=b.quarters,n=qs.length,y=yoy(b),f=[];
  if(q.roa!=null&&q.roa<.5)f.push('Low ROA');
  if(n>=5&&q.nim!=null&&qs[n-5].nim!=null&&q.nim-qs[n-5].nim<=-.25)f.push('Margin squeeze');
  if(q.eq_assets!=null&&q.eq_assets<8)f.push('Thin equity');
  if(q.loans_dep!=null&&q.loans_dep>90)f.push('High loans/deposits');
  if(y!=null&&y<=-5)f.push('Deposit outflow');return f};
 const med=a=>{a=a.filter(x=>x!=null&&isFinite(x)).sort((x,y)=>x-y);const m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2};
 const az=D.banks.filter(b=>b.group==='az').sort((a,b)=>last(b).assets-last(a).assets),big=D.banks.filter(b=>b.group==='big');
 if(az.length<3||big.length<3)return;
 const rows=[...az].sort((a,b)=>flags(b).length-flags(a).length||last(b).assets-last(a).assets).slice(0,4);
 document.getElementById('bank-viz').outerHTML='<div class="bk-rows" id="bank-viz"><div style="background:#f3f7f5;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)"><span>Most flagged banks</span><em>ROA</em></div>'+rows.map(b=>{const f=flags(b);return `<div><span><b>${b.name.replace(/, N\.A\.| National Association/,'')}</b><span class="bk-chips">${f.length?f.map(x=>'<i>'+x+'</i>').join(''):'<i class="ok">No flags</i>'}</span></span><em>${last(b).roa==null?'—':last(b).roa.toFixed(2)+'%'}</em></div>`}).join('')+'</div>';
 const nf=az.filter(b=>flags(b).length).length,q=last(az[0]).date,lbl='Q'+Math.ceil(+q.slice(4,6)/3)+' '+q.slice(0,4);
 const loans=b=>last(b).loans_dep,words=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
 const w=n=>words[n]||n,cap=t=>t[0].toUpperCase()+t.slice(1);
 document.getElementById('bank-finding').textContent=`${cap(w(nf))} of ${w(az.length)} Arizona banks tripped at least one warning screen in ${lbl}. Their median return on assets was ${med(az.map(b=>last(b).roa)).toFixed(2)}% against ${med(big.map(b=>last(b).roa)).toFixed(2)}% for the ten largest banks, and they lent out ${Math.round(med(az.map(loans)))}% of deposits against ${Math.round(med(big.map(loans)))}%.`;
}
async function equityFinding(){
 const r=await fetch('data/equities.json',{cache:'no-store'});if(!r.ok)return;const d=await r.json(),n=d.months.length;
 const P=Object.fromEntries(d.tickers.map(t=>[t.symbol,t.prices])),c=d.macro.curve;
 if(!P.NVDA||!P.SPY||!P.JPM||!P.GS)return;
 const yrs=s=>(n-1)/12,cagr=s=>((P[s].at(-1)/P[s][0])**(1/yrs(s))-1)*100,mdd=s=>{let pk=0,m=0;P[s].forEach(v=>{if(v){pk=Math.max(pk,v);m=Math.min(m,v/pk-1)}});return-m*100};
 const fwd=(s,inv)=>{const v=[];for(let i=0;i+12<n;i++){if(c[i]==null||(c[i]<0)!==inv||!P[s][i]||!P[s][i+12])continue;v.push((P[s][i+12]/P[s][i]-1)*100)}return v.length?v.reduce((a,b)=>a+b)/v.length:null};
 const f=[cagr('NVDA'),mdd('NVDA'),cagr('SPY'),mdd('SPY'),fwd('JPM',true),fwd('GS',true),fwd('JPM',false),fwd('GS',false)];if(f.some(x=>x==null||!isFinite(x)))return;
 const y=d.months[0].slice(0,4),R=Math.round;
 document.getElementById('eq-finding').textContent=`Higher returns came with deeper losses: NVIDIA returned ${R(f[0])}% a year since ${y} but fell ${R(f[1])}% at its worst, versus ${R(f[2])}% a year and a ${R(f[3])}% drop for SPY. After the yield curve inverted, JPMorgan and Goldman Sachs averaged ${R(f[4])}% and ${R(f[5])}% over the next year, against ${R(f[6])}% and ${R(f[7])}% otherwise.`;
}
bankCard().catch(()=>{});equityFinding().catch(()=>{});
