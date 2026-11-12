(function(){
'use strict';
var $=function(i){return document.getElementById(i)},D,sel=[],M='roa';
var COL=['#1a6247','#b5651d','#2f6f9f','#7a4e9e','#c2453a','#2a9d8f','#8a6d3b','#555e5a'];
var MET={roa:['Return on assets (%)',function(q){return q.roa}],nim:['Net interest margin (%)',function(q){return q.nim}],eqa:['Equity / assets (%)',function(q){return q.eq_assets}],ld:['Loans / deposits (%)',function(q){return q.loans_dep}],dep:['Deposit growth, year over year (%)',null],eff:['Efficiency ratio (%)',function(q){return q.eff}],nc:['Noncurrent loans / loans (%)',function(q){return q.noncurrent}]};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function money(k){if(k==null)return '—';var d=k*1000;return '$'+(d>=1e12?(d/1e12).toFixed(2)+'T':d>=1e9?(d/1e9).toFixed(1)+'B':(d/1e6).toFixed(0)+'M')}
function p(x,d){return x==null||!isFinite(x)?'—':x.toFixed(d==null?2:d)+'%'}
function med(a){a=a.filter(function(x){return x!=null&&isFinite(x)}).sort(function(x,y){return x-y});if(!a.length)return null;var m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2}
function qd(s){var m=['Mar','Jun','Sep','Dec'][Math.floor((+s.slice(4,6)-1)/3)];return 'Q'+Math.ceil(+s.slice(4,6)/3)+' '+s.slice(0,4)}
function last(b){return b.quarters[b.quarters.length-1]}
function yoy(b,i){var q=b.quarters;i=i==null?q.length-1:i;if(i<4)return null;var c=q[i].deposits,o=q[i-4].deposits;return c&&o?(c/o-1)*100:null}
function val(b,m,i){var q=b.quarters[i];return m==='dep'?yoy(b,i):MET[m][1](q)}
function flags(b){var q=last(b),f=[],y=yoy(b),n=b.quarters.length;
 if(q.roa!=null&&q.roa<.5)f.push('Low ROA');
 if(n>=5&&q.nim!=null&&b.quarters[n-5].nim!=null&&q.nim-b.quarters[n-5].nim<=-.25)f.push('Margin squeeze');
 if(q.eq_assets!=null&&q.eq_assets<8)f.push('Thin equity');
 if(q.loans_dep!=null&&q.loans_dep>90)f.push('High loans/deposits');
 if(y!=null&&y<=-5)f.push('Deposit outflow');return f}
function render(){
 var az=D.banks.filter(function(b){return b.group==='az'}).sort(function(a,b){return last(b).assets-last(a).assets}),big=D.banks.filter(function(b){return b.group==='big'});
 var A=az.reduce(function(s,b){return s+last(b).assets},0),Dp=az.reduce(function(s,b){return s+(last(b).deposits||0)},0),Ln=az.reduce(function(s,b){return s+(last(b).loans||0)},0);
 var dg=az.filter(function(b){return yoy(b)!=null});
 var K=[['Arizona banks',az.length,'Active, Arizona-headquartered'],['Combined assets',money(A),'Deposits '+money(Dp)],['Median ROA',p(med(az.map(function(b){return last(b).roa}))),'Large banks '+p(med(big.map(function(b){return last(b).roa})))],['Median net interest margin',p(med(az.map(function(b){return last(b).nim}))),'Large banks '+p(med(big.map(function(b){return last(b).nim})))]];
 $('kpis').innerHTML=K.map(function(k){return '<div class="kpi"><div class="l">'+k[0]+'</div><div class="v">'+k[1]+'</div><div class="s">'+k[2]+'</div></div>'}).join('');
 $('scSub').textContent='Latest quarter: '+qd(D.latest)+'. Arizona banks by assets, then the median of the ten largest U.S. banks for reference.';
 var row=function(b,cls){var q=last(b),f=flags(b);return '<tr class="'+(cls||'')+'"><td><b>'+esc(b.name)+'</b> <span class="fine">'+esc(b.city||'')+'</span></td><td class="n">'+money(q.assets)+'</td><td class="n">'+p(yoy(b),1)+'</td><td class="n">'+p(q.roa)+'</td><td class="n">'+p(q.nim)+'</td><td class="n">'+p(q.eq_assets,1)+'</td><td class="n">'+p(q.loans_dep,1)+'</td><td class="n">'+p(q.eff,1)+'</td><td>'+(f.length?f.map(function(x){return '<span class="flag">'+x+'</span>'}).join(''):'<span class="ok">None</span>')+'</td></tr>'};
 var mrow='<tr class="med"><td>Ten largest U.S. banks (median)</td><td class="n">'+money(med(big.map(function(b){return last(b).assets})))+'</td><td class="n">'+p(med(big.map(function(b){return yoy(b)})),1)+'</td><td class="n">'+p(med(big.map(function(b){return last(b).roa})))+'</td><td class="n">'+p(med(big.map(function(b){return last(b).nim})))+'</td><td class="n">'+p(med(big.map(function(b){return last(b).eq_assets})),1)+'</td><td class="n">'+p(med(big.map(function(b){return last(b).loans_dep})),1)+'</td><td class="n">'+p(med(big.map(function(b){return last(b).eff})),1)+'</td><td></td></tr>';
 $('sc').innerHTML=az.map(function(b){return row(b)}).join('')+mrow;
 if(!sel.length)sel=az.slice(0,5).map(function(b){return b.cert});
 $('chips').innerHTML=az.slice(0,10).map(function(b,i){return '<button class="chip" data-c="'+b.cert+'" aria-pressed="'+(sel.indexOf(b.cert)>-1)+'">'+esc(b.name.replace(/ (Bank|N\.?A\.?|National Association|Company|& Trust.*)$/i,''))+'</button>'}).join('');
 $('chips').querySelectorAll('button').forEach(function(x){x.onclick=function(){var c=x.dataset.c,k=sel.indexOf(c);if(k>-1)sel.splice(k,1);else sel.push(c);render()}});
 chart(az,big)}
function chart(az,big){
 var avail=Object.keys(MET).filter(function(m){return D.banks.some(function(b){return b.quarters.some(function(q,i){var v=val(b,m,i);return v!=null})})});
 $('met').innerHTML=avail.map(function(m){return '<option value="'+m+'"'+(m===M?' selected':'')+'>'+MET[m][0]+'</option>'}).join('');$('met').onchange=function(){M=this.value;render()};
 var dates=big[0].quarters.map(function(q){return q.date}).slice(-12),S=[];
 sel.forEach(function(c,k){var b=az.filter(function(x){return x.cert==c})[0];if(!b)return;var m={};b.quarters.forEach(function(q,i){m[q.date]=val(b,M,i)});S.push({name:b.name,color:COL[k%COL.length],v:dates.map(function(d){return m[d]==null?null:m[d]})})});
 S.push({name:'Ten largest banks (median)',color:'#555e5a',dash:true,v:dates.map(function(d,i){return med(big.map(function(b){var j=b.quarters.map(function(q){return q.date}).indexOf(d);return j<0?null:val(b,M,j)}))})});
 var all=[];S.forEach(function(s){s.v.forEach(function(x){if(x!=null)all.push(x)})});if(!all.length){$('tr').innerHTML='<p class="fine">No data for this measure.</p>';return}
 var lo=Math.min.apply(null,all),hi=Math.max.apply(null,all),pad=(hi-lo||1)*.1;lo-=pad;hi+=pad;
 var W=760,H=280,pl=48,pr=10,pt=10,pb=26,x=function(i){return pl+(W-pl-pr)*i/(dates.length-1)},y=function(v){return pt+(H-pt-pb)*(1-(v-lo)/(hi-lo))},svg='';
 for(var g=0;g<5;g++){var v=lo+(hi-lo)*g/4;svg+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#dde5e1"/><text x="'+(pl-6)+'" y="'+(y(v)+4)+'" font-size="10" text-anchor="end" fill="#55655f">'+v.toFixed(1)+'</text>'}
 dates.forEach(function(d,i){if(i%3===0||i===dates.length-1)svg+='<text x="'+x(i)+'" y="'+(H-8)+'" font-size="10" text-anchor="'+(i===dates.length-1?'end':i===0?'start':'middle')+'" fill="#55655f">'+qd(d)+'</text>'});
 S.forEach(function(s){var pts=[],seg='';s.v.forEach(function(v,i){if(v==null){if(pts.length)seg+='<polyline fill="none" stroke="'+s.color+'" stroke-width="'+(s.dash?1.6:2)+'"'+(s.dash?' stroke-dasharray="5 4"':'')+' points="'+pts.join(' ')+'"/>';pts=[]}else pts.push(x(i).toFixed(1)+','+y(v).toFixed(1))});if(pts.length)seg+='<polyline fill="none" stroke="'+s.color+'" stroke-width="'+(s.dash?1.6:2)+'"'+(s.dash?' stroke-dasharray="5 4"':'')+' points="'+pts.join(' ')+'"/>';svg+=seg});
 $('tr').innerHTML='<svg class="ch" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+MET[M][0]+' by quarter">'+svg+'</svg>';
 $('lg').innerHTML=S.map(function(s){return '<span><u style="background:'+s.color+'"></u>'+esc(s.name)+'</span>'}).join('')}
fetch('data/banks.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){D=d;
 $('asof').textContent='Latest quarter '+qd(d.latest)+' · refreshed '+d.generated_utc+' UTC'+(d.synthetic?' · TEST FIXTURE, NOT REAL BANKS':'')+'.';$('out').classList.remove('hidden');render()
}).catch(function(){$('asof').textContent='';var s=$('status');s.className='status err';s.textContent='The data file has not been generated yet. In the GitHub repository, open Actions, choose "Update data", and click Run workflow. Refresh this page after it finishes.'});
})();
