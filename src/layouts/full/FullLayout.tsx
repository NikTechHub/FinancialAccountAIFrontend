import { FC } from 'react';
import { Outlet } from 'react-router';
import { Alert, AlertDescription } from 'src/components/ui/alert';
import { useAuth } from 'src/features/auth/useAuth';
import Sidebar from './vertical/sidebar/Sidebar';
import Header from './vertical/header/Header';

const FullLayout: FC = () => {
  const { membershipError } = useAuth();

  return (
    <>
      <div className="flex w-full min-h-screen">
        <div className="page-wrapper flex w-full min-w-0">
          {/* Header/sidebar */}
          <div className="xl:block hidden">
            <Sidebar />
          </div>
          <div className="body-wrapper w-full min-w-0 bg-white dark:bg-dark">
            {/* Top Header  */}
            <Header />

            {/* Body Content  */}
            <div className={'container mx-auto px-6 py-30'}>
              <main className="grow">
                {membershipError && (
                  <Alert variant="lightwarning" className="mb-6">
                    <AlertDescription>{membershipError}</AlertDescription>
                  </Alert>
                )}
                <Outlet />
              </main>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FullLayout;
