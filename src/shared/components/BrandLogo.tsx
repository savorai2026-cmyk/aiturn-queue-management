import { useEffect, useState } from 'react';
import logo from '../../assets/logo.png';
import logoDark from '../../assets/logo-dark.png';
import type { ColorScheme } from '../../app/colorScheme';

function currentScheme(): ColorScheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export default function BrandLogo({ className }: { className?: string }) {
  const [scheme, setScheme] = useState<ColorScheme>(currentScheme);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setScheme(currentScheme());
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return (
    <img
      src={scheme === 'dark' ? logoDark : logo}
      alt="QGent"
      className={className}
    />
  );
}
