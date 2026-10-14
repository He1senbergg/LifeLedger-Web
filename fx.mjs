export const FX_URL='https://api.frankfurter.dev/v2/rates?base=CNY&quotes=USD,JPY,GBP,HKD,EUR';
export function parseRates(rows){
 if(!Array.isArray(rows)||!rows.length)throw Error('汇率数据为空');
 const rates={CNY:1},dates={};
 for(const row of rows){
  if(row.base!=='CNY'||!['USD','JPY','GBP','HKD','EUR'].includes(row.quote)||typeof row.rate!=='number'||!Number.isFinite(row.rate)||row.rate<=0||!/^\d{4}-\d{2}-\d{2}$/.test(row.date))throw Error('汇率数据格式无效');
  rates[row.quote]=1/row.rate;dates[row.quote]=row.date;
 }return {rates,dates};
}
export function convertedBalance(balances,rates){
 let sum=0;const missing=[];
 for(const b of balances){if(!Number.isFinite(b.amount))throw Error('余额无效');if(b.currency==='CNY'){sum+=b.amount;continue;}if(b.amount===0)continue;const rate=rates?.[b.currency];if(!Number.isFinite(rate)||rate<=0){missing.push(b.currency);continue;}sum+=b.amount*rate;}
 return {amount:missing.length?null:Math.round(sum*100)/100,missing:[...new Set(missing)]};
}
