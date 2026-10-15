import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { useUi } from './ui';
import { api, errorText } from '../api';
import type { UpdateStatus } from '../types';

export function useUpdateStatus() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  useEffect(() => {
    api
      .get<UpdateStatus>('/api/update/status')
      .then(setStatus)
      .catch(() => undefined);
  }, []);
  return [status, setStatus] as const;
}

/** Sidebar button that appears when a newer version is published. */
export function UpdateButton() {
  const [status] = useUpdateStatus();
  if (!status?.updateAvailable) return null;
  return (
    <Link to="/settings#updates" className="update-btn">
      <Icon name="update" /> Update to {status.latest}
    </Link>
  );
}

type Phase = 'idle' | 'updating' | 'failed';
const POLL_MS = 3000;
const GIVE_UP_MS = 6 * 60_000;

export function UpdatePanel() {
  const [status, setStatus] = useUpdateStatus();
  const [phase, setPhase] = useState<Phase>('idle');
  const { confirm } = useUi();
  const [step, setStep] = useState('');
  const [msg, setMsg] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);

  async function check() {
    setMsg('');
    try {
      setStatus(await api.get<UpdateStatus>('/api/update/status?refresh=1'));
    } catch (e) {
      setMsg(errorText(e, 'Could not check for updates.'));
    }
  }

  // The container is replaced, so the app goes dark for a moment. Wait until
  // it has been down and answers again with the new version.
  function waitForRestart(target: string) {
    const started = Date.now();
    let sawDown = false;
    const stop = () => timer.current && clearInterval(timer.current);
    timer.current = setInterval(async () => {
      let version = '';
      try {
        version = (await api.get<{ version: string }>('/api/version')).version;
      } catch {
        sawDown = true;
        setStep('Restarting Mavri…');
        return;
      }
      if (version === target) {
        stop();
        setStep('Updated. Reloading…');
        setTimeout(() => window.location.assign('/settings'), 800);
        return;
      }
      try {
        const p = await api.get<{ state: string; error?: string }>('/api/update/progress');
        if (p.state === 'error') {
          stop();
          setPhase('failed');
          setMsg(p.error || 'The update failed. Mavri is still on the old version.');
          return;
        }
        if (p.state === 'pulling') setStep('Downloading the new version…');
      } catch {
        // session may have been dropped by the restart; keep waiting
      }
      if (Date.now() - started > GIVE_UP_MS) {
        stop();
        setPhase('failed');
        setMsg(
          sawDown
            ? 'Mavri restarted but is not on the new version yet. Reload in a minute.'
            : 'The update did not start.'
        );
      }
    }, POLL_MS);
  }

  async function update() {
    if (
      !status ||
      !(await confirm({
        title: `Update to ${status.latest}?`,
        body: `Mavri restarts for a few seconds. Your data is kept. You are on ${status.current}.`,
        confirm: 'Update now'
      }))
    )
      return;
    setMsg('');
    try {
      const r = await api.post<{ version: string }>('/api/update');
      setPhase('updating');
      setStep('Starting the update…');
      waitForRestart(r.version);
    } catch (e) {
      setMsg(errorText(e, 'Could not start the update.'));
    }
  }

  if (!status) return null;
  return (
    <div className="card" id="updates">
      <h2>Updates</h2>
      <p>
        You are on <strong>{status.current}</strong>.{' '}
        {status.updateAvailable ? (
          <>
            Version <strong>{status.latest}</strong> is available.
          </>
        ) : status.checkDisabled ? (
          <span className="muted">Update checks are turned off on this server (UPDATE_CHECK=off).</span>
        ) : status.checkError ? (
          <span className="muted">Could not check for updates ({status.checkError}).</span>
        ) : (
          <span className="muted">This is the latest version.</span>
        )}
      </p>
      {phase === 'updating' && (
        <p role="status" className="updating">
          {step}
        </p>
      )}
      {msg && (
        <p className="error" role="alert">
          {msg}
        </p>
      )}
      {status.updateAvailable && !status.canUpdate && (
        <p className="muted">
          This install has no updater, so update it the way you installed it (pull the new image and recreate the
          container). To get a one-click button, add the <code>mavri-updater</code> container; see the guide.
        </p>
      )}
      <div className="row">
        {status.updateAvailable && status.canUpdate && (
          <button className="primary" onClick={update} disabled={phase === 'updating'}>
            Update now
          </button>
        )}
        <button onClick={check} disabled={phase === 'updating'}>
          Check for updates
        </button>
        <a href={status.releaseUrl} target="_blank" rel="noreferrer">
          Release notes
        </a>
      </div>
    </div>
  );
}
