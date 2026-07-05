# Admin Console Gaps and Roadmap (PRD Checklist)

## Context

Current `apps/admin` capabilities cover:

- Admin auth/session
- Platform stats dashboard
- User list + filters + user detail edits (premium/founder)
- Founder invites (send/list/revoke)
- Activity/audit log
- App config management

This PRD focuses on high-impact missing capabilities for scale, safety, and operator efficiency.

---

## Goals

- Improve support and ops velocity
- Reduce risk from sensitive admin actions
- Increase auditability and compliance readiness
- Enable safer product rollouts and growth operations

## Non-Goals

- Full redesign of admin UI
- Rebuilding existing user/config/invite pages from scratch
- Introducing external BI tooling in first phase

---

## 1) RBAC and Permissioning

### Problem

Single admin role is too broad and risky as team size grows.

### Outcome

Least-privilege admin access with clear role boundaries.

### Checklist

- [ ] Define roles: `super_admin`, `ops_admin`, `support_admin`, `growth_admin`, `read_only_admin`
- [ ] Define permission matrix per action/page/API endpoint
- [ ] Enforce permissions in backend middleware (source of truth)
- [ ] Add frontend route/action guards per permission
- [ ] Add “permission denied” UX states
- [ ] Add audit events for role/permission changes
- [ ] Add migration plan for existing admins

### Success Metrics

- 0 unauthorized sensitive actions by role
- 100% sensitive endpoints permission-guarded

---

## 2) Admin Action Safeguards

### Problem

Sensitive changes can be made without context/intent capture.

### Outcome

Safer operations with explicit accountability.

### Checklist

- [ ] Require “reason” input for sensitive mutations (premium/founder/config changes)
- [ ] Add confirmation modal with exact change summary
- [ ] Optional: add two-person approval for critical operations
- [ ] Add immutable audit metadata: before/after/reason/actor/ip
- [ ] Add rollback guidance for each sensitive action (where possible)

### Success Metrics

- 100% sensitive actions include reason
- Reduced accidental high-impact changes

---

## 3) Global Search + Saved Views

### Problem

Operators spend too long finding target entities.

### Outcome

Fast discovery and repeatable workflows.

### Checklist

- [ ] Add global search bar in admin shell
- [ ] Support lookup by: user id, email, vault id, invite id, actor id
- [ ] Add quick navigation results (users/activity/invites)
- [ ] Add saved filter views for Users and Activity pages
- [ ] Add “recent searches” for operator productivity

### Success Metrics

- Median “find target record” time reduced by 50%

---

## 4) User 360 Timeline (Support Cockpit)

### Problem

Support needs cross-system context in one place.

### Outcome

Single pane of glass for user troubleshooting.

### Checklist

- [ ] Add timeline section to user detail:
  - [ ] auth/session events
  - [ ] premium/founder changes
  - [ ] invite status/history
  - [ ] key vault lifecycle events
  - [ ] push/email delivery events (if available)
- [ ] Add internal admin notes (private)
- [ ] Add user tags/labels (e.g., VIP, at-risk, fraud-review)

### Success Metrics

- First-response resolution time reduced
- Fewer escalations due to missing context

---

## 5) Bulk Operations

### Problem

One-by-one actions do not scale.

### Outcome

Batch workflows for repetitive admin tasks.

### Checklist

- [ ] Add multi-select in users table
- [ ] Add bulk actions with safeguards:
  - [ ] bulk premium update
  - [ ] bulk founder update
  - [ ] bulk invite revoke/resend
- [ ] Add dry-run preview before execute
- [ ] Add bulk job status + result report
- [ ] Add bulk action audit logging

### Success Metrics

- 70% reduction in manual repetitive admin actions

---

## 6) Observability and Operational Health in Admin

### Problem

Ops issues are discovered too late or outside admin context.

### Outcome

Proactive detection and faster triage.

### Checklist

- [ ] Add health widgets on Home:
  - [ ] auth failures trend
  - [ ] failed email deliveries
  - [ ] failed push deliveries
  - [ ] API error rate snapshot
- [ ] Add links to filtered Activity views from widgets
- [ ] Add alert thresholds + visual severity states

### Success Metrics

- Reduced MTTD and MTTR for operational incidents

---

## 7) Feature Flags and Rollouts

### Problem

Risky launches without granular rollout controls.

### Outcome

Safe progressive delivery and rapid rollback.

### Checklist

- [ ] Add feature flag model and admin UI
- [ ] Add platform targeting (iOS/Android/Web)
- [ ] Add rollout % and cohort targeting
- [ ] Add emergency kill switch
- [ ] Add flag change audit logging

### Success Metrics

- Reduced rollout regressions
- Faster mitigation during incidents

---

## 8) Data Governance and Compliance Workflows

### Problem

Data requests can become ad hoc and error-prone.

### Outcome

Standardized, auditable legal/compliance operations.

### Checklist

- [ ] Add GDPR export request workflow
- [ ] Add GDPR delete/anonymization workflow with confirmations
- [ ] Add retention policy indicators
- [ ] Add legal hold markers (if needed)
- [ ] Add audit entries for all governance operations

### Success Metrics

- 100% governance actions auditable and repeatable

---

## Recommended Delivery Plan

### Phase 1 (High ROI, short-term)

- [ ] RBAC baseline (roles + middleware guards)
- [ ] Sensitive action safeguards (reason + confirm)
- [ ] Global search + saved views

### Phase 2 (Medium-term)

- [ ] User 360 timeline
- [ ] Bulk operations
- [ ] Observability widgets

### Phase 3 (Strategic)

- [ ] Feature flags and staged rollouts
- [ ] Governance/compliance workflows

---

## Acceptance Criteria (Overall)

- [ ] All new admin mutations are permission-gated and audited
- [ ] Sensitive changes require explicit reason
- [ ] Operators can find any user/invite/entity in <30 seconds
- [ ] Support can resolve common cases from a single user page
- [ ] High-volume workflows support bulk execution safely

---

## Notes

- Prioritize backend enforcement over frontend-only checks.
- Keep audit log schema extensible for future compliance needs.
- Build each section behind feature flags for gradual rollout.
