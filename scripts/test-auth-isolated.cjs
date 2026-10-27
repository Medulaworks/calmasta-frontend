const {mkdtempSync, mkdirSync, rmSync, readFileSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join} = require('node:path');
const {spawnSync} = require('node:child_process');
const dir=mkdtempSync(join(tmpdir(),'calmasta-tests-'));
const data=join(dir,'pg'),socket=join(dir,'socket');mkdirSync(socket,{mode:0o700});
const bin=name=>process.env.PG_BIN?join(process.env.PG_BIN,name):name;
const run=(name,args,options={})=>{const p=spawnSync(name,args,{stdio:'inherit',...options});if(p.error)throw p.error;if(p.status!==0)throw new Error(`${name} failed (${p.status})`);};
let started=false;
try{
 run(bin('initdb'),['-D',data,'-A','trust','--no-locale','--encoding=UTF8']);
 run(bin('pg_ctl'),['-D',data,'-l',join(dir,'postgres.log'),'-o',`-k ${socket} -h "" -p 55483`,'start']);started=true;
 const user=require('node:os').userInfo().username;
 const url=`postgresql://${encodeURIComponent(user)}@localhost:55483/postgres?host=${encodeURIComponent(socket)}`;
 run(process.platform==='win32'?'pnpm.cmd':'pnpm',['exec','vitest','run','src/server/auth'],{env:{...process.env,TEST_DATABASE_URL:url}});
}catch(error){console.error(error.message);process.exitCode=1;}
finally{
 if(started){const p=spawnSync(bin('pg_ctl'),['-D',data,'-m','fast','stop'],{stdio:'inherit'});if(p.status!==0){console.error('Temporary PostgreSQL cleanup failed');process.exitCode=1;}}
 if(!started || process.exitCode!==1)rmSync(dir,{recursive:true,force:true});
 else console.error('Failed test diagnostics retained in temporary test directory; remove after inspection.');
}
