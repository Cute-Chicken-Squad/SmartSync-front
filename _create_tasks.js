const https = require('https');
const SVC = 'service.ss.leeinx.com';
const ADM = 'admin.ss.leeinx.com';

function api(h,m,p,t,b){return new Promise(r=>{const o={hostname:h,path:p,method:m,headers:{'Content-Type':'application/json'},rejectUnauthorized:false};if(t)o.headers['Authorization']='Bearer '+t;const q=https.request(o,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{const j={code:res.statusCode,raw:d};try{Object.assign(j,JSON.parse(d))}catch(e){}r(j)})});q.on('error',e=>r({error:e.message}));if(b)q.write(JSON.stringify(b));q.end()})}

async function main(){
  const al=await api(ADM,'POST','/admin/api/auth/login',null,{username:'admin',password:'9a0e8c9ca0a614c6527581f1'});
  const admT=al.data.token;
  const code='SEED'+Date.now().toString(36).toUpperCase();
  const secret='sk'+Date.now().toString(36);

  console.log('1. Register',code);
  await api(SVC,'POST','/api/auth/register',null,{terminalCode:code,terminalName:'任务终端',secretKey:secret});

  console.log('2. Find & activate');
  const tp=await api(ADM,'GET','/admin/api/terminal/page?current=1&size=50',admT);
  // Find the terminalCode in raw, then find the nearest preceding id
  const idx=tp.raw.indexOf('"'+code+'"');
  const before=tp.raw.substring(Math.max(0,idx-300), idx);
  const idMatch=before.match(/"id":(\d{15,20})/);
  if(!idMatch){console.log('ID not found near terminalCode');return;}
  console.log('   id='+idMatch[1]);

  const en=await api(ADM,'PUT','/admin/api/terminal/'+idMatch[1]+'/status?status=1',admT);
  console.log('   activate:',en.code,en.message||'OK');

  console.log('3. Login');
  const tl=await api(SVC,'POST','/api/auth/login',null,{terminalCode:code,secretKey:secret});
  console.log('   ',tl.code,tl.message||'OK');
  if(!tl.data?.token){console.log('Login failed');return;}
  const termT=tl.data.token;

  console.log('4. Detect patients at substation');
  const rfids=['BC1111111111','BC2222222222','BC3333333333','BC4444444444','BC5555555555','BC6666666666','BC7777777777','BC8888888888'];
  for(const rfid of rfids){
    const r=await api(SVC,'POST','/api/substation/detect',termT,{stationId:'MAP-DEMO-1F06',nfcId:rfid});
    console.log('   '+rfid, r.code, r.message||'OK');
  }

  console.log('5. Tasks');
  const tk=await api(ADM,'GET','/admin/api/tasks/list',admT);
  console.log('   Total:', Array.isArray(tk.data)?tk.data.length:0);
  if(Array.isArray(tk.data)) tk.data.forEach(t=>console.log('   -',t.patientName,t.currentStep));
}
main();
