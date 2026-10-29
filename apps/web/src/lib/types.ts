export type Account={id:string,name:string,institution:string,kind:string,currency:string,opening_balance:string};
export type Transaction={id:string,account_id:string,destination_account_id:string|null,kind:string,amount:string,occurred_on:string,description:string,category:string,source:string,source_key:string};
export type Budget={id:string,month:string,category:string,currency:string,amount:string};
export type Goal={id:string,name:string,currency:string,target_amount:string,target_date:string};
export type Contribution={id:string,goal_id:string,amount:string};
export type Me={id:string,email:string,profile:{first_name:string,template:string,methods:string[],onboarding_completed:boolean}|null,trial:{started_at:string,expires_at:string,suspended:boolean}|null};
export type Dashboard={currency:string,income:string,expense:string,net:string,recorded_balance:string,balances:Record<string,string>,categories:{name:string,amount:string}[],monthly:{month:string,income:string,expense:string}[],recent:Transaction[]};

// Only presentation ratios use Number. Aggregate decimal amounts in integer cents.
export function sumMoney(values:string[]):string {
  const cents=values.reduce((total,value)=>{const negative=value.startsWith('-');const [whole,fraction='']=value.replace('-','').split('.');const amount=BigInt(whole)*100n+BigInt((fraction+'00').slice(0,2));return total+(negative?-amount:amount);},0n);
  const absolute=cents<0n?-cents:cents;return `${cents<0n?'-':''}${absolute/100n}.${(absolute%100n).toString().padStart(2,'0')}`;
}
