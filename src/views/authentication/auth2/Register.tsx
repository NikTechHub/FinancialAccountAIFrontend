import { Link } from "react-router";
import CardBox from "src/components/shared/CardBox";

import AuthRegister from "../authforms/AuthRegister";

import FullLogo from "src/layouts/full/shared/logo/FullLogo";
import { BRAND } from 'src/config/branding';



const Register = () => {
  return (
    <>
      <div className="relative overflow-hidden min-h-screen bg-lightprimary dark:bg-darkprimary">
        <div className="flex min-h-screen justify-center items-center px-4 py-8">
          <CardBox className="md:w-[450px] w-full border-none">
            <div className="mx-auto mb-6">
              <FullLogo />
            </div>
            <div className="mb-4 text-center">
              <p className="text-sm font-semibold text-primary">{BRAND.tagline}</p>
              <p className="mt-1 text-sm text-muted-foreground">{BRAND.description}</p>
            </div>
            <AuthRegister />
            <div className="flex gap-2 text-base text-ld font-medium mt-6 items-center justify-start">
              <p>Already have an Account?</p>
              <Link
                to={"/auth/auth2/login"}
                className="text-primary text-sm font-medium"
              >
                Sign in
              </Link>
            </div>
          </CardBox>
        </div>
      </div>
    </>
  );
};

export default Register;
