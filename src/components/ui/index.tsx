import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import type { StatusTone, User } from '../../store/types';

/* Every primitive here reads tokens only. Icons are Lucide, outline, 1.5 stroke,
   currentColor — set globally on the icon components at their call sites. */

export const ICON = { strokeWidth: 1.5, absoluteStrokeWidth: false } as const;

/* ------------------------------------------------------------------ Button */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  size = 'md',
  full,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
}) {
  const cls = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '',
    full ? 'btn-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

/** Icon-only controls are 44px minimum and always carry an accessible name. */
export function IconButton({
  label,
  small,
  active,
  showDot,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  small?: boolean;
  active?: boolean;
  showDot?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={['icon-btn', small ? 'icon-btn-sm' : '', active ? 'active' : '', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
      {showDot && <span className="badge-dot" />}
    </button>
  );
}

/* ------------------------------------------------------------------ surfaces */

export function Card({
  children,
  className = '',
  tab,
  tabSide = 'left',
  style,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  tab?: StatusTone;
  tabSide?: 'left' | 'right';
  style?: CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`} style={style} {...rest}>
      {tab && <span className={`folder-tab ${tabSide} tab-${tab}`} />}
      {children}
    </div>
  );
}

export const Eyebrow = ({ children }: { children: ReactNode }) => (
  <span className="eyebrow">{children}</span>
);

export const Mono = ({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) => (
  <span className={`mono ${className}`} style={style}>
    {children}
  </span>
);

/** Status is never colour alone: the dot always ships with its label. */
export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className="badge">
      <span className={`dot dot-${tone}`} />
      {children}
    </span>
  );
}

export const Chip = ({ tone, children }: { tone?: StatusTone; children: ReactNode }) => (
  <span className="chip">
    {tone && <span className={`dot dot-${tone}`} />}
    {children}
  </span>
);

/* ------------------------------------------------------------------ Avatar */

const AVATAR_SIZES = { xs: 24, sm: 28, md: 36, lg: 44 } as const;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

export function Avatar({
  user,
  size = 'xs',
  style,
  /** Set when the person's name is already written next to the avatar, so a screen reader
   *  does not hear it twice. */
  decorative = false,
}: {
  user: Pick<User, 'name' | 'avatarUrl'>;
  size?: keyof typeof AVATAR_SIZES;
  style?: CSSProperties;
  decorative?: boolean;
}) {
  const px = AVATAR_SIZES[size];
  return (
    <span
      className="avatar"
      title={decorative ? undefined : user.name}
      aria-hidden={decorative || undefined}
      style={{ width: px, height: px, fontSize: px <= 24 ? 10 : px <= 28 ? 11 : 13, ...style }}
    >
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" />
      ) : (
        <span aria-hidden="true">{initials(user.name)}</span>
      )}
      {!decorative && <span className="sr-only">{user.name}</span>}
    </span>
  );
}

export const AvatarStack = ({ children }: { children: ReactNode }) => (
  <span className="avatar-stack">{children}</span>
);

/* ------------------------------------------------------------------ Checkbox */

/** Completion is optimistic: the flourish runs immediately and the write follows. */
export function Check2({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="check-hit"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
    >
      <span className={`check-box ${checked ? 'checked' : ''}`}>
        {checked && <Check size={12} strokeWidth={2.5} />}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ Tabs */

export function Tabs<T extends string>({
  value,
  items,
  onChange,
}: {
  value: T;
  items: Array<{ value: T; label: string; count?: number }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          className={`tab-btn ${value === it.value ? 'active' : ''}`}
          onClick={() => onChange(it.value)}
        >
          {it.label}
          {it.count !== undefined && <Mono className="faint">{it.count}</Mono>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ form fields */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="eyebrow">{label}</span>
      {children}
      {hint && <span className="caption">{hint}</span>}
    </label>
  );
}

/** Forwards its ref so gate screens can take focus on mount. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...rest }, ref) => (
    <input ref={ref} className={`input ${className}`} {...rest} />
  ),
);
Input.displayName = 'Input';

export const Select = ({
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={`select ${className}`} {...rest}>
    {children}
  </select>
);

export function Switch({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track">
        <span className="switch-knob" />
      </span>
      {children}
    </label>
  );
}

/* ------------------------------------------------------------------ overlays */

/** Dismissal is always reachable from the keyboard. */
export function useEscape(onEscape: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onEscape();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEscape, active]);
}

export function Dialog({
  title,
  onClose,
  children,
  actions,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEscape(onClose);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
  }, []);
  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
      >
        <div className="panel-head">
          <h2 className="h2" id={titleId}>
            {title}
          </h2>
          <IconButton label="Close" small onClick={onClose}>
            <X size={20} {...ICON} />
          </IconButton>
        </div>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Destructive operations state their consequence in the confirmation itself. §6.3 */
export function ConfirmDialog({
  title,
  consequence,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  consequence: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.5, color: 'var(--text-muted)' }}>
        {consequence}
      </p>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ toasts */

interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

const ToastContext = createContext<(text: string, action?: Toast['action']) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = (text: string, action?: Toast['action']) => {
    seq.current += 1;
    const id = seq.current;
    setToasts((t) => [...t.slice(-2), { id, text, action }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  };

  return (
    <ToastContext.Provider value={push}>
      {children}
      {toasts.length > 0 &&
        createPortal(
          <div className="toasts" role="status" aria-live="polite">
            {toasts.map((t) => (
              <div className="toast" key={t.id}>
                <span>{t.text}</span>
                {t.action && (
                  <span className="toast-action">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        t.action!.run();
                        setToasts((x) => x.filter((y) => y.id !== t.id));
                      }}
                    >
                      {t.action.label}
                    </Button>
                  </span>
                )}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ tooltip */

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="tooltip-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && <span className="tooltip">{text}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ empty state */

/** A muted icon at 40% opacity plus one line of type. Reassuring, never congratulatory. */
export function EmptyState({
  icon,
  line,
  action,
  row,
}: {
  icon: ReactNode;
  line: string;
  action?: ReactNode;
  row?: boolean;
}) {
  return (
    <div className={`empty ${row ? 'empty-row' : ''}`}>
      {icon}
      <span className="empty-line">{line}</span>
      {action}
    </div>
  );
}
