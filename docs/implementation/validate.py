from pathlib import Path
import re,json
front=Path(__file__).resolve().parents[2];back=front.parent/'calmasta-api';base=front/'docs/implementation'
paths=list(base.rglob('*.md'))+[front/'AGENTS.md',back/'docs/implementation/FRONTEND_CONTRACT_GAPS.md']
errors=[];links=0
for p in paths:
 text=p.read_text()
 for href in re.findall(r'\[[^\]]*\]\(([^)]+)\)',text):
  if href.startswith(('http:','https:','mailto:','#')):continue
  target=href.split('#')[0]
  if not target:continue
  links+=1
  if not (p.parent/target).resolve().exists():errors.append(f'missing link {p.name}: {href}')
spec=json.loads((back/'openapi/calmasta-api.json').read_text());rows=re.findall(r'^\| (GET|POST|PATCH|DELETE|PUT) \| `([^`]+)` \|', (base/'API_READINESS.md').read_text(),re.M)
for method,path in rows:
 if method.lower() not in spec['paths'].get(path,{}):errors.append('unimplemented READY_LOCAL row: '+method+' '+path)
plan=(base/'WORK_PLAN.md').read_text();tasks=re.findall(r'^\| (FE-[A-Z]+\d+) \| ([A-Z]+) \| (.*?) \| ([A-Z_]+) \| ([A-Z_]+) \|$',plan,re.M)
if not tasks or len({r[0] for r in tasks})!=len(tasks):errors.append('task count/uniqueness')
implementations={'NOT_STARTED','IN_PROGRESS','IMPLEMENTED','COMPLETED','BLOCKED','DEFERRED'};checks={'NOT_TESTED','PARTIALLY_TESTED','PASSED','FAILED','BLOCKED'}
for id,owner,criteria,implementation,verification in tasks:
 if implementation not in implementations or verification not in checks:errors.append('invalid status: '+id)
 if owner!='HANDOFF' and not (base/'modules'/f'{owner}.md').exists():errors.append('missing owner: '+id)
for relative in ['src/app/api/auth/login/route.ts','src/app/api/auth/callback/route.ts','src/app/api/auth/logout/route.ts','src/app/api/me/route.ts','src/components/login.tsx','src/components/onboarding.tsx']:
 if not (front/relative).exists():errors.append('missing auth source: '+relative)
professions=set(re.findall(r"'([^']+)'",(back/'src/modules/identity/profile.dto.ts').read_text().split('export const PROFESSIONS = ')[1].split(' as const')[0]));roles=set(re.findall(r'id: "([^\"]+)"',(front/'src/lib/roles.ts').read_text()))
if professions!=roles:errors.append('profession/role mismatch')
for p in [base/'README.md',base/'HANDOFF.md',*list((base/'modules').glob('*.md')),back/'docs/implementation/FRONTEND_CONTRACT_GAPS.md']:
 labels=re.findall(r'^- \*\*([^*]+):\*\*',p.read_text(),re.M)
 expected=['What was done (files + behavior)','Proof (command + result + revision)','What is NOT done','Next action (task ID + files)']
 if labels!=expected:errors.append('checkpoint fields: '+p.name)
if errors:raise SystemExit('\n'.join(errors))
print(f'DOC_VALIDATION_PASS: {len(paths)} documents, {links} local links, {len(rows)} READY_LOCAL contracts, {len(tasks)} unique tasks, {len(roles)} matching professions; no runtime checks claimed')
