"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, FileText, Home, ImageIcon, RefreshCw } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/editor", label: "PDF Editor", icon: FileText },
  { href: "/image-editor", label: "Image Editor", icon: ImageIcon },
  { href: "/convert", label: "Converter", icon: RefreshCw },
  { href: "/scanner", label: "Scanner", icon: Camera },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="global-nav" aria-label="Main navigation">
      <Link className="global-brand" href="/">
        <span className="global-brand-mark">DT</span>
        <span>DocToolkit</span>
      </Link>
      <div className="global-nav-links">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link key={item.href} className={`global-nav-link ${active ? "is-active" : ""}`} href={item.href}>
              <Icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
