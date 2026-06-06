'use client';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface Crumb { label: string; href?: string; }

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, crumbs = [], actions }: PageHeaderProps) {
  return (
    <div className="px-6 pt-5 pb-4 border-b border-gray-100 bg-white">
      {/* Breadcrumb */}
      {crumbs.length > 0 && (
        <nav className="flex items-center gap-1 mb-2 text-xs text-gray-400">
          <Link href="/dashboard" className="hover:text-[#00475a] transition-colors flex items-center gap-1">
            <Home size={12}/> Home
          </Link>
          {crumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight size={10}/>
              {crumb.href
                ? <Link href={crumb.href} className="hover:text-[#00475a] transition-colors">{crumb.label}</Link>
                : <span className="text-gray-600 font-medium">{crumb.label}</span>
              }
            </span>
          ))}
        </nav>
      )}
      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
