import Hub from "../components/Hub";
import Predictor from "./Predictor";
import BettingEdge from "./BettingEdge";

// Forecast hub - game Predictor and the Betting Edge finder.
export default function Forecast() {
  return (
    <Hub tabs={[
      { label: "Predict", render: () => <Predictor /> },
      { label: "Betting Edge", render: () => <BettingEdge /> },
    ]} />
  );
}
