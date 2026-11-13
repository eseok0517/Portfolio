/* Builds every written finding from the data files, so the text always matches the dashboards. */
(function(){
var COMM_MAX=1e7; /* $10 billion, in thousands */
function last(b){return b.quarters[b.quarters.length-1]}
function yoy(b){var q=b.quarters,n=q.length;return n>=5&&q[n-5].deposits?(q[n-1].deposits/q[n-5].deposits-1)*100:null}
function med(a){a=a.filter(function(x){return x!=null&&isFinite(x)}).sort(function(x,y){return x-y});if(!a.length)return null;var m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2}
function flags(b){var qs=b.quarters,n=qs.length,q=qs[n-1],y=yoy(b),f=[];
 if(q.roa!=null&&q.roa<.5)f.push('Low ROA');
 if(n>=5&&q.nim!=null&&qs[n-5].nim!=null&&q.nim-qs[n-5].nim<=-.25)f.push('Margin squeeze');
 if(q.eq_assets!=null&&q.eq_assets<8)f.push('Thin equity');
 if(q.loans_dep!=null&&q.loans_dep>90)f.push('High loans/deposits');
 if(y!=null&&y<=-5)f.push('Deposit outflow');return f}
var W=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
function w(n){return W[n]!=null?W[n]:String(n)}
function cap(t){return t.charAt(0).toUpperCase()+t.slice(1)}
function pc(x,d){return x==null?'n/a':x.toFixed(d==null?2:d)+'%'}
function qlabel(s){return 'Q'+Math.ceil(+s.slice(4,6)/3)+' '+s.slice(0,4)}
function money(k){var d=k*1000;return d>=1e9?'$'+(d/1e9).toFixed(0)+' billion':'$'+Math.round(d/1e6)+' million'}

function bank(D,BT){
 var az=D.banks.filter(function(b){return b.group==='az'}),big=D.banks.filter(function(b){return b.group==='big'}),peer=D.banks.filter(function(b){return b.group==='peer'});
 if(az.length<3||big.length<3)return null;
 var comm=az.filter(function(b){return last(b).assets<COMM_MAX}),giants=az.filter(function(b){return last(b).assets>=COMM_MAX});
 var L=function(g,k){return med(g.map(function(b){return last(b)[k]}))};
 var ql=qlabel(D.latest),items=[],hasPeer=peer.length>=8&&comm.length>=3;
 var nfA=az.filter(function(b){return flags(b).length}).length,nfC=comm.filter(function(b){return flags(b).length}).length,nfP=peer.filter(function(b){return flags(b).length}).length;
 var out={quarter:ql,hasPeer:hasPeer,flagged:nfA,total:az.length};
 if(hasPeer){
  items.push(['Against similar-sized banks, Arizona community banks earn '+(L(comm,'roa')<L(peer,'roa')?'less':'more')+'.','The '+w(comm.length)+' Arizona banks under $10 billion had a median return on assets of '+pc(L(comm,'roa'))+', against '+pc(L(peer,'roa'))+' for '+peer.length+' banks of similar size in neighboring states ('+qlabel(D.latest)+'). The ten largest banks earned '+pc(L(big,'roa'))+', which mostly reflects size and business mix, not Arizona.']);
  items.push(['Their business model differs from the large banks, not from their peers.','Arizona community banks lent out '+Math.round(L(comm,'loans_dep'))+'% of deposits and ran an efficiency ratio of '+Math.round(L(comm,'eff'))+'%, close to the '+Math.round(L(peer,'loans_dep'))+'% and '+Math.round(L(peer,'eff'))+'% at similar-sized peers. The ten largest banks lent out '+Math.round(L(big,'loans_dep'))+'% and ran '+Math.round(L(big,'eff'))+'%, so most of the gap to them comes from size and funding.']);
  var dC=nfC/comm.length,dP=nfP/peer.length,cmp=dC>dP+.05?'more often than':dC<dP-.05?'less often than':'about as often as';
  items.push(['The warning screens flagged '+Math.round(100*dC)+'% of Arizona community banks and '+Math.round(100*dP)+'% of peers.','Arizona community banks were flagged '+cmp+' similar-sized peers, so the Arizona pattern is '+(Math.abs(dC-dP)<=.05?'typical of small banks in the region.':dC>dP?'weaker than the region, and worth a closer look.':'stronger than the region.')+' Screens that flag a large share of ordinary small banks are a starting point for review, not a ranking.']);
 }else{
  items.push(['Arizona banks earn '+(L(az,'roa')<L(big,'roa')?'less':'more')+' than the largest banks.','Median return on assets was '+pc(L(az,'roa'))+' against '+pc(L(big,'roa'))+' for the ten largest U.S. banks.']);
  items.push(['They lend out '+(L(az,'loans_dep')>L(big,'loans_dep')?'more':'less')+' of their deposits.','Median loans were '+Math.round(L(az,'loans_dep'))+'% of deposits against '+Math.round(L(big,'loans_dep'))+'% at the largest banks, and the median efficiency ratio was '+Math.round(L(az,'eff'))+'% against '+Math.round(L(big,'eff'))+'%.']);
  items.push([cap(w(nfA))+' of '+w(az.length)+' Arizona banks tripped at least one warning screen.','A similar-sized peer group appears here once the weekly data refresh has run.']);
 }
 if(giants.length){var tot=az.reduce(function(s,b){return s+last(b).assets},0),gs=giants.reduce(function(s,b){return s+last(b).assets},0);
  items.push([cap(w(giants.length))+' bank'+(giants.length>1?'s hold':' holds')+' '+Math.round(100*gs/tot)+'% of Arizona-headquartered bank assets.','That is why the community banks are compared with similar-sized peers and the giants with the ten largest banks.'])}
 var bt=backtest(BT);if(bt){items.push([bt.head,bt.text]);out.backtest=bt}
 out.items=items;
 out.headline=cap(w(nfA))+' of '+w(az.length)+' Arizona banks tripped a screen in '+ql+'; '+(hasPeer?'community-bank ROA '+pc(L(comm,'roa'))+' vs '+pc(L(peer,'roa'))+' at similar-sized peers.':'median ROA '+pc(L(az,'roa'))+' vs '+pc(L(big,'roa'))+' at the largest banks.');
 out.card=cap(w(nfA))+' of '+w(az.length)+' Arizona banks tripped at least one warning screen in '+ql+'. '+(hasPeer?'Community-bank median ROA was '+pc(L(comm,'roa'))+', against '+pc(L(peer,'roa'))+' for similar-sized peers and '+pc(L(big,'roa'))+' for the ten largest banks.':'Median ROA was '+pc(L(az,'roa'))+' against '+pc(L(big,'roa'))+' for the ten largest banks.')+(bt?' '+bt.short:'');
 return out}

function backtest(BT){
 if(!BT||!BT.windows||!BT.windows.length)return null;
 var c=BT.windows.filter(function(x){return x.id==='crisis'})[0]||BT.windows[0];
 if(c.failed_any==null||c.survivors_any==null)return null;
 var lift=c.survivors_any>0?c.failed_any/c.survivors_any:null;
 var head='Back-test: '+Math.round(c.failed_any)+'% of banks that later failed tripped a screen a year before, against '+Math.round(c.survivors_any)+'% of survivors.';
 var text='In the '+c.name+', '+c.failed_n+' failed banks were screened using their call reports from about one year before failure, alongside '+c.survivor_obs+' bank-date observations from banks that survived. Two or more screens fired for '+Math.round(c.failed_2plus)+'% of failures and '+Math.round(c.survivors_2plus)+'% of survivors. '
  +(lift?'Failed banks were '+lift.toFixed(1)+' times as likely as survivors to have tripped a screen, but ':'')+'many surviving banks tripped one too, so the screens work as a place to start a review, not as a prediction.';
 var r=BT.windows.filter(function(x){return x.id==='recent'})[0];
 if(r&&r.failed_any!=null)text+=' In the '+r.name+', '+Math.round(r.failed_any)+'% of '+r.failed_n+' failures tripped a screen against '+Math.round(r.survivors_any)+'% of survivors.';
 return {head:head,text:text,short:'In a back-test on '+c.failed_n+' bank failures, '+Math.round(c.failed_any)+'% had tripped a screen a year earlier, against '+Math.round(c.survivors_any)+'% of survivors.',window:c}}

function equity(d){
 var n=d.months.length,P={};d.tickers.forEach(function(t){P[t.symbol]=t.prices});var c=d.macro.curve,cpi=d.macro.cpi_yoy;
 if(!P.NVDA||!P.SPY||!P.JPM||!P.GS||!P.TLT)return null;
 function cagr(s){var a=P[s].filter(function(x){return x}),yrs=(n-1)/12;return(Math.pow(a[a.length-1]/a[0],1/yrs)-1)*100}
 function mdd(s){var pk=0,m=0;P[s].forEach(function(v){if(v){pk=Math.max(pk,v);m=Math.min(m,v/pk-1)}});return -m*100}
 function fwd(s,test){var v=[];for(var i=0;i+12<n;i++){var t=test(i);if(t==null||!P[s][i]||!P[s][i+12])continue;v.push({t:t,r:(P[s][i+12]/P[s][i]-1)*100})}return v}
 function avg(v,t){v=v.filter(function(x){return x.t===t});return v.length?v.reduce(function(a,x){return a+x.r},0)/v.length:null}
 var inv=function(i){return c[i]==null?null:c[i]<0},hi=function(i){return cpi[i]==null?null:cpi[i]>=3};
 var eps=0,prev=false;c.forEach(function(x){var cur=x!=null&&x<0;if(cur&&!prev)eps++;prev=cur});
 var R=Math.round,y=d.months[0].slice(0,4),end=d.months[n-1];
 var jpm=fwd('JPM',inv),gs=fwd('GS',inv),spy=fwd('SPY',hi),xom=fwd('XOM',hi);
 var items=[];
 items.push(['Higher return came with deeper losses.','NVIDIA returned '+R(cagr('NVDA'))+'% a year since '+y+' but fell '+R(mdd('NVDA'))+'% at its worst; the S&P 500 ETF (SPY) returned '+R(cagr('SPY'))+'% a year with a '+R(mdd('SPY'))+'% drop.'+(P.JNJ?' Johnson & Johnson returned '+R(cagr('JNJ'))+'% with a '+R(mdd('JNJ'))+'% drop.':'')]);
 items.push(['Long Treasuries earned little over the period.','TLT returned '+cagr('TLT').toFixed(1)+'% a year and still fell '+R(mdd('TLT'))+'% from its peak, because rising rates hit bond prices.']);
 var a1=avg(jpm,true),a2=avg(gs,true),b1=avg(jpm,false),b2=avg(gs,false);
 if([a1,a2,b1,b2].every(function(x){return x!=null}))items.push(['Banks did best after the yield curve inverted.','Average 12-month returns after an inverted curve were '+R(a1)+'% for JPMorgan and '+R(a2)+'% for Goldman Sachs, against '+R(b1)+'% and '+R(b2)+'% after a normal curve, but this rests on only '+w(eps)+' inversion episode'+(eps===1?'':'s')+'.']);
 var h=avg(spy,true),l=avg(spy,false),xh=avg(xom,true),xl=avg(xom,false);
 if([h,l].every(function(x){return x!=null}))items.push(['Inflation separated the winners.','After high-inflation months SPY averaged '+h.toFixed(1)+'% against '+l.toFixed(1)+'% after low-inflation months.'+(xh!=null&&xl!=null?' Exxon did '+(xh>xl?'better':'worse')+' in high inflation ('+xh.toFixed(1)+'% vs '+xl.toFixed(1)+'%).':'')]);
 return {items:items,period:y+' to '+end,
  card:'Higher returns came with deeper losses: NVIDIA returned '+R(cagr('NVDA'))+'% a year since '+y+' but fell '+R(mdd('NVDA'))+'% at its worst, versus '+R(cagr('SPY'))+'% a year and a '+R(mdd('SPY'))+'% drop for SPY.'+(a1!=null?' After the yield curve inverted, JPMorgan and Goldman Sachs averaged '+R(a1)+'% and '+R(a2)+'% over the next year, against '+R(b1)+'% and '+R(b2)+'% otherwise.':''),
  headline:'NVIDIA returned '+R(cagr('NVDA'))+'% a year with a '+R(mdd('NVDA'))+'% drawdown vs '+R(cagr('SPY'))+'% and '+R(mdd('SPY'))+'% for SPY; banks led after yield-curve inversions.'}}

function list(items){return items.map(function(i){return '<li><b>'+i[0]+'</b> '+i[1]+'</li>'}).join('')}
function load(u){return fetch(u,{cache:'no-store'}).then(function(r){if(!r.ok)throw 0;return r.json()}).catch(function(){return null})}
window.Findings={bank:bank,equity:equity,list:list,load:load,flags:flags,last:last,med:med,yoy:yoy,COMM_MAX:COMM_MAX};
})();
