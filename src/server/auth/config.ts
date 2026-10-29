export interface AuthConfig {
 trustProxy?:boolean;appOrigin:string;apiOrigin:string;sessionSecret:string;secure:boolean;
 callbackUrl:string;sessionCookie:string;transactionCookie:string;
}
export function authConfig(env:NodeJS.ProcessEnv=process.env):AuthConfig {
 const required=(name:string)=>{const v=env[name]?.trim();if(!v)throw Error(`Missing ${name}`);return v;};
 const origin=(name:string,allowLocal:boolean)=>{
  const u=new URL(required(name));const local=["localhost","127.0.0.1","[::1]"].includes(u.hostname);
  if(u.username||u.password||u.search||u.hash||u.pathname!=="/"||(u.protocol!=="https:"&&!(allowLocal&&local&&u.protocol==="http:")))throw Error(`Invalid ${name}`);return u.origin;
 };
 const appOrigin=origin("APP_URL",env.NODE_ENV!=="production"),apiOrigin=origin("CALMASTA_API_URL",true),sessionSecret=required("SESSION_SECRET");
 if(!/^[a-f0-9]{64}$/i.test(sessionSecret))throw Error("Invalid SESSION_SECRET");
 if(env.NODE_ENV==="production"&&env.AUTH_TRUST_PROXY!=="true")throw Error("AUTH_TRUST_PROXY=true requires a trusted platform proxy that appends client IP");
 const secure=appOrigin.startsWith("https:");return {trustProxy:env.AUTH_TRUST_PROXY==="true",appOrigin,apiOrigin,sessionSecret,secure,callbackUrl:appOrigin+"/api/auth/callback",sessionCookie:secure?"__Host-calmasta_session":"calmasta_session",transactionCookie:secure?"__Host-calmasta_oauth":"calmasta_oauth"};
}
