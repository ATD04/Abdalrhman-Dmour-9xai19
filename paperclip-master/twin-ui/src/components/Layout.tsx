import { Outlet, useOutletContext } from 'react-router-dom';
import { TopNav } from './TopNav';

interface LayoutCtx { refetch: () => void; isLoading: boolean; }
export const useLayout = () => useOutletContext<LayoutCtx>();

export function Layout({ refetch, isLoading }: { refetch?: () => void; isLoading?: boolean }) {
  return (
    <div className="min-h-screen bg-twin-bg">
      <TopNav onRefetch={refetch} isLoading={isLoading} />
      <main className="pt-14">
        <Outlet context={{ refetch: refetch ?? (() => {}), isLoading: isLoading ?? false }} />
      </main>
    </div>
  );
}
