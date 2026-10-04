import { DataBoundary, WorkspaceHeading } from '../../components/Dashboard';
import { CameraGallery } from '../../components/CameraGallery';

export default function Cameras() {
  return <><WorkspaceHeading eyebrow="OPERATIONS / VISUAL COVERAGE" title="Camera network" description="Explore provider snapshots and the observations behind each location." /><DataBoundary><CameraGallery /></DataBoundary></>;
}
