import { useEffect, type ReactNode } from 'react';

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    document.body.classList.add('sheet-open');
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.classList.remove('sheet-open');
    };
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-grab" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
        <div className="sheet-end" />
      </div>
    </>
  );
}

export function Segmented<T extends string | number>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.value)} type="button" className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toast({ text }: { text: string }) {
  return <div className="toast" role="status">{text}</div>;
}

export function Avatar({ src, name, size = 36 }: { src?: string | null; name?: string; size?: number }) {
  const initials = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
  if (src) return <img className="avatar" src={src} alt="" style={{ width: size, height: size }} />;
  return <div className="avatar avatar-fb" style={{ width: size, height: size, fontSize: size * 0.34 }}>{initials}</div>;
}
