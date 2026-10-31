# Lockfile and privacy-draft checks — 2026-10-31

Revision: aff752b (appeared in the shared repository during verification; this agent did not create that commit). Both pnpm-lock.yaml and the expanded privacy page are in that revision.

## Lockfile correction

Vercel's reported frozen installation failed because three declared TanStack dependencies were absent from the root importer. The repaired pnpm-lock.yaml uses the complete existing installed resolution, including those packages/transitives, without changing package.json dependency ranges or upgrading unrelated locked versions.

`corepack pnpm@10 install --lockfile-only --frozen-lockfile --offline --ignore-scripts`: exit0, pnpm10.34.9. This preserves frozen-lockfile enforcement rather than disabling it. Initial pnpm11 lockfile-only/offline invocation did not update the wanted lockfile; the existing complete node_modules/.pnpm/lock.yaml resolution was used and validated with pnpm10.

A separate temporary project at /private/tmp/calmasta-vercel-lock-check-20261031 received only package.json, pnpm-lock.yaml and pnpm-workspace.yaml. Its offline full install accepted the lockfile but could not finish because tarballs were not cached. The online frozen install is being checked separately; project node_modules and production/deployment services are not involved. Install scripts are disabled for this isolated dependency-resolution check.

## Privacy page checks

`node_modules/.bin/eslint src/app/privacy-policy/page.tsx --max-warnings=0`, `node_modules/.bin/tsc --noEmit` and `git diff --check`: exit0.

`node_modules/.bin/next build`: exit0;52pages/routes generated including static /privacy-policy; TypeScript passed. Existing installed dependencies used. No browser or deployed-page acceptance claimed.

The user supplied MyJooba and info@myjooba.com. The page remains a draft; jurisdiction, production providers, retention schedules and transfer arrangements are not invented. Privacy rights/transparency structure consulted EDPB guidance at https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en and data-handling guidance at https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business. These do not establish that a particular jurisdiction applies or certify the business's practices.

No backend/API/auth logic changes, live email, agent-created commit, push or deployment.
