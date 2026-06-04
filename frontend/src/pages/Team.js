import Hub from "../components/Hub";
import TeamStats from "./TeamStats";
import Lineups from "./Lineups";
import Clutch from "./Clutch";

// Team analytics hub - Team Stats / Lineups / Clutch under one nav item.
export default function Team() {
  return (
    <Hub tabs={[
      { label: "Team Stats", render: () => <TeamStats /> },
      { label: "Lineups", render: () => <Lineups /> },
      { label: "Clutch", render: () => <Clutch /> },
    ]} />
  );
}
