import './tdheader.css';
import type { ReactNode } from 'react';

type TdHeaderProps = {
  children: ReactNode;
};

export function TdHeader({ children }: TdHeaderProps) {
  return <div className="tdheader">{children}</div>;
}
