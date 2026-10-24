import { useNavigate } from 'react-router';
import CardBox from 'src/components/shared/CardBox';
import { Button } from 'src/components/ui/button';
import { useAuth } from './useAuth';

export default function NoOrganization() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/auth/auth2/login', { replace: true });
  };

  return (
    <div className="relative overflow-hidden min-h-screen bg-lightprimary dark:bg-darkprimary">
      <div className="flex min-h-screen justify-center items-center px-4 py-8">
        <CardBox className="md:w-[500px] w-full border-none text-center">
          <h1 className="text-xl font-semibold text-ld">Organization unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your account is signed in, but no organization is associated with it. Ask an
            administrator to add you to an organization, then sign in again.
          </p>
          <Button className="mt-6 w-full" onClick={handleSignOut}>
            Sign out
          </Button>
        </CardBox>
      </div>
    </div>
  );
}
