import type { SVGProps } from 'react';
import './icons.css';

function Svg({
  icon,
  children,
  strokeWidth = 2,
  ...props
}: SVGProps<SVGSVGElement> & { icon: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
      data-icon={icon}
    >
      {children}
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-icon="plus"
    >
      <path data-part="outer" d="M12 4v16M4 12h16" />
      <path data-part="inner" d="M12 4v16M4 12h16" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <Svg icon="pencil">
      <path data-part="line" d="M12 20h9" />
      <path data-part="nib" d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  );
}

export function TrashIcon() {
  return (
    <Svg icon="trash">
      <g data-part="lid">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
      </g>
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Svg>
  );
}

export function SaveIcon() {
  return (
    <Svg icon="save">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </Svg>
  );
}

export function CardIcon() {
  return (
    <Svg icon="card">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path data-part="chip" d="M6 15h4" />
    </Svg>
  );
}

export function CheckIcon() {
  return (
    <Svg icon="check">
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function LogoutIcon() {
  return (
    <Svg icon="logout">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <g data-part="arrow">
        <path d="m8 7-5 5 5 5" />
        <path d="M3 12h12" />
      </g>
    </Svg>
  );
}

export function CalendarIcon() {
  return (
    <Svg icon="calendar">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <g data-part="rings">
        <path d="M16 2v4" />
        <path d="M8 2v4" />
      </g>
      <path d="M3 10h18" />
    </Svg>
  );
}

export function UsersIcon() {
  return (
    <Svg icon="users">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <g data-part="friend">
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </g>
    </Svg>
  );
}

export function GearIcon() {
  return (
    <Svg icon="gear">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1.1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </Svg>
  );
}

export function CopyIcon() {
  return (
    <Svg icon="copy">
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      <g data-part="front">
        <rect x="9" y="9" width="13" height="13" rx="2" />
      </g>
    </Svg>
  );
}

export function MoveIcon() {
  return (
    <Svg icon="move">
      <g data-part="left">
        <path d="m8 3-4 4 4 4" />
        <path d="M4 7h16" />
      </g>
      <g data-part="right">
        <path d="m16 21 4-4-4-4" />
        <path d="M20 17H4" />
      </g>
    </Svg>
  );
}

export function BanIcon() {
  return (
    <Svg icon="ban">
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </Svg>
  );
}

export function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      aria-hidden="true"
      data-icon="whatsapp"
    >
      <path
        fill="#25D366"
        d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2z"
      />
      <path
        fill="#ffffff"
        d="M16.62 14.17c-.25-.13-1.47-.72-1.7-.81-.22-.08-.39-.12-.55.13s-.64.8-.78.97c-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.71-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.24-.41.08-.17.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.65.31-.22.25-.85.84-.85 2.05s.88 2.38 1 2.54c.12.17 1.73 2.64 4.2 3.7 2.03.88 2.45.7 2.9.66.44-.05 1.43-.59 1.64-1.15.2-.56.2-1.04.14-1.14-.05-.1-.22-.16-.47-.28z"
      />
    </svg>
  );
}

export function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      width={18}
      height={18}
      aria-hidden="true"
      data-icon="google"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <Svg icon="search">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

export function EyeIcon() {
  return (
    <Svg icon="eye">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle data-part="pupil" cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function EyeOffIcon() {
  return (
    <Svg icon="eye-off">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c7 0 10 8 10 8a16.7 16.7 0 0 1-3.2 4.4" />
      <path d="M6.1 6.1C3.7 7.8 2 12 2 12s3 8 10 8a10.4 10.4 0 0 0 5.1-1.3" />
    </Svg>
  );
}

export function ClockIcon() {
  return (
    <Svg icon="clock">
      <circle cx="12" cy="12" r="9" />
      <path data-part="hands" d="M12 7v5l3 2" />
    </Svg>
  );
}

export function GlassesIcon() {
  return (
    <Svg icon="glasses">
      <circle cx="6.5" cy="14" r="3.5" />
      <circle cx="17.5" cy="14" r="3.5" />
      <path d="M10 14h4" />
      <path d="M3 14H2" />
      <path d="M22 14h-1" />
      <path d="M6.5 10.5c2.2-2 8.8-2 11 0" />
    </Svg>
  );
}

export function HelpIcon() {
  return (
    <Svg icon="help" width={14} height={14} strokeWidth={2.2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.4 2.4 0 1 1 3.5 2.1c-.8.4-1.3 1-1.3 1.8V14" />
      <path d="M12 17h.01" />
    </Svg>
  );
}
