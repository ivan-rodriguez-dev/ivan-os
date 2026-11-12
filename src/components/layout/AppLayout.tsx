import {
  BriefcaseBusiness,
  Code2,
  GraduationCap,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Target,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAction } from '@/hooks/useAction';
import { cn } from '@/lib/cn';
import { Logo } from './Logo';

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Command Center', short: 'Inicio', icon: LayoutDashboard },
  { to: '/work', label: 'Work & Schedule', short: 'Turnos', icon: BriefcaseBusiness },
  { to: '/academic', label: 'Academic Center', short: 'SENA', icon: GraduationCap },
  { to: '/finance', label: 'Financial Control', short: 'Finanzas', icon: Wallet },
  { to: '/skills', label: 'Skill Development', short: 'Skills', icon: Code2 },
  { to: '/languages', label: 'Language Lab', short: 'Idiomas', icon: Languages },
  { to: '/goals', label: 'Goals & Habits', short: 'Metas', icon: Target },
];

const MOBILE_PRIMARY = NAV.slice(0, 4);

function SideLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      className={({ isActive }) =>
        cn(
          'flex h-11 items-center gap-3 rounded-lg border-l-2 px-3 text-sm font-medium transition-colors',
          isActive ? 'border-accent bg-raised text-ink' : 'border-transparent text-ink-mute hover:bg-raised/60 hover:text-ink',
        )
      }
    >
      <item.icon className="size-[18px] shrink-0" aria-hidden />
      {item.label}
    </NavLink>
  );
}

function AccountBlock({ onNavigate }: { onNavigate?: () => void }) {
  const { user, profile, signOut } = useAuth();
  const { run, pending } = useAction();
  return (
    <div className="border-t border-line pt-3">
      <SideLink item={{ to: '/settings', label: 'Ajustes', short: 'Ajustes', icon: Settings }} {...(onNavigate ? { onNavigate } : {})} />
      <div className="mt-2 flex items-center gap-2 px-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{profile?.full_name || 'Sin nombre'}</p>
          <p className="truncate text-xs text-ink-mute">{user?.email}</p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => void run(signOut)}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-mute transition-colors hover:bg-raised hover:text-danger"
        >
          <LogOut className="size-[18px]" />
        </button>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-panel px-3 py-5 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav aria-label="Módulos" className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <SideLink key={item.to} item={item} />
          ))}
        </nav>
        <AccountBlock />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-void/95 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menú"
          className="inline-flex size-10 items-center justify-center rounded-lg text-ink-soft hover:bg-raised"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {/* Mobile drawer with every destination */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 animate-fade bg-void/80 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] animate-fade flex-col border-l border-line bg-panel px-3 py-4">
            <div className="flex items-center justify-between px-2">
              <span className="label">Menú</span>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Cerrar menú" className="inline-flex size-10 items-center justify-center rounded-lg text-ink-soft hover:bg-raised">
                <X className="size-5" />
              </button>
            </div>
            <nav aria-label="Módulos" className="mt-3 flex flex-1 flex-col gap-1 overflow-y-auto">
              {NAV.map((item) => (
                <SideLink key={item.to} item={item} onNavigate={() => setDrawerOpen(false)} />
              ))}
            </nav>
            <AccountBlock onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl animate-rise px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-9" key={location.pathname}>
        {children}
      </main>

      {/* Mobile bottom bar: the four most used modules */}
      <nav aria-label="Accesos rápidos" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {MOBILE_PRIMARY.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn('flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors', isActive ? 'text-accent' : 'text-ink-mute')
            }
          >
            <item.icon className="size-5" aria-hidden />
            {item.short}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
