import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './IconButton.module.css';

export {
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from './icons';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'default' | 'danger';
  children: ReactNode;
}

export default function IconButton({
  label,
  variant = 'default',
  className,
  children,
  type: _type,
  title,
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type="button"
      title={title ?? label}
      aria-label={label}
      className={[
        styles.iconButton,
        variant === 'danger' ? styles.danger : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}
