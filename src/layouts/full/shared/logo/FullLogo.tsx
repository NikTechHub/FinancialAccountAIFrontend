






import LogoIcon from 'src/assets/images/logos/logo-icon.svg';
import { BRAND } from 'src/config/branding';


const FullLogo = () => {
  return (
    <div className="flex h-9 w-[204px] items-center gap-2" aria-label={BRAND.name}>
      <img src={LogoIcon} alt="" aria-hidden="true" className="h-7 w-7 shrink-0 rtl:scale-x-[-1]" />
      <span className="truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white">
        {BRAND.name}
      </span>
    </div>
  );
};

export default FullLogo;
