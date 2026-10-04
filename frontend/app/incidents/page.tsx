import { DataBoundary, WorkspaceHeading } from '../../components/Dashboard';
import { IncidentList } from '../../components/IncidentList';

export default function Incidents() {
  return <><WorkspaceHeading eyebrow="OPERATIONS / INCIDENT DESK" title="Incidents" description="Triage, inspect evidence, and coordinate your response." /><DataBoundary><IncidentList /></DataBoundary></>;
}
