import { useEffect, useState, type FC } from 'react';
import { getDatabaseReady } from '../../shared/api/platformApi';
import { DatabaseChooser } from './DatabaseChooser';

interface Props {
  onDatabaseRead: () => void;
}

// Docker/CasaOS servers open a default database themselves. In that case skip
// the chooser entirely; otherwise (a server without a default database) fall
// back to the normal chooser.
export const AutoOpenDatabase: FC<Props> = ({ onDatabaseRead }) => {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDatabaseReady()
      .then(res => {
        if (cancelled) return;
        if (res.success && res.data?.ready) onDatabaseRead();
        else setChecking(false);
      })
      .catch(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [onDatabaseRead]);

  if (checking) return null;
  return <DatabaseChooser onDatabaseRead={onDatabaseRead} />;
};
