(function(){
'use strict';
var $=function(i){return document.getElementById(i)},D,tab='closeout';
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function usd(n){if(n==null||!isFinite(n))return '—';var a=Math.abs(n);return (n<0?'-':'')+'$'+(a>=1e9?(a/1e9).toFixed(2)+'B':a>=1e6?(a/1e6).toFixed(1)+'M':a>=1e3?Math.round(a/1e3)+'K':Math.round(a))}
function pct(x){return (x*100).toFixed(1)+'%'}
function bars(el,rows,tot){var mx=rows.length?rows[0].amount:1;el.innerHTML=rows.map(function(r){return '<div class="b"><span title="'+esc(r.name)+'">'+esc(r.name)+'</span><span class="t"><i style="width:'+Math.max(1.5,r.amount/mx*100)+'%"></i></span><span class="x">'+usd(r.amount)+(tot?' · '+pct(r.amount/tot):'')+'</span></div>'}).join('')}
function csvq(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
var L={closeout:['Expired with unspent balance','Unspent'],overspent:['Paid above award amount','Excess'],bad_dates:['Invalid dates','—']};
function list(){var s=D.summary.flags[tab],q=$('q').value.toLowerCase();
 var rows=s.top.filter(function(r){return !q||(r.id+r.recipient+r.agency).toLowerCase().indexOf(q)>-1});
 $('gapH').textContent=L[tab][1];
 $('tb').innerHTML=rows.map(function(r){return '<tr><td>'+esc(r.id)+'</td><td>'+esc(r.recipient)+'</td><td>'+esc(r.agency)+'</td><td class="n">'+usd(r.amount)+'</td><td class="n">'+usd(r.outlays)+'</td><td>'+esc(r.end)+'</td><td class="n">'+(tab==='bad_dates'?'—':usd(r.gap))+'</td></tr>'}).join('')||'<tr><td colspan="7" class="fine">No records.</td></tr>';
 $('cnt').textContent='Showing the '+rows.length+' largest of '+s.count.toLocaleString('en-US')+(s.amount?' ('+usd(s.amount)+' in total)':'')}
function render(){var S=D.summary,c=S.concentration;
 var K=[['Awards reviewed',S.awards.toLocaleString('en-US'),D.scope.fiscal_years.join(', ')],['Total award amount',usd(S.total_amount),'Median award '+usd(S.median_award)],['Vendors',S.recipients.toLocaleString('en-US'),'Top 5 hold '+pct(c.top5)],['Manufacturing share',pct(S.manufacturing.amount/S.total_amount),usd(S.manufacturing.amount)+' · semiconductors and electronics (NAICS 3344) '+usd(S.semiconductor.amount)]];
 $('kpis').innerHTML=K.map(function(k){return '<div class="kpi"><div class="l">'+k[0]+'</div><div class="v">'+k[1]+'</div><div class="s">'+k[2]+'</div></div>'}).join('');
 bars($('ag'),S.by_agency,S.total_amount);bars($('ind'),S.by_industry,S.total_amount);bars($('rec'),S.by_recipient,S.total_amount);
 $('conSub').textContent='Top 15 vendors by award amount. The top vendor holds '+pct(c.top1)+' of the total.';
 var sb=S.size_buckets,mx=Math.max.apply(null,sb.map(function(b){return b.amount}));
 $('siz').innerHTML=sb.map(function(b){return '<div class="b"><span>'+b.name+'</span><span class="t"><i style="width:'+Math.max(1.5,b.amount/mx*100)+'%"></i></span><span class="x">'+b.awards.toLocaleString('en-US')+' · '+usd(b.amount)+'</span></div>'}).join('');
 var lvl=c.hhi<1500?'unconcentrated':c.hhi<2500?'moderately concentrated':'highly concentrated';
 $('con').innerHTML='<div class="fine" style="font-weight:700;letter-spacing:.08em;text-transform:uppercase">Concentration</div><p style="margin:8px 0 0;font-size:14px">Top 1: <b>'+pct(c.top1)+'</b> · Top 5: <b>'+pct(c.top5)+'</b> · Top 10: <b>'+pct(c.top10)+'</b><br>HHI: <b>'+c.hhi.toLocaleString('en-US')+'</b> ('+lvl+' by the usual thresholds)</p>';
 $('tabs').innerHTML=Object.keys(L).map(function(k){var f=S.flags[k];return '<button data-k="'+k+'" aria-pressed="'+(k===tab)+'">'+L[k][0]+' ('+f.count.toLocaleString('en-US')+')</button>'}).join('');
 $('tabs').querySelectorAll('button').forEach(function(b){b.onclick=function(){tab=b.dataset.k;render()}});list();
 $('out').classList.remove('hidden')}
$('q').oninput=function(){if(D)list()};
$('exp').onclick=function(){var s=D.summary.flags[tab],a=document.createElement('a');a.href=URL.createObjectURL(new Blob([['Award ID,Vendor,Agency,Award Amount,Outlays,Start,End,Gap'].concat(s.top.map(function(r){return [r.id,r.recipient,r.agency,r.amount,r.outlays,r.start,r.end,r.gap].map(csvq).join(',')})).join('\n')],{type:'text/csv'}));a.download='az_review_'+tab+'.csv';document.body.appendChild(a);a.click();setTimeout(function(){a.remove()},500)};
fetch('data/az_spending.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){D=d;
 $('asof').textContent='Data as of '+d.scope.as_of+' · refreshed '+d.generated_utc+' UTC'+(d.synthetic?' · TEST FIXTURE, NOT REAL AWARDS':'')+'.';render()
}).catch(function(){$('asof').textContent='';var s=$('status');s.className='status err';s.textContent='The data file has not been generated yet. In the GitHub repository, open Actions, choose "Update data", and click Run workflow. Refresh this page after it finishes.'});
})();
