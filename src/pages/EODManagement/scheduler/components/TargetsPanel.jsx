import { useState } from 'react';
import { ArrowRight, Check, KeyRound, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@components/ui/Button/Button';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { Toggle } from '@components/ui/Toggle/Toggle';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import { hasPendingScheduleReturn, isFingerprint } from '../schedulerModel';
import { useResource } from '../useResource';

const EMPTY = {
  name: '',
  host: '',
  port: 22,
  username: '',
  method: 'password',
  pin: true,
  fingerprint: '',
  enabled: true,
  secret: '',
};

const CHECK_LABELS = {
  enabled: 'Enabled',
  authentication: 'Authentication chosen',
  host_key_pinned: 'Host key pinned',
  nodeid_mapped: 'NODEID mapped',
  secret_saved: 'Secret saved',
};

function formOf(t) {
  return {
    name: t.name,
    host: t.host,
    port: t.port,
    username: t.username,
    method: t.auth.method,
    pin: t.host_key.policy === 'strict-fingerprint',
    fingerprint: t.host_key.fingerprint || '',
    enabled: t.enabled,
    secret: '',
  };
}

function bodyOf(f) {
  return {
    name: f.name.trim(),
    host: f.host.trim(),
    port: Number(f.port),
    username: f.username.trim(),
    enabled: f.enabled,
    auth: { method: f.method },
    host_key: f.pin
      ? { policy: 'strict-fingerprint', fingerprint: f.fingerprint.trim() }
      : { policy: 'unconfigured', fingerprint: '' },
  };
}

const OTHER_NODEID = '__other__'; // dropdown choice that reveals a text box for a NODEID the workflow does not use (yet)

/** SSH target servers of one environment, their write-only secrets, and the NODEID mappings that decide which server runs which job. */
export function TargetsPanel({ env, onReturnToSchedule }) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const canWrite = hasPermission('EOD_SCHEDULER_TARGETS');
  const data = useResource(() => svc.listTargets(env), [env]);
  const ready = useResource(() => svc.getReadiness(env), [env]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null); // {id?, ...fields}
  const [secret, setSecret] = useState(null); // {target, value}
  const [removal, setRemoval] = useState(null);
  const [map, setMap] = useState({ nodeid: '', custom: '', target: '' });

  const refresh = () => {
    data.reload(true);
    ready.reload(true);
  };

  const run = async (fn, ok, after) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      refresh();
      after?.();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (data.loading && !data.data) return <p className="eodsch-muted">Loading target servers…</p>;
  if (data.error)
    return (
      <div className="eodsch-error" role="alert">
        {data.error}
      </div>
    );
  const { targets, mappings, auth_methods: methods, secrets_available: secretsOk } = data.data;
  const nameOf = (id) => targets.find((t) => t.id === id)?.name ?? id;
  const workflowNodeids = data.data.workflow_nodeids ?? [];
  const unmappedNodeids = workflowNodeids.filter((n) => !n.mapped).map((n) => n.nodeid);
  const chosenNodeid = (map.nodeid === OTHER_NODEID ? map.custom : map.nodeid).trim();

  const formProblem =
    form &&
    (!form.name.trim()
      ? 'Give the server a name.'
      : !form.host.trim()
        ? 'Enter the host name or IP address.'
        : !form.username.trim()
          ? 'Enter the SSH user name.'
          : !(Number(form.port) >= 1 && Number(form.port) <= 65535)
            ? 'The port must be 1 to 65535.'
            : form.pin && !isFingerprint(form.fingerprint)
              ? 'The fingerprint must look like SHA256:… (as printed by ssh-keygen -lf).'
              : '');

  const save = () =>
    run(
      async () => {
        const saved = form.id
          ? await svc.updateTarget(env, form.id, bodyOf(form))
          : await svc.createTarget(env, bodyOf(form));
        // the secret goes through its own write-only endpoint, after the server exists (a failure here keeps the dialog open on the saved server)
        if (form.method !== 'unconfigured' && form.secret) {
          setForm((f) => ({ ...f, id: saved.id }));
          await svc.setTargetSecret(env, saved.id, form.secret);
        }
      },
      form.id
        ? 'Target server updated. If it was approved, review and approve again.'
        : 'Target server added.',
      () => setForm(null),
    );

  return (
    <div className="eodsch-stack">
      {hasPendingScheduleReturn() && (
        <div className="eodsch-mapping-banner">
          <div className="eodsch-mapping-banner-left">
            <Check size={18} color="#16a34a" />
            <div>
              <div className="eodsch-mapping-banner-title">Workflow XML Uploaded for {env}</div>
              <div className="eodsch-mapping-banner-desc">
                Map your NODEID(s) to target servers below. When mapped, you will be taken back to complete the schedule.
              </div>
            </div>
          </div>
          {onReturnToSchedule && (
            <Button
              size="sm"
              trailingIcon={ArrowRight}
              onClick={onReturnToSchedule}
            >
              Back to Schedule &amp; Fill Details
            </Button>
          )}
        </div>
      )}

      {!secretsOk ? (
        <div className="eodsch-error" role="alert">
          No secret key is configured on the server (EOD_SCHEDULER_SECRET_KEY), so passwords and
          keys cannot be saved or used. Ask an administrator to set it.
        </div>
      ) : null}

      <div className="eodsch-card eodsch-table-wrap">
        <div className="eodsch-toolbar">
          <div>
            <strong>Target servers</strong>
            <div className="eodsch-muted">
              Machines in <strong>{env}</strong> that jobs run on over SSH. Hosts are only trusted
              by their pinned key; secrets are never shown again.
            </div>
          </div>
          {canWrite ? (
            <Button size="sm" leadingIcon={Plus} onClick={() => setForm({ ...EMPTY })}>
              Add server
            </Button>
          ) : null}
        </div>
        <table className="eodsch-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>Auth</th>
              <th>Host key</th>
              <th>Secret</th>
              <th>NODEIDs</th>
              <th>Ready</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {targets.map((t) => {
              const r = ready.data?.targets?.find((x) => x.id === t.id);
              return (
                <tr key={t.id}>
                  <td>
                    {t.name}
                    {t.enabled ? '' : ' (disabled)'}
                  </td>
                  <td>
                    {t.username}@{t.host}:{t.port}
                  </td>
                  <td>{t.auth.method}</td>
                  <td title={t.host_key.fingerprint}>
                    {t.host_key.policy === 'strict-fingerprint' ? 'pinned' : 'not pinned'}
                  </td>
                  <td>{t.secret_configured ? 'saved' : 'missing'}</td>
                  <td>{t.nodeids.join(', ') || '—'}</td>
                  <td
                    title={
                      r
                        ? Object.entries(r.checks)
                            .filter(([, ok]) => !ok)
                            .map(([k]) => CHECK_LABELS[k])
                            .join(', ')
                        : ''
                    }
                  >
                    {r ? (
                      r.ready ? (
                        <Check size={14} aria-label="Ready" />
                      ) : (
                        <X size={14} aria-label="Not ready" />
                      )
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="eodsch-row-actions">
                    {canWrite ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          leadingIcon={Pencil}
                          aria-label={`Edit ${t.name}`}
                          onClick={() => setForm({ id: t.id, ...formOf(t) })}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          leadingIcon={KeyRound}
                          aria-label={`Set the secret of ${t.name}`}
                          disabled={t.auth.method === 'unconfigured' || !secretsOk}
                          onClick={() => setSecret({ target: t, value: '' })}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          leadingIcon={Trash2}
                          aria-label={`Delete ${t.name}`}
                          onClick={() => setRemoval(t)}
                        />
                      </>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {!targets.length ? (
              <tr>
                <td colSpan={8} className="eodsch-muted">
                  No target server yet. Add one, pin its host key, save its secret and map its
                  NODEIDs.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="eodsch-card eodsch-table-wrap">
        <div className="eodsch-toolbar">
          <div>
            <strong>NODEID mapping</strong>
            <div className="eodsch-muted">
              Each job runs on the server its NODEID is mapped to (exact match, no default). A job
              with an unmapped NODEID cannot be approved.
            </div>
          </div>
        </div>
        <table className="eodsch-table">
          <thead>
            <tr>
              <th>NODEID</th>
              <th>Target server</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => (
              <tr key={m.nodeid}>
                <td>{m.nodeid}</td>
                <td>{nameOf(m.target_id)}</td>
                <td className="eodsch-row-actions">
                  {canWrite ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      leadingIcon={Trash2}
                      aria-label={`Remove the mapping of ${m.nodeid}`}
                      onClick={() =>
                        run(() => svc.deleteMapping(env, m.nodeid), 'Mapping removed.')
                      }
                    />
                  ) : null}
                </td>
              </tr>
            ))}
            {!mappings.length ? (
              <tr>
                <td colSpan={3} className="eodsch-muted">
                  No NODEID is mapped.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {canWrite && targets.length ? (
          <div className="eodsch-inline-form">
            <label className="eodsch-field">
              NODEID
              <select
                value={map.nodeid}
                onChange={(e) => setMap({ ...map, nodeid: e.target.value })}
              >
                <option value="">
                  {unmappedNodeids.length
                    ? `choose… (${unmappedNodeids.length} not mapped yet)`
                    : workflowNodeids.length
                      ? 'every NODEID of the workflow is mapped'
                      : 'choose…'}
                </option>
                {unmappedNodeids.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value={OTHER_NODEID}>Other (type it)…</option>
              </select>
            </label>
            {map.nodeid === OTHER_NODEID ? (
              <label className="eodsch-field">
                NODEID as written in the XML
                <input
                  type="text"
                  value={map.custom}
                  onChange={(e) => setMap({ ...map, custom: e.target.value })}
                />
              </label>
            ) : null}
            <label className="eodsch-field">
              Target server
              <select
                value={map.target}
                onChange={(e) => setMap({ ...map, target: e.target.value })}
              >
                <option value="">choose…</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              size="sm"
              disabled={!chosenNodeid || !map.target}
              isLoading={busy}
              onClick={() =>
                run(
                  () => svc.setMapping(env, chosenNodeid, map.target),
                  'Mapping saved. If a workflow was approved, review and approve again.',
                  () => {
                    setMap({ nodeid: '', custom: '', target: '' });
                    if (hasPendingScheduleReturn() && onReturnToSchedule) {
                      toast.success('Mapping saved! Returning to schedule to fill details…');
                      setTimeout(() => {
                        onReturnToSchedule();
                      }, 500);
                    }
                  },
                )
              }
            >
              Map
            </Button>
          </div>
        ) : null}
      </div>

      <AdminModal
        title={form?.id ? 'Edit target server' : 'Add target server'}
        isOpen={Boolean(form)}
        onClose={() => !busy && setForm(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setForm(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} isLoading={busy} disabled={Boolean(formProblem)}>
              Save
            </Button>
          </>
        }
      >
        {form ? (
          <div className="eodsch-form">
            <label className="eodsch-field">
              Name
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="eodsch-field">
              Host name or IP address
              <input
                type="text"
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
              />
            </label>
            <label className="eodsch-field">
              SSH port
              <input
                type="number"
                min="1"
                max="65535"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
              />
            </label>
            <label className="eodsch-field">
              SSH user
              <input
                type="text"
                value={form.username}
                autoComplete="off"
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>
            <label className="eodsch-field">
              Authentication
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
              >
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {form.id && targets.find((t) => t.id === form.id)?.auth.method !== form.method ? (
                <small className="eodsch-bad">Changing the method removes the saved secret.</small>
              ) : null}
            </label>
            <label className="eodsch-check">
              <input
                type="checkbox"
                checked={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.checked })}
              />
              Trust only this host key (required to run anything)
            </label>
            {form.pin ? (
              <label className="eodsch-field">
                Host key fingerprint
                <input
                  type="text"
                  value={form.fingerprint}
                  placeholder="SHA256:…"
                  onChange={(e) => setForm({ ...form, fingerprint: e.target.value })}
                />
                <small className="eodsch-muted">
                  Read it on the server: ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256.
                  Do not copy it from a first connection.
                </small>
              </label>
            ) : null}
            {form.method === 'private_key' ? (
              <label className="eodsch-field">
                Private key (optional now; unencrypted RSA, ECDSA or Ed25519)
                <textarea
                  rows={6}
                  spellCheck={false}
                  autoComplete="off"
                  className="eodsch-mono"
                  value={form.secret}
                  onChange={(e) => setForm({ ...form, secret: e.target.value })}
                />
                <small className="eodsch-muted">
                  Encrypted before it is stored and never shown again.{' '}
                  {form.id ? 'Leave empty to keep the saved key.' : ''}
                </small>
              </label>
            ) : null}
            {form.method === 'password' ? (
              <label className="eodsch-field">
                Password (optional now)
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.secret}
                  onChange={(e) => setForm({ ...form, secret: e.target.value })}
                />
                <small className="eodsch-muted">
                  Encrypted before it is stored and never shown again.{' '}
                  {form.id ? 'Leave empty to keep the saved password.' : ''}
                </small>
              </label>
            ) : null}
            <div className="eodsch-field-inline">
              <span>Enabled</span>
              <Toggle
                checked={form.enabled}
                onChange={(v) => setForm({ ...form, enabled: v })}
                ariaLabel="Enabled"
              />
            </div>
            {formProblem ? <small className="eodsch-bad">{formProblem}</small> : null}
          </div>
        ) : null}
      </AdminModal>

      <AdminModal
        title={`Secret for ${secret?.target?.name ?? ''}`}
        isOpen={Boolean(secret)}
        onClose={() => !busy && setSecret(null)}
        footer={
          <>
            {secret?.target?.secret_configured ? (
              <Button
                variant="danger"
                onClick={() =>
                  run(
                    () => svc.clearTargetSecret(env, secret.target.id),
                    'Secret removed.',
                    () => setSecret(null),
                  )
                }
                disabled={busy}
              >
                Remove saved secret
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setSecret(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                run(
                  () => svc.setTargetSecret(env, secret.target.id, secret.value),
                  'Secret saved (encrypted).',
                  () => setSecret(null),
                )
              }
              isLoading={busy}
              disabled={!secret?.value}
            >
              Save secret
            </Button>
          </>
        }
      >
        {secret ? (
          <div className="eodsch-form">
            <p className="eodsch-muted">
              The secret is encrypted before it is stored and can never be shown again.{' '}
              {secret.target.secret_configured ? 'Saving replaces the current one.' : ''}
            </p>
            {secret.target.auth.method === 'private_key' ? (
              <label className="eodsch-field">
                Private key (unencrypted, RSA, ECDSA or Ed25519)
                <textarea
                  rows={8}
                  spellCheck={false}
                  autoComplete="off"
                  value={secret.value}
                  onChange={(e) => setSecret({ ...secret, value: e.target.value })}
                  className="eodsch-mono"
                />
              </label>
            ) : (
              <label className="eodsch-field">
                Password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={secret.value}
                  onChange={(e) => setSecret({ ...secret, value: e.target.value })}
                />
              </label>
            )}
          </div>
        ) : null}
      </AdminModal>

      <AdminModal
        title="Delete this target server?"
        isOpen={Boolean(removal)}
        onClose={() => !busy && setRemoval(null)}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoval(null)} disabled={busy}>
              Keep
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                run(
                  () => svc.deleteTarget(env, removal.id),
                  'Target server deleted.',
                  () => setRemoval(null),
                )
              }
              isLoading={busy}
            >
              Delete
            </Button>
          </>
        }
      >
        <p>
          {removal?.name} and its saved secret are removed. A server that is still mapped to NODEIDs
          cannot be deleted; remove those mappings first.
        </p>
      </AdminModal>
    </div>
  );
}

export default TargetsPanel;
