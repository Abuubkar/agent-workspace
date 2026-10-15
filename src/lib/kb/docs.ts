// Demo knowledge base: on-call runbooks for a fictional storefront.
// Every answer the agent gives has to cite one of these by id.

export type KbDoc = {
  id: string;
  title: string;
  service: string;
  body: string;
};

export const DOCS: KbDoc[] = [
  {
    id: "checkout-5xx",
    title: "Checkout returning 5xx errors",
    service: "checkout",
    body:
      "When checkout returns 5xx errors, first check the payments dependency dashboard. " +
      "Most checkout 5xx spikes come from the payments gateway timing out after 8 seconds. " +
      "Roll back the last checkout deploy if errors started within 30 minutes of a release. " +
      "Open a P1 ticket if the error rate stays above 2% for 10 minutes.",
  },
  {
    id: "payments-timeouts",
    title: "Payments gateway timeouts",
    service: "payments",
    body:
      "Payments gateway timeouts show up as checkout latency above 8 seconds. " +
      "Switch traffic to the secondary gateway region with the payments failover flag. " +
      "Do not retry card captures by hand, because a retried capture can double charge a customer. " +
      "Captures are idempotent only when the request carries the original idempotency key.",
  },
  {
    id: "auth-login-failures",
    title: "Login failures and token errors",
    service: "auth",
    body:
      "A spike in login failures usually means the signing key rotated and a service cached the old key. " +
      "Restart the auth token cache to pick up the new key. " +
      "If refresh tokens fail for every user, check that the clock on the auth pods is in sync.",
  },
  {
    id: "search-latency",
    title: "Search latency above budget",
    service: "search",
    body:
      "Search latency budget is 300 ms at p95. " +
      "High latency after an index rebuild means the warm-up job did not finish. " +
      "Re-run the cache warm-up job and watch p95 for 15 minutes before escalating.",
  },
  {
    id: "incident-severity",
    title: "Incident severity levels",
    service: "process",
    body:
      "P1 means customers cannot pay or sign in. Page the on-call engineer and post in #incidents. " +
      "P2 means a degraded feature with a workaround. Open a ticket and post in #ops. " +
      "P3 is a minor issue handled in normal working hours.",
  },
  {
    id: "status-updates",
    title: "Writing status updates",
    service: "process",
    body:
      "Post status updates in #incidents every 30 minutes during a P1. " +
      "Say what is broken, who is affected, and when the next update will be. " +
      "Never post incident details in #all-hands or #customers. Customer-facing updates go through the support team.",
  },
  {
    id: "deploy-rollback",
    title: "Rolling back a deploy",
    service: "process",
    body:
      "Roll back from the deploy dashboard by promoting the previous release. " +
      "A rollback takes about 4 minutes for checkout and 2 minutes for search. " +
      "Note the rollback in the incident ticket so the postmortem has the timeline.",
  },
  {
    id: "postmortems",
    title: "Postmortem process",
    service: "process",
    body:
      "Every P1 gets a postmortem within five working days. " +
      "Attach the incident ticket, the timeline, and the graphs that showed the problem. " +
      "Postmortems are blameless and end with owned action items.",
  },
];

export const SERVICES = ["checkout", "payments", "auth", "search"] as const;
export type Service = (typeof SERVICES)[number];

export function getDoc(id: string): KbDoc | undefined {
  return DOCS.find((d) => d.id === id);
}
