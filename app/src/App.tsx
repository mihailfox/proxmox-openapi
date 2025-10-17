import { useState } from "react";
import "./App.css";

function App() {
  // biome-ignore lint/correctness/noEmptyPattern: <i do not care>
  const [] = useState(0);

  return (
    <>
      <div>
      
      </div>
      <p className="read-the-docs">Vite and React</p>
    </>
  );
}

export default App;
