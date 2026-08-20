import { useState } from "react";
import "./styles.css";
import { AssessmentFlow } from "./components/AssessmentFlow";
import { ProgressView } from "./components/ProgressView";

type Tab = "assess" | "progress";

function App() {
  const [tab, setTab] = useState<Tab>("assess");

  return (
    <div className="shell">
      <div className="top-bar">
        <div>
          <div className="eyebrow">Reading Fluency</div>
          <h1 className="title">Oral Reading Fluency Check</h1>
        </div>
        <nav className="nav">
          <button aria-current={tab === "assess"} onClick={() => setTab("assess")}>
            Assess
          </button>
          <button aria-current={tab === "progress"} onClick={() => setTab("progress")}>
            Progress
          </button>
        </nav>
      </div>

      {tab === "assess" ? <AssessmentFlow /> : <ProgressView />}
    </div>
  );
}

export default App;
