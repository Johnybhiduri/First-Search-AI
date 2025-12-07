import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatPage from './pages/ChatPage';

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  // Debug when selections change
  // useEffect(() => {
  //   console.log("Selected Model:", selectedModel);
  //   console.log("Selected Pipeline:", selectedPipeline);
  // }, [selectedModel, selectedPipeline]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="h-screen flex bg-gray-900 text-white">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 shrink-0`}>
        <Sidebar 
          isOpen={isSidebarOpen} 
          onToggle={toggleSidebar}
          onSelectModel={setSelectedModel}
          onSelectPipeline={setSelectedPipeline}
          onVerify={() => setIsVerified(true)}
          onSetApiKey={setApiKey}
          onClose={() => setIsSidebarOpen(false)} 
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 p-4 lg:hidden">
          <div className="flex items-center">
            <div>
              <h1 className="text-xl font-semibold text-white">First Search AI</h1>
              <p className="text-sm text-gray-400">
                {selectedModel ? `Model: ${selectedModel}` : 'No model selected'}
              </p>
            </div>
          </div>
        </header>

        {/* Chat Page */}
        <main className="flex-1 overflow-hidden">
          <ChatPage 
            isVerified={isVerified}
            selectedModel={selectedModel}
            selectedPipeline={selectedPipeline}
            api_key={apiKey}
          />
        </main>
      </div>
    </div>
  );
};

export default App;