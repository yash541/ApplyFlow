import { runPortal } from "./shared/portal-runner";
import { greenhouseAdapter } from "./adapters/greenhouse";
import { leverAdapter } from "./adapters/lever";
import { ashbyAdapter } from "./adapters/ashby";
import { indeedAdapter } from "./adapters/indeed";
import { glassdoorAdapter } from "./adapters/glassdoor";
import { wellfoundAdapter } from "./adapters/wellfound";
import { smartrecruitersAdapter } from "./adapters/smartrecruiters";
import { workableAdapter } from "./adapters/workable";
import { bamboohrAdapter } from "./adapters/bamboohr";
import { jobviteAdapter } from "./adapters/jobvite";
import { icimsAdapter } from "./adapters/icims";

const host = location.hostname;

const adapter =
  // Phase 2 — ATS portals
  host === "boards.greenhouse.io"     ? greenhouseAdapter :
  host === "jobs.lever.co"            ? leverAdapter :
  host === "jobs.ashbyhq.com"         ? ashbyAdapter :
  // Phase 3 — Job boards
  // All country subdomains: www.indeed.com, in.indeed.com, uk.indeed.com, etc.
  host.endsWith(".indeed.com") || host === "indeed.com" ? indeedAdapter :
  // All country domains: glassdoor.com, glassdoor.co.in, glassdoor.co.uk, glassdoor.de, etc.
  host.includes("glassdoor.")         ? glassdoorAdapter :
  host === "wellfound.com"            ? wellfoundAdapter :
  // Phase 4 — Remaining ATSes
  host === "jobs.smartrecruiters.com" ? smartrecruitersAdapter :
  host === "apply.workable.com"       ? workableAdapter :
  host.endsWith(".bamboohr.com")      ? bamboohrAdapter :
  host === "jobs.jobvite.com"         ? jobviteAdapter :
  host.endsWith(".icims.com")         ? icimsAdapter :
  null;

if (adapter) runPortal(adapter);
