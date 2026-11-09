
import { BRAND } from 'src/config/branding';

export const Footer = () => (
  <p className="text-center text-sm font-medium text-bodytext">
    © {new Date().getFullYear()} {BRAND.name} · {BRAND.tagline}
  </p>
);
