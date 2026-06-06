import { FileText, Package, BarChart3, Search } from 'lucide-react';
const ICONS: Record<string, any> = { report: BarChart3, stock: Package, search: Search, default: FileText };
interface EmptyStateProps { icon?: string; title: string; subtitle?: string; action?: React.ReactNode; }
export default function EmptyState({ icon = 'default', title, subtitle, action }: EmptyStateProps) {
  const Icon = ICONS[icon] || ICONS.default;
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <Icon size={24} className="text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 max-w-xs">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
