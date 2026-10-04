# Frontend integration handoff

Proposed additive contracts for Umut. These are implemented in the frontend adapters and demo simulation; they are not implemented by the current backend. Existing shared Incident and MapData contracts are unchanged. Public users can inspect the dashboard; precreated operators have equal management permissions.

All browser API traffic uses the same-origin /backend proxy. Set BACKEND_URL on the Next.js server/build. Browser code stores no API auth tokens. Login sets a server-issued HttpOnly session cookie through the proxy. Use a host-only cookie with Path=/ (or /backend); do not set Domain to the private backend hostname. Set Secure in HTTPS deployments and SameSite=Lax or stricter; validate Origin/CSRF on writes. Logout invalidates the server session and expires its cookie using matching attributes.

| Method | Endpoint | Response |
| --- | --- | --- |
| POST | /api/auth/login | UserSummary; body is {email, password}; 401 for invalid credentials |
| GET | /api/auth/me | UserSummary; 401 when signed out or expired |
| POST | /api/auth/logout | 204, no body |
| GET | /api/users | UserSummary[]; requires a session |
| GET | /api/incident-workflows | IncidentWorkflow[]; public, no emails or private account fields |
| PATCH | /api/incidents/{id}/workflow | IncidentWorkflow; requires a session |
| GET | /api/cameras/{id}/stream | Optional {format: "hls", url}; 404 when no stream exists |

UserSummary:

    { "id": "operator-chris", "display_name": "Chris" }

IncidentWorkflow (all keys present, nullable fields as shown):

    {
      "incident_id": "incident-123",
      "assignee": null,
      "acknowledged_by": null,
      "acknowledged_at": null,
      "resolved_by": null,
      "resolved_at": null,
      "updated_at": "2026-10-04T10:42:00Z"
    }

Each actor/assignee is a UserSummary or null. Timestamps are server-issued ISO 8601 UTC values. updated_at must advance for changes. Public summaries can omit incidents with no workflow; a successful empty response means no operator actions. A failed response must not be converted to an empty successful collection.

PATCH body:

    { "assignee_id": "operator-chris" }
    { "assignee_id": null }
    { "action": "acknowledge" }
    { "action": "resolve" }

The two fields may be combined. Omission preserves the existing value; null unassigns. Return the complete updated workflow in the same shape as the public read. Use 401 for expired/missing sessions, 403 for denied access, 404 for missing incident IDs, and a suitable 4xx for invalid operators/actions.

- Assignment does not acknowledge.
- Acknowledgment records authenticated actor and server time. Repeating it preserves the first actor/time.
- Resolution also acknowledges when needed; repeating it preserves the first actor/time.
- Workflow records must be persisted separately from algorithm incident upserts.
- Either source status=resolved or workflow.resolved_at makes the incident resolved.
- Human resolution survives refresh, login/logout, process restart (with persistent storage) and repeated ingestion for the same incident ID.
- A new incident episode requires a new ID. There is no reopen UI in this demo.
- Backend owner implements account provisioning, passwords, sessions, authorization, persistence and service credentials for ingestion writes.

Frontend copies these proposed types locally in types/index.ts pending team agreement. No canonical schema generation is necessary yet.

Garv: supply stable camera and observation IDs, browser-accessible image URLs, precise image timestamp meaning and update cadence. Keep camera image_url and last_updated current. Optional HLS URLs must be browser-accessible with appropriate CORS and HTTPS; credentials must not be embedded in URLs. Video plays only in the selected camera drawer and falls back to snapshots on error.

Konrad: supply stable camera_ids and related_observation_ids and define incident lifecycle semantics. The frontend fetches evidence via each linked camera's observation history; unknown event types are displayed as supplied labels.

## Joint acceptance walkthrough

1. Start the backend with persistent storage, enable the endpoints above and provision two operators.
2. Inspect an incident, open its camera evidence, sign in, assign, acknowledge and resolve.
3. Check drawer, active list, matching map markers and active counters together.
4. Refresh and reload. Sign out and verify the public workflow still shows the resolution.
5. Rerun ingestion/analysis for the same ID, then restart the backend. Resolution must survive both.
6. Expire a session and verify a failed write returns 401 without changing workflow state.

The current backend can verify map/camera/incident/observation reads only. Real operator persistence and re-ingestion acceptance remains dependent on backend implementation; intercepted browser tests are not evidence of server-side persistence.
