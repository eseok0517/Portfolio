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
 ends.sort((a,b)=>a.y-b.y);for(let i=1;i<ends.length;i++)if(ends[i].y-ends[i-1].y<9)ends[i].y=ends[i-1].y+9;
 ends.forEach(e=>{svg+=`<text x="${W-pr+4}" y="${e.y+3}" font-size="9" font-weight="700" fill="${cols[e.s]||'#555'}">${e.s}</text>`});
 document.getElementById('macro-chart').innerHTML=svg+'</svg>';
 document.getElementById('macro-period').textContent=`${d.months[start]} to ${d.months.at(-1)} · month-end prices, dividends reinvested where available · $100 invested at the start`;
 const f=Object.fromEntries(series.map(x=>[x.s,x.v.at(-1)])),fm=v=>'$'+Math.round(v).toLocaleString('en-US');
 if(f.NVDA&&f.SPY&&f.TLT)document.getElementById('macro-finding').textContent=`Over this period $100 grew to ${fm(f.SPY)} in SPY, ${fm(f.NVDA)} in NVDA and ${fm(f.TLT)} in TLT, so the same market produced very different paths.`;
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
