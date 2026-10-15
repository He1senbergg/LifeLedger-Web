export const kindLabel=s=>String(s).replaceAll('理财','投资');
export const isInvestment=r=>['理财支出','投资支出','国债支出'].includes(r.kind);
export const isValuation=r=>['理财余额','投资余额','国债余额'].includes(r.kind);
export const assetOf=r=>r.investment?.asset||(r.kind.startsWith('国债')?'bond':'fund');
export const assetNames={fund:'投资',bond:'国债',gold:'黄金'};
export const accountOfAsset={fund:'理财余额',bond:'国债余额',gold:'黄金余额'};
export function normalizeTags(value){return [...new Set((Array.isArray(value)?value:String(value||'').split(/[,，;；\n]+/)).map(s=>s.trim()).filter(Boolean))].slice(0,12);}
export function inferTags(r,meta={}){
 if(!['收入','其它','其他','支出'].includes(r.kind)||r.date<'2025-06-01')return [];
 const text=r.category+' '+r.description;
  const linked=Object.entries(meta).filter(([k,p])=>k.startsWith('project:')&&!p.deleted&&p.items?.some(i=>i.recordId===r.id&&['expense','refund','reimbursement'].includes(i.role))).map(([,p])=>p.name);
 if(linked.some(n=>/电子设备|电脑|iPad|手机|手表/.test(n)))return ['电子设备'];
 if(linked.some(n=>/旅行/.test(n)))return ['旅行'];
 if(r.kind!=='支出'&&r.amount<0){
  for(const [tag,re]of [['工资奖金',/工资|薪资|年终奖/],['公积金',/公积金/],['报销回款',/报销|合租|平摊|AA|aa|付钱|回款|出钱/],['退款赔付',/退款|退钱|退货|赔|退账|退税/],['利息',/结息|利息|存息/],['红包补贴',/红包|补贴|中奖/],['劳务收入',/报酬|投稿/]])if(re.test(text))return [tag];
  return ['待分类'];
 }
 const rules=[['电子设备',/手机|小米\d|红米|iPhone|Apple|苹果|礼品卡|美区|ChatGPT|GPT|Switch|手柄|显卡|主板|内存|硬盘|极空间|NAS|StressWatch|elden|艾尔登|电池|屏幕|摄像头|充电|数据线|键盘|鼠标|耳机|音箱|电脑/i],['住房水电',/房租|租金|电费|水费|燃气|物业/],['餐饮',/早餐|早饭|午饭|晚饭|中饭|午餐|晚餐|麦当劳|肯德基|汉堡|披萨|凉拌菜|盒饭|食堂|外卖|麻辣|米饭|面条|拉面|火锅|包子|饺子|烧烤|炸鸡|餐费/],['食品饮料',/牛奶|酸奶|咖啡|饮料|奶茶|水果|鸡蛋|面包|零食|饼干|巧克力|茶叶|蛋糕|超市|蔬菜/],['交通',/打车|滴滴|高德|地铁|公交|车票|交通|停车|加油|携程|机票|火车/],['医疗健康',/医院|挂号|药|体检|牙|眼镜/],['通信订阅',/话费|流量|宽带|VPN|网费|月费|订阅/i],['日用服饰',/纸巾|抽纸|卫生纸|洗|牙刷|牙膏|衣|裤|袜|鞋|毛巾|垃圾袋|日用品/],['娱乐学习',/游戏|电影|书|课程|演出|门票/],['快递',/快递|运费|顺丰/],['人情往来',/红包|请客|礼物|份子|孝敬/]];
 const extra=[['交通',/12306|高铁|动车|修车|电瓶车|自行车/],['旅行',/护照|签证|美签|船票|索道|JR |PASS\d/i],['住房水电',/租房|押金/],['电子设备',/散热器|绿联|转换器|风扇|电扇/],['娱乐学习',/教辅|资料册|笔记本|文具|教父/],['医疗健康',/医保|黄道益|双飞人|五黑膏|按摩/],['食品饮料',/牛腱肉|光明优加/],['日用服饰',/剃须刀/],['人情往来',/给妈妈|分享黄金收益/]];
 for(const[tag,re]of [...extra,...rules])if(re.test(text))return [tag];
 return ['待分类'];
}
export function tagsOf(r,meta){return Array.isArray(r.tags)?r.tags:inferTags(r,meta);}
export function tagStats(records,{from,to,currency='CNY',side='expense',tag='',meta={}}){
 const groups=new Map;let total=0,count=0,untagged=0,early=0;
 for(const r of records){if(r.deleted||r.date<from||r.date>to||r.currency!==currency)continue;
  if(side==='expense'?r.kind!=='支出':!['收入','其它','其他'].includes(r.kind))continue;
  if(r.date<'2025-06-01'){early++;continue;}const tags=tagsOf(r,meta);if(tag&&!tags.includes(tag))continue;
  const primary=tags[0]||'待分类',amount=Math.round((side==='expense'?r.amount:-r.amount)*100);if(primary==='待分类')untagged++;
  groups.set(primary,(groups.get(primary)||0)+amount);total+=amount;count++;
 }return {total:total/100,count,untagged,early,groups:[...groups].map(([tag,value])=>({tag,amount:value/100})).sort((a,b)=>b.amount-a.amount)};
}
export function allocation(balances,rates={}){
 const groups={cash:0,bond:0,fund:0};let missing=false;
 for(const b of balances){const rate=b.currency==='CNY'?1:rates?.[b.currency];if(!Number.isFinite(rate)&&b.amount){missing=true;continue;}const key=b.account==='国债余额'?'bond':['理财余额','投资余额','黄金余额'].includes(b.account)?'fund':'cash';groups[key]+=b.amount*(rate||0);}
 const total=Object.values(groups).reduce((a,b)=>a+b,0);return {missing,total,items:[['cash','现金存款','#466c59'],['bond','国债','#8e71b5'],['fund','投资','#d2a44d']].map(([key,name,color])=>({name,color,amount:groups[key],share:total?groups[key]/total:0}))};
}
export function investmentSummary(records,balances,until){
 const rs=records.filter(r=>!r.deleted&&r.date<=until).sort((a,b)=>a.date.localeCompare(b.date)||(a.source?.row??1e9)-(b.source?.row??1e9)||a.updatedAt.localeCompare(b.updatedAt));
 return ['fund','bond','gold'].map(asset=>{const flows=rs.filter(r=>isInvestment(r)&&assetOf(r)===asset&&r.currency==='CNY');let buys=0,sells=0,distributed=0,cost=0,realized=0;
  for(const r of flows){if(r.investment?.action==='dividend'){distributed+=-r.amount;continue;}if(r.amount>=0){buys+=r.amount;cost+=r.amount;}else{sells-=r.amount;const fraction=r.investment?.closed?1:r.investment?.costSold!=null&&cost>0?Math.min(1,r.investment.costSold/cost):null;if(fraction!==null){const soldCost=cost*fraction;realized+=-r.amount-soldCost;cost-=soldCost;}else cost=NaN;}}
  const value=balances.find(b=>b.account===accountOfAsset[asset]&&b.currency==='CNY')?.amount??0,profit=Math.round((value+sells+distributed-buys)*100)/100;
  const valuations=rs.filter(r=>isValuation(r)&&assetOf(r)===asset),last=valuations.at(-1);
  return {asset,name:assetNames[asset],buys,sells,distributed,cost:Number.isFinite(cost)?cost:null,value,profit,roi:buys?profit/buys:null,realized:Number.isFinite(cost)?realized:null,first:flows[0]?.date,lastValuation:last?.date,flows,warning:value>0&&!buys?'缺少期初本金或买入流水，暂不能计算完整收益':null};
 });
}
export function savingBaseline(records,today,meta={}){
 const end=today.slice(0,7),months=[...new Set(records.filter(r=>r.date>='2025-06-01'&&r.date.slice(0,7)<end).map(r=>r.date.slice(0,7)))].sort().slice(-6);
 const income=[],routine=[],big=[];
 for(const m of months){const rs=records.filter(r=>!r.deleted&&r.currency==='CNY'&&r.date.startsWith(m));income.push(rs.filter(r=>r.kind==='收入'&&/工资|薪资/.test(r.category+' '+r.description)).reduce((n,r)=>n-r.amount,0));let a=0,b=0;for(const r of rs.filter(r=>r.kind==='支出')){if(tagsOf(r,meta).some(t=>['电子设备','旅行'].includes(t)))b+=r.amount;else a+=r.amount;}routine.push(a);big.push(b);}
 const median=xs=>{const v=xs.slice().sort((a,b)=>a-b);return v.length?(v[Math.floor((v.length-1)/2)]+v[Math.ceil((v.length-1)/2)])/2:0;};
 return {months,salary:Math.round(median(income)),routine:Math.round(median(routine)),annualBig:Math.round(big.reduce((a,b)=>a+b,0)/Math.max(1,months.length)*12)};
}
export function reachMonth(start,monthly,annualRate,target,limit=1200){if(start>=target)return 0;let value=start;const rate=Math.pow(1+annualRate,1/12)-1;for(let i=1;i<=limit;i++){value=value*(1+rate)+monthly;if(value>=target)return i;if(!Number.isFinite(value)||value<0)return null;}return null;}
