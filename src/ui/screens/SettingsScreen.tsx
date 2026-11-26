import { useRef, useState } from 'react';
import { LOCALES, useT } from '@/i18n';
import { useGame } from '@/state/store';
import { restartTutorial } from '@/game';
import { platform, saves } from '@/state/services';
import type { BattleSpeed } from '@/save';
import './screens.css';

function Switch(props: { id: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      id={props.id}
      type="button"
      role="switch"
      className="switch"
      aria-checked={props.on}
      onClick={() => props.onChange(!props.on)}
    />
  );
}

export default function SettingsScreen() {
  const t = useT();
  const save = useGame((s) => s.save)!;
  const updateSave = useGame((s) => s.updateSave);
  const showToast = useGame((s) => s.showToast);
  const [json, setJson] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const p = platform();
  const st = save.settings;

  const set = <K extends keyof typeof st>(key: K, value: (typeof st)[K]) =>
    updateSave((s) => {
      s.settings[key] = value;
    });

  const doExport = async () => {
    const text = saves().exportJson();
    setJson(text);
    if (!p.isNative) {
      // В браузере отдаём файл; в WebView скачивание не работает, там остаётся текст для копирования.
      const blob = new Blob([text], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `kaelmor-save-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      showToast(t('settings.exportDone'));
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      showToast(t('settings.copied'));
    } catch {
      /* пользователь скопирует из поля вручную */
    }
  };

  const doImport = async (text: string) => {
    try {
      await saves().importJson(text);
      showToast(t('settings.importDone'));
      p.haptics.notify('success');
    } catch (e) {
      showToast(t('settings.importError', { error: e instanceof Error ? e.message : String(e) }));
      p.haptics.notify('error');
    }
  };

  const testNotify = async () => {
    if (!p.notifications.supported) {
      showToast(t('settings.notifyUnsupported'));
      return;
    }
    if (!(await p.notifications.requestPermission())) {
      showToast(t('settings.notifyDenied'));
      return;
    }
    await p.notifications.schedule({
      id: 999,
      title: 'Каэлмор',
      body: 'Добыча лагеря ждёт вас у костра!',
      at: Date.now() + 10_000,
    });
    showToast(t('settings.notifyScheduled'));
  };

  return (
    <div className="set">
      <div className="card set">
        <div className="row">
          <label htmlFor="s-sound">{t('settings.sound')}</label>
          <Switch id="s-sound" on={st.sound} onChange={(v) => set('sound', v)} />
        </div>
        <div className="row">
          <label htmlFor="s-vol">{t('settings.volume')}</label>
          <input
            id="s-vol"
            className="range"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={st.volume}
            disabled={!st.sound}
            onChange={(e) => set('volume', Number(e.target.value))}
            onPointerUp={() => p.audio.play('reward')}
          />
        </div>
        <div className="row">
          <label htmlFor="s-music">{t('settings.music')}</label>
          <Switch id="s-music" on={st.music} onChange={(v) => set('music', v)} />
        </div>
        <div className="row">
          <label htmlFor="s-mvol">{t('settings.musicVolume')}</label>
          <input
            id="s-mvol"
            className="range"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={st.musicVolume}
            disabled={!st.music}
            onChange={(e) => set('musicVolume', Number(e.target.value))}
          />
        </div>
        <div className="row">
          <label htmlFor="s-hap">{t('settings.haptics')}</label>
          <button
            type="button"
            className="btn"
            onClick={() => p.haptics.notify('success')}
            disabled={!st.haptics}
          >
            {t('settings.hapticsTest')}
          </button>
          <Switch id="s-hap" on={st.haptics} onChange={(v) => set('haptics', v)} />
        </div>
      </div>

      <div className="card set">
        <div className="row">
          <span>{t('settings.battleSpeed')}</span>
          <div className="seg">
            {([1, 2, 3] as BattleSpeed[]).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={st.battleSpeed === v}
                onClick={() => set('battleSpeed', v)}
              >
                ×{v}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <label htmlFor="s-auto">{t('settings.autoBattle')}</label>
          <Switch id="s-auto" on={st.autoBattle} onChange={(v) => set('autoBattle', v)} />
        </div>
        <div className="row">
          <label htmlFor="s-not">{t('settings.notifications')}</label>
          <Switch id="s-not" on={st.notifications} onChange={(v) => set('notifications', v)} />
        </div>
        <button type="button" className="btn" onClick={testNotify}>
          {t('settings.notifyTest')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            useGame.getState().updateSave((s) => restartTutorial(s));
            useGame.getState().showToast(t('tutorial.restarted'));
            useGame.getState().go('camp');
          }}
        >
          {t('tutorial.restart')}
        </button>
        <div className="row">
          <span>{t('settings.language')}</span>
          <div className="seg">
            {LOCALES.map((l) => (
              <button
                key={l.id}
                type="button"
                aria-pressed={st.locale === l.id}
                disabled={!l.ready}
                title={l.ready ? l.label : `${l.label} — ${t('settings.languageSoon')}`}
                onClick={() => set('locale', l.id)}
              >
                {l.id.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <h3>{t('settings.save')}</h3>
      <div className="card set">
        <div className="btns">
          <button type="button" className="btn btn--gold" onClick={doExport}>
            {t('settings.export')}
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            {t('settings.import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await doImport(await f.text());
              e.target.value = '';
            }}
          />
        </div>
        <label htmlFor="s-json" className="row">
          <small>{t('settings.importPaste')}</small>
        </label>
        <textarea
          id="s-json"
          className="json-box"
          value={json}
          onChange={(e) => setJson(e.target.value)}
          spellCheck={false}
        />
        <div className="btns">
          <button type="button" className="btn" disabled={!json} onClick={copy}>
            {t('settings.copy')}
          </button>
          <button type="button" className="btn" disabled={!json} onClick={() => doImport(json)}>
            {t('settings.importApply')}
          </button>
        </div>
        <button
          type="button"
          className="btn btn--danger"
          onClick={async () => {
            if (!confirmReset) {
              setConfirmReset(true);
              setTimeout(() => setConfirmReset(false), 4000);
              return;
            }
            setConfirmReset(false);
            await saves().reset();
            showToast(t('settings.resetDone'));
          }}
        >
          {confirmReset ? t('settings.resetConfirm') : t('settings.reset')}
        </button>
      </div>
      <p className="about">
        {t('settings.about', { version: __APP_VERSION__, platform: p.name, storage: p.storage.kind })}
        <br />
        {t('settings.saveVersion', { version: save.version })}
      </p>
    </div>
  );
}
