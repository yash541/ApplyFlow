import { runPortal } from "./shared/portal-runner";
import { linkedInAdapter } from "./adapters/linkedin";

// Re-export showToast so other modules that imported it from here still work
export { showToast } from "./shared/toast";

runPortal(linkedInAdapter);
