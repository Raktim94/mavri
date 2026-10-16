import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Paper } from '../components/Paper';
import { Modal } from '../components/Modal';
import { useUi } from '../components/ui';
import { api, errorText } from '../api';
import { sampleDoc } from '../sample';
import { TAG_LABEL, TEMPLATES, type Template, type TemplateTag } from '../templates';
import type { Style } from '../types';

const FAV_KEY = 'mavri.favTemplates';
const loadFavs = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]');
  } catch {
    return [];
  }
};

export function TemplatesPage() {
  const { toast } = useUi();
  const [styles, setStyles] = useState<Style[]>([]);
  const [tag, setTag] = useState<TemplateTag | 'all' | 'favourites'>('all');
  const [favs, setFavs] = useState<string[]>(loadFavs);
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState<Template | null>(null);

  useEffect(() => {
    api
      .get<Style[]>('/api/styles')
      .then(setStyles)
      .catch(() => undefined);
  }, []);

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter(f => f !== id) : [...favs, id];
    setFavs(next);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch {
      // private mode: favourites last for this visit only
    }
  };

  async function use(t: Template) {
    setBusy(t.id);
    try {
      const existing = styles.find(s => s.template === t.id && !s.archived);
      if (existing) {
        toast(`“${existing.name}” is ready. Pick it as the Style on a new invoice.`);
        return;
      }
      const saved = await api.post<Style>('/api/styles', {
        name: styles.some(s => s.name === t.name) ? `${t.name} (template)` : t.name,
        accent: '#3b5bdb',
        font: 'sans',
        textSize: 'medium',
        logoSize: 'medium',
        pageSize: 'A4',
        headerStyle: 'light',
        rowStyle: 'plain',
        upperLabels: false,
        showNumbers: true,
        showUnit: true,
        showQty: true,
        ...t.look,
        template: t.id
      });
      setStyles([...styles, saved]);
      toast(`Added the style “${saved.name}”. Pick it as the Style on a new invoice.`);
    } catch (e) {
      toast(errorText(e, 'Could not add the template.'), 'error');
    } finally {
      setBusy('');
    }
  }

  const shown = TEMPLATES.filter(t =>
    tag === 'all' ? true : tag === 'favourites' ? favs.includes(t.id) : t.tags.includes(tag)
  );
  const tags: Array<TemplateTag | 'all' | 'favourites'> = [
    'all',
    'service',
    'retail',
    'tax',
    'international',
    'compact',
    'minimal',
    'favourites'
  ];

  return (
    <div className="templates">
      <header className="bar">
        <h1>Templates</h1>
      </header>
      <p className="muted">
        Fifteen print layouts. A template only changes how a document looks: amounts and tax come from the document, and
        documents you already issued keep the look they had. Tax and registration labels are presentation, not a
        compliance check. Change colour, font and logo size afterwards under <Link to="/styles">Styles</Link>.
      </p>
      <div className="chips" role="group" aria-label="Filter templates">
        {tags.map(t => (
          <button
            key={t}
            type="button"
            aria-pressed={tag === t}
            className={tag === t ? 'chip on' : 'chip'}
            onClick={() => setTag(t)}
          >
            {t === 'all' ? 'All' : t === 'favourites' ? 'Favourites' : TAG_LABEL[t]}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="muted">Nothing here yet. Star a template to keep it in Favourites.</p>}
      <ul className="tpl-grid">
        {shown.map(t => {
          const used = styles.find(s => s.template === t.id && !s.archived);
          return (
            <li key={t.id} className="tpl-card">
              <button
                type="button"
                className="tpl-thumb"
                onClick={() => setPreview(t)}
                aria-label={`Preview ${t.name}`}
              >
                <div className="tpl-scale" aria-hidden="true">
                  <Paper doc={sampleDoc({ ...t.look, template: t.id })} />
                </div>
              </button>
              <div className="tpl-meta">
                <div className="row">
                  <h2>{t.name}</h2>
                  <button
                    type="button"
                    className="link"
                    aria-pressed={favs.includes(t.id)}
                    aria-label={
                      favs.includes(t.id) ? `Remove ${t.name} from favourites` : `Add ${t.name} to favourites`
                    }
                    onClick={() => toggleFav(t.id)}
                  >
                    {favs.includes(t.id) ? '★' : '☆'}
                  </button>
                </div>
                <p className="muted">{t.blurb}</p>
                <button type="button" className={used ? '' : 'primary'} disabled={busy === t.id} onClick={() => use(t)}>
                  {used ? 'In your styles' : 'Use this template'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {preview && (
        <Modal title={preview.name} onClose={() => setPreview(null)} wide>
          <Paper doc={sampleDoc({ ...preview.look, template: preview.id })} />
        </Modal>
      )}
    </div>
  );
}
