/**
 * Reshoot: re-aim the camera on a clip you already have.
 * Clip -> geometry + depth warp (preview: magenta = never seen) -> LTX re-render
 * through the CrossView-Warp IC-LoRA.
 */
import { tr } from '../i18n';
import { useEffect, useState } from 'react';
import { api, inputUrl, mediaUrl, uploadFile, type Take } from '../api';
import { inFeed, settingsOf, toast, useStore } from '../store';
import { Icon, MediaCard, Stepper, Switch, TierChip, fmtSeconds, useEstimate, useTierChoice } from '../ui';
import Viewer, { recreate, remove } from '../Viewer';
import { Compare, DropWell, probeClip } from './Mirror';
import { RESHOOT_ANGLES as SHOTS } from '../catalog';
import { tierSizeOf } from '../renderTier';
import { PhoneDrop } from '../Phone';
import { usePageDrop } from '../drop';

interface Clip { token: string; url: string; seconds: number; w: number; h: number }


export default function ReshootPage() {
  const [clip, setClip] = useState<Clip | null>(null);
  const [az, setAz] = useState(30);
  const [el, setEl] = useState(10);
  const [move, setMove] = useState(false);
  /** Metres from camera to the subject: the orbit pivots there. Selfie ~0.5, mid shot ~1, wide room 3+. */
  const [pivot, setPivot] = useState(1.05);
  const [prompt, setPrompt] = useState('');
  const [audio, setAudio] = useState(true);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [compare, setCompare] = useState<number | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [res, setRes] = useTierChoice('reshoot');

  const seconds = clip ? Math.max(2, Math.min(8, Math.floor(clip.seconds))) : 5;
  const size = tierSizeOf(res, clip?.w, clip?.h, 32);
  const est = useEstimate({ kind: 'video', model: 'reshoot', w: size.w, h: size.h, seconds });
  const takes = useStore((s) => s.takes.filter((t) => inFeed(t) && settingsOf(t).app === 'reshoot'));
  const preview = useStore((s) => s.takes.find((t) => t.id === previewId));
  // A changed angle makes the preview stale.
  useEffect(() => { setPreviewId(null); }, [az, el, move, pivot, clip?.token]);

  async function addClip(f: File) {
    if (!f.type.startsWith('video/')) { toast(tr('Drop a video clip (MP4 or MOV)'), true); return; }
    setBusy(tr('Uploading clip...'));
    try {
      const url = URL.createObjectURL(f);
      const meta = await probeClip(url);
      setClip({ token: await uploadFile(f), url, seconds: meta.s, w: meta.w, h: meta.h });
      if (meta.s > 8.5) toast(tr('Using the first 8 seconds of the clip'));
    } catch (e) {
      toast(e instanceof Error ? e.message : tr('upload failed'), true);
    } finally {
      setBusy(null);
    }
  }

  async function addPhoneClip(token: string) {
    const url = inputUrl(token);
    const meta = await probeClip(url);
    setClip({ token, url, seconds: meta.s, w: meta.w, h: meta.h });
    toast(meta.s > 8.5 ? tr('Clip from your phone is in. Using the first 8 seconds.') : tr('Clip from your phone is in'));
  }

  const body = (kind: 'reshoot' | 'reshoot-preview') => ({
    kind, app: kind === 'reshoot' ? 'reshoot' : 'reshoot-warp', videoModel: 'reshoot', sourceVideo: clip!.token,
    azimuth: az, elevation: el, pivotDepth: pivot,
    keyframes: move ? [{ f: 1, az: 0, el: 0 }, { f: Math.round(seconds * 24), az, el }] : undefined,
    prompt: prompt || 'The same scene, seen from a new camera angle.', userPrompt: prompt || `${az}° / ${el}°`,
    width: size.w, height: size.h, seconds, withAudio: audio, shotName: `reshoot_${az}_${el}`,
  });

  usePageDrop(tr('Drop a clip to reshoot'), (files) => void addClip(files[0]));

  async function runPreview() {
    if (!clip) return;
    setBusy(tr('Building preview...'));
    try { setPreviewId((await api.generate(body('reshoot-preview'))).takeId); } catch (e) { toast(e instanceof Error ? e.message : tr('failed'), true); } finally { setBusy(null); }
  }

  async function go() {
    if (!clip) return;
    setBusy(tr('Queuing...'));
    try {
      const r = await api.generate({ ...body('reshoot'), count });
      setPreviewId(null);
      setCompare(null);
      toast(tr("Queued reshoots: {0}", { 0: r.takeIds.length }));
    } catch (e) {
      toast(e instanceof Error ? e.message : tr('failed'), true);
    } finally {
      setBusy(null);
    }
  }

  const compareTake = takes.find((t) => t.id === compare);

  return (
    <div className="rail-layout" style={{ gridTemplateColumns: '360px 1fr' }}>
      <aside className="rail">
        <div className="display" style={{ fontSize: 26 }}>{tr("Reshoot")}</div>
        <div className="rail-section">
          <div className="label">{tr("Your clip")}</div>
          {clip ? (
            <div className="ref" style={{ aspectRatio: `${clip.w || 16} / ${clip.h || 9}` }}>
              <video src={clip.url} muted loop autoPlay playsInline />
              <span className="role">{Math.min(8, clip.seconds).toFixed(1)}s</span>
              <button type="button" className="x" onClick={() => setClip(null)} aria-label={tr("remove")}><Icon name="x" size={12} /></button>
            </div>
          ) : (
            <>
              <DropWell accept="video/*" onFile={addClip} icon="video" title={tr("Add a clip to reshoot")} sub="2 to 8 seconds, a clear subject, no black bars." />
              <PhoneDrop onClip={addPhoneClip} />
            </>
          )}
        </div>

        <div className="rail-section">
          <div className="label">{tr("New angle")}</div>
          <div className="chip-row">
            {SHOTS.map((s) => (
              <button key={s.id} type="button" className={`chip ${s.az === az && s.el === el ? 'on' : ''}`} onClick={() => { setAz(s.az); setEl(s.el); }}>{tr(s.label)}</button>
            ))}
          </div>
          <Slider label={tr("Orbit")} unit="°" min={-45} max={45} value={az} onChange={setAz} />
          <Slider label={tr("Height")} unit="°" min={-20} max={30} value={el} onChange={setEl} />
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="dim" style={{ fontSize: 12.5 }}>{tr("Subject distance")}</span><span className="mono" style={{ fontSize: 12 }}>{pivot.toFixed(2)} m</span></div>
            <input type="range" min={0.3} max={4} step={0.05} value={pivot} onChange={(e) => setPivot(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
            <div className="label" style={{ textTransform: 'none', letterSpacing: 0 }}>{tr("The camera orbits around this point. Selfie 0.5, mid shot 1, wide room 3.")}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="dim" style={{ fontSize: 12.5 }}>{tr("Move there during the shot")}</span>
            <Switch on={move} onChange={setMove} label={tr("camera move")} />
          </div>
        </div>

        <div className="rail-section">
          <div className="label">{tr("What is beyond the frame · optional")}</div>
          <textarea className="prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder={tr("A bookshelf and a window to the left of the desk.")} />
        </div>

        <div className="chip-row" style={{ alignItems: 'center' }}>
          <span className="chip"><Icon name="clock" size={14} />{seconds}s</span>
          <TierChip app="reshoot" value={res} onChange={setRes} />
          <Stepper value={count} min={1} max={4} onChange={setCount} fmt={(v) => `${v}/4`} />
          <span className="chip" style={{ gap: 10 }}><Icon name="audio" size={14} />{tr("Keep sound ")}<Switch on={audio} onChange={setAudio} label={tr("sound")} /></span>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button type="button" className="btn" disabled={!clip || !!busy} onClick={() => void runPreview()}><Icon name="orbit" size={14} />{tr("Preview the angle")}</button>
          <button type="button" className="generate" disabled={!clip || !!busy} onClick={() => void go()}>
            <span>{tr(busy) ?? tr('Reshoot')}</span>
            <span className="cost">{size.w}x{size.h}{est ? ` · ${fmtSeconds(est * count)}` : tr(' · LTX + CrossView')}</span>
          </button>
        </div>
      </aside>

      <section className="canvas">
        <div className="canvas-head">
          <div className="tabs" style={{ borderBottom: 0 }}>
            <button type="button" className={!compareTake && !previewId ? 'on' : ''} onClick={() => { setCompare(null); setPreviewId(null); }}>{tr("Takes")}</button>
            {previewId && <button type="button" className={!compareTake ? 'on' : ''}>{tr("Angle preview")}</button>}
            {compareTake && <button type="button" className="on">{tr("Compare")}</button>}
          </div>
        </div>
        <div className="canvas-body">
          {compareTake ? <Compare take={compareTake} onOpen={() => setViewing(compareTake.id)} /> : previewId ? <AnglePreview take={preview} /> : takes.length === 0 ? (
            <div className="hero-empty">
              <div className="label" style={{ marginBottom: 14 }}>{tr("A second camera, after the fact")}</div>
              <div className="display" style={{ fontSize: 'clamp(34px,4.6vw,60px)' }}>{tr("Move the camera ")}<span className="hl">{tr("you already rolled")}</span></div>
              <div className="steps3">
                <div><span className="label">01</span><b>{tr("Add a clip")}</b><span className="dim">{tr("Anything with a clear subject.")}</span></div>
                <div><span className="label">02</span><b>{tr("Aim the new camera")}</b><span className="dim">{tr("Orbit and height. Preview shows what the old camera never saw in magenta.")}</span></div>
                <div><span className="label">03</span><b>{tr("Reshoot")}</b><span className="dim">{tr("LTX fills it in and keeps the action.")}</span></div>
              </div>
            </div>
          ) : (
            <div className="grid">
              {takes.map((t) => (
                <MediaCard key={t.id} take={t} tag={settingsOf(t).app === 'reshoot-warp' ? 'Angle preview' : 'Reshoot'} onOpen={() => setCompare(t.id)} actions={<>
                  <button type="button" className="icon-btn" title="Recreate" onClick={() => void recreate(t)}><Icon name="redo" size={14} /></button>
                  <button type="button" className="icon-btn" title="Delete" onClick={() => void remove(t)}><Icon name="trash" size={14} /></button>
                </>} />
              ))}
            </div>
          )}
        </div>
      </section>
      {viewing !== null && <Viewer takeId={viewing} onClose={() => setViewing(null)} onStep={() => {}} />}
    </div>
  );
}

function Slider(p: { label: string; unit: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="dim" style={{ fontSize: 12.5 }}>{tr(p.label)}</span><span className="mono" style={{ fontSize: 12 }}>{p.value > 0 ? '+' : ''}{p.value}{p.unit}</span></div>
      <input type="range" min={p.min} max={p.max} step={1} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
    </div>
  );
}

function AnglePreview({ take }: { take: Take | undefined }) {
  if (!take || take.status === 'queued' || take.status === 'rendering') {
    return <div className="empty">{tr("Building the depth warp...")}</div>;
  }
  if (take.status !== 'done') return <div className="empty">{tr("Preview failed: ")}{take.error}</div>;
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <video src={mediaUrl(take.id)} muted loop autoPlay playsInline style={{ width: '100%', borderRadius: 14, display: 'block' }} />
      <div className="dim" style={{ marginTop: 10, fontSize: 12.5 }}>{tr("Magenta is what the original camera never saw. LTX invents it, guided by the prompt. Less magenta, more faithful.")}</div>
    </div>
  );
}
