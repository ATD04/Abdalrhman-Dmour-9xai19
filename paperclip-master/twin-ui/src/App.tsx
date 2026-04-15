import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LangProvider } from './context/LangContext';
import { Layout } from './components/Layout';
import { AttentionNow } from './pages/AttentionNow';
import { DecisionsFollowUp } from './pages/DecisionsFollowUp';
import { DecisionRoom } from './pages/DecisionRoom';
import { useDashboardData } from './hooks/useDashboardData';

// Hackathon supporting assets (not in minister navigation)
import { HackathonShell } from './pages/hackathon/HackathonShell';
import { ArchitectureView } from './pages/hackathon/ArchitectureView';
import { DemoGuide } from './pages/hackathon/DemoGuide';
import { ExecSummary } from './pages/hackathon/ExecSummary';
import { Roadmap } from './pages/hackathon/Roadmap';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

function MinisterApp() {
  const d = useDashboardData();
  return (
    <Routes>
      <Route element={<Layout refetch={d.refetch} isLoading={d.isLoading} />}>
        <Route index element={<Navigate to="/attention" replace />} />
        <Route path="attention" element={<AttentionNow />} />
        <Route path="decisions" element={<DecisionsFollowUp />} />
        <Route path="issue/:id" element={<DecisionRoom />} />
        <Route path="hackathon" element={<HackathonShell />}>
          <Route index element={<Navigate to="architecture" replace />} />
          <Route path="architecture" element={<ArchitectureView />} />
          <Route path="demo" element={<DemoGuide />} />
          <Route path="summary" element={<ExecSummary />} />
          <Route path="roadmap" element={<Roadmap />} />
        </Route>
        <Route path="*" element={<Navigate to="/attention" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <BrowserRouter>
          <MinisterApp />
        </BrowserRouter>
      </LangProvider>
    </QueryClientProvider>
  );
}
