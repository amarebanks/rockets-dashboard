import Hub from "../components/Hub";
import TradeAnalyzer from "./TradeAnalyzer";
import TradeMachine from "./TradeMachine";

// Trade hub - the any-player fairness Analyzer and the cap-legal team Machine.
export default function TradeHub() {
  return (
    <Hub tabs={[
      { label: "Analyzer", render: () => <TradeAnalyzer /> },
      { label: "Machine", render: () => <TradeMachine /> },
    ]} />
  );
}
