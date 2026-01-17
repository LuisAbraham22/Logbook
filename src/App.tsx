import "./App.css";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { useTheme } from "./theme/useTheme";

function App() {
  const { theme } = useTheme();

  return (
    <div className="app-root">
      <div className="app-shell">
        <MarkdownEditor theme={theme} />
      </div>
    </div>
  );
}

export default App;
