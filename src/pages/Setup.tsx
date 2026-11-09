/** Setup: which model bundles are on disk, and how to get the rest. */
import { tr } from '../i18n';
import { useEffect, useState } from 'react';
import { api, type BundleStatus } from '../api';
import { useStore } from '../store';
import { RenderTierPicker, VideoDecodePicker } from '../ui';

export default function Setup() {
  const [bundles, setBundles] = useState<BundleStatus[] | null>(null);
  const [busy, setBusy] = useState(false);
  const st = useStore((s) => s.status);
  const load = async (refresh = false) => {
    setBusy(true);
    try { setBundles((await api.preflight(refresh)).bundles); } catch { setBundles([]); } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);
  return (
    <div className="page-scroll">
      <div className="page-pad" style={{ maxWidth: 980 }}>
        <h1 className="display" style={{ fontSize: 44, margin: 0 }}>{tr("Setup")}</h1>
        <p className="dim">{tr("OpenField runs your local ComfyUI through the Comfy SDK. Weights live in ComfyUI. Anything marked missing is switched off until its files exist.")}</p>
        <div className="tile" style={{ margin: '18px 0' }}>
          <dl className="kv" style={{ width: '100%' }}>
            <dt>{tr("Engine")}</dt><dd>{st?.target === 'cloud' ? tr('Comfy Cloud') : tr("Local ComfyUI {0}", { 0: st?.version ? `v${st.version}` : '' })}</dd>
            <dt>{tr("Comfy API v2")}</dt><dd>{st?.api ? tr('answering') : tr('not answering')}</dd>
            <dt>{tr("GPU")}</dt><dd>{st?.gpu ?? tr('unknown')}{st?.vramTotalGb ? tr(" · {0} GB", { 0: (st.vramTotalGb * 1e9 / 2 ** 30).toFixed(0) }) : ''}</dd>
            <dt>{tr("Render size")}</dt><dd><RenderTierPicker /><div className="dim" style={{ fontSize: 12, marginTop: 4 }}>{tr("Every video app starts here and keeps its own size chip. Past 720p, use Upscale.")}</div></dd>
            <dt>{tr("Video decode")}</dt><dd><VideoDecodePicker /></dd>
            <dt>{tr("Get models")}</dt><dd className="mono">{tr("npm run models")}</dd>
            <dt>{tr("Check install")}</dt><dd className="mono">{tr("npm run doctor")}</dd>
          </dl>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 12px' }}>
          <div className="label">{tr("Model bundles")}</div>
          <button type="button" className="btn sm" disabled={busy} onClick={() => void load(true)}>{busy ? tr('Checking...') : tr('Re-check')}</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bundles?.map((b) => (
            <div key={b.id} className="tile" style={{ flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%' }}>
                <span className="badge" style={b.ready ? { background: 'rgba(110,231,168,.14)', color: 'var(--ok)' } : b.optional ? undefined : { background: 'rgba(255,93,108,.14)', color: 'var(--bad)' }}>{b.ready ? tr('ready') : tr('missing')}</span>
                <b>{tr(b.label)}</b>
                <span className="dim" style={{ marginLeft: 'auto' }}>{b.gb} {tr("GB")}{b.optional ? tr(' · optional') : ''} · <span className="mono">{b.id}</span></span>
              </div>
              <div className="dim" style={{ fontSize: 12.5 }}>{tr(b.purpose)}</div>
              <div className="label" style={{ textTransform: 'none', letterSpacing: 0 }}>{b.license}</div>
              {b.licenseWarning && <div style={{ color: 'var(--accent)', fontSize: 12.5 }}>{tr(b.licenseWarning)}</div>}
              {!b.ready && (
                <div className="compiled">
                  {b.missingFiles.map((f) => <div key={f.file}>{tr("models/")}{f.dir}/{f.file}  ← {f.override ? tr("set by {0} in .env (not downloaded)", { 0: f.override }) : `${f.repo}${f.gated ? tr(' (gated: accept the license on Hugging Face first)') : ''}`}</div>)}
                  {b.missingNodes.map((n) => <div key={n.class}>{tr("custom nodes: ")}{n.pack}  ← {n.url}</div>)}
                </div>
              )}
            </div>
          ))}
          {bundles?.length === 0 && <div className="empty">{tr("Could not read the engine. Start ComfyUI and press Re-check.")}</div>}
        </div>
      </div>
    </div>
  );
}
