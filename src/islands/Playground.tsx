import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CHALLENGES, type Challenge } from '../data/playground-challenges';
import { buildSamplePage } from '../data/playground-sample';
import { analyzeLocator, type Analysis } from '../lib/locator/analyze';
import { OVERLAY_ATTRIBUTE, resolveLocator } from '../lib/locator/engine';
import { featuresOf, parseLocator } from '../lib/locator/parser';
import tokensCss from '../styles/tokens.css?raw';
import LocatorEditor from './LocatorEditor';

const DEFAULT_LOCATOR = "page.getByRole('button', { name: 'Add to cart' })";
const EVALUATE_DELAY_MS = 120;

const samplePage = buildSamplePage(tokensCss);

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-term border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line bg-raised px-3 py-2">
        <span className="size-2.5 rounded-full bg-fail/70" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-pending/70" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-pass/70" aria-hidden="true" />
        <h2 className="ml-2 truncate text-xs font-normal text-dim">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function resolveTarget(challenge: Challenge, doc: Document): Element[] {
  return resolveLocator(parseLocator(challenge.target), doc);
}

function isSolved(challenge: Challenge, analysis: Analysis, doc: Document): boolean {
  if (analysis.kind !== 'resolved') return false;
  const features = featuresOf(analysis.expr);
  if (!challenge.requires.every((feature) => features.has(feature))) return false;
  const target = resolveTarget(challenge, doc);
  const found = analysis.matches.map((match) => match.element);
  return found.length === target.length && found.every((element, index) => element === target[index]);
}

/** Redraws the boxes inside the sample page. They scroll with it because they live in its document. */
function drawOverlay(doc: Document, analysis: Analysis | null, targets: Element[]) {
  doc.querySelector(`[${OVERLAY_ATTRIBUTE}]`)?.remove();
  const layer = doc.createElement('div');
  layer.setAttribute(OVERLAY_ATTRIBUTE, '');
  layer.setAttribute('aria-hidden', 'true');

  const scrollX = doc.defaultView?.scrollX ?? 0;
  const scrollY = doc.defaultView?.scrollY ?? 0;
  const addBox = (element: Element, state: string, badge?: string) => {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const box = doc.createElement('div');
    box.className = 'pl-box';
    box.dataset.state = state;
    box.style.left = `${rect.left + scrollX - 2}px`;
    box.style.top = `${rect.top + scrollY - 2}px`;
    box.style.width = `${rect.width + 4}px`;
    box.style.height = `${rect.height + 4}px`;
    if (badge) {
      const label = doc.createElement('span');
      label.className = 'pl-badge';
      label.textContent = badge;
      box.append(label);
    }
    layer.append(box);
  };

  targets.forEach((element) => addBox(element, 'target'));
  if (analysis?.kind === 'resolved') {
    const state = analysis.matches.length > 1 ? 'strict' : 'match';
    analysis.matches.forEach((match, index) => addBox(match.element, state, String(index)));
  }
  doc.documentElement.append(layer);
}

function scrollToFirstMatch(doc: Document, analysis: Analysis) {
  const win = doc.defaultView;
  if (analysis.kind !== 'resolved' || !win) return;
  const first = analysis.matches.find((match) => match.visible)?.element;
  if (!first) return;
  const rect = first.getBoundingClientRect();
  if (rect.top >= 0 && rect.bottom <= win.innerHeight) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  win.scrollTo({
    top: win.scrollY + rect.top - win.innerHeight / 3,
    behavior: reduced ? 'auto' : 'smooth',
  });
}

function summaryOf(analysis: Analysis | null): { text: string; tone: string } {
  if (!analysis) return { text: 'loading the sample page…', tone: 'text-muted' };
  if (analysis.kind === 'empty') return { text: 'type a locator to begin', tone: 'text-muted' };
  if (analysis.kind === 'error') return { text: '✗ invalid locator', tone: 'text-fail' };
  const count = analysis.matches.length;
  if (count === 0) return { text: '✗ 0 matches', tone: 'text-fail' };
  if (count === 1) return { text: '✓ 1 match', tone: 'text-pass' };
  return { text: `✗ ${count} matches: strict mode violation`, tone: 'text-fail' };
}

export default function Playground() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  const [source, setSource] = useState(DEFAULT_LOCATOR);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [solved, setSolved] = useState<ReadonlySet<string>>(new Set());
  const [showHint, setShowHint] = useState(false);
  const [domVersion, setDomVersion] = useState(0);

  const challenge = useMemo(() => CHALLENGES.find((item) => item.id === challengeId) ?? null, [challengeId]);

  const attachFrame = useCallback(() => {
    const frameDoc = frameRef.current?.contentDocument;
    // Before the srcdoc loads, the iframe briefly holds an empty about:blank document.
    if (frameDoc?.URL === 'about:srcdoc' && frameDoc.readyState === 'complete') setDoc(frameDoc);
  }, []);

  useEffect(attachFrame, [attachFrame]);

  // Keep the sample page on the site's theme.
  useEffect(() => {
    if (!doc) return;
    const root = document.documentElement;
    const sync = () => {
      if (root.dataset.theme) doc.documentElement.dataset.theme = root.dataset.theme;
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [doc]);

  // Interacting with the sample page changes what locators find, and resizing moves the highlights.
  useEffect(() => {
    if (!doc) return;
    const refresh = () => setDomVersion((version) => version + 1);
    doc.addEventListener('input', refresh);
    doc.addEventListener('change', refresh);
    doc.addEventListener('toggle', refresh, true);
    const resize = new ResizeObserver(refresh);
    resize.observe(doc.body);
    return () => {
      doc.removeEventListener('input', refresh);
      doc.removeEventListener('change', refresh);
      doc.removeEventListener('toggle', refresh, true);
      resize.disconnect();
    };
  }, [doc]);

  useEffect(() => {
    if (!doc) return;
    const timer = window.setTimeout(() => setAnalysis(analyzeLocator(source, doc)), EVALUATE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [doc, source, domVersion]);

  useEffect(() => {
    if (!doc || !analysis) return;
    drawOverlay(doc, analysis, challenge ? resolveTarget(challenge, doc) : []);
  }, [doc, analysis, challenge]);

  useEffect(() => {
    if (doc && analysis) scrollToFirstMatch(doc, analysis);
    // Only a new result should scroll, not a redraw caused by the visitor's own scrolling or resizing.
  }, [doc, analysis && analysis.kind === 'resolved' ? analysis.code : null]);

  const passed = !!(challenge && doc && analysis && isSolved(challenge, analysis, doc));
  useEffect(() => {
    if (passed && challengeId) setSolved((previous) => new Set(previous).add(challengeId));
  }, [passed, challengeId]);

  const startChallenge = (next: Challenge | null) => {
    setChallengeId(next?.id ?? null);
    setShowHint(false);
    setSource(next ? '' : DEFAULT_LOCATOR);
  };

  const nextChallenge = challenge ? CHALLENGES[CHALLENGES.indexOf(challenge) + 1] : undefined;
  const summary = summaryOf(analysis);
  const editorError = analysis?.kind === 'error' ? { start: analysis.start, end: analysis.end } : null;

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-2 xl:items-start">
      <div className="grid min-w-0 gap-6">
        <Panel title="locator.spec.ts">
          <div className="grid gap-3 p-4">
            <LocatorEditor value={source} label="locator" error={editorError} onChange={setSource} />
            <p role="status" className={`text-sm ${summary.tone}`}>
              {summary.text}
            </p>

            {analysis?.kind === 'error' && (
              <p role="alert" className="text-sm whitespace-pre-wrap text-fail">
                {analysis.message}
              </p>
            )}

            {analysis?.kind === 'resolved' && analysis.strictError && (
              <pre
                role="region"
                tabIndex={0}
                aria-label="strict mode error"
                className="max-h-64 overflow-y-auto rounded-term border border-line bg-raised p-3 text-xs leading-relaxed break-words whitespace-pre-wrap text-fail"
              >
                {analysis.strictError}
              </pre>
            )}

            {analysis?.kind === 'resolved' && analysis.hint && (
              <p className="text-sm text-muted">{analysis.hint}</p>
            )}

            {analysis?.kind === 'resolved' && analysis.suggestion && (
              <div className="grid gap-2 rounded-term border border-line bg-raised p-3 text-sm">
                <h3 className="text-xs font-normal text-pending">
                  <span aria-hidden="true">◌ </span>a sturdier locator
                </h3>
                <code className="break-words text-bright">{analysis.suggestion.code}</code>
                <p className="font-prose text-muted">{analysis.suggestion.why}</p>
                <button
                  type="button"
                  onClick={() => analysis.suggestion && setSource(analysis.suggestion.code)}
                  className="w-fit cursor-pointer rounded-term border border-line-strong px-2 py-1 text-xs text-pass hover:border-pass"
                >
                  use this locator
                </button>
              </div>
            )}
          </div>
        </Panel>

        {analysis?.kind === 'resolved' && analysis.matches.length > 0 && (
          <Panel title={`matches (${analysis.matches.length})`}>
            <ol
              aria-label="Matched elements"
              className="max-h-64 divide-y divide-line overflow-y-auto text-xs"
            >
              {analysis.matches.map((match, index) => (
                <li key={index} className="flex gap-3 px-4 py-2">
                  <span className="text-dim">{index}</span>
                  <code className="min-w-0 flex-1 break-words text-text">{match.preview}</code>
                  {!match.visible && <span className="text-pending">hidden</span>}
                </li>
              ))}
            </ol>
          </Panel>
        )}

        <Panel title={`challenges (${solved.size}/${CHALLENGES.length} solved)`}>
          <div className="grid gap-4 p-4">
            <ul aria-label="Challenges" className="flex flex-wrap gap-2 text-xs">
              {CHALLENGES.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={item.id === challengeId}
                    onClick={() => startChallenge(item.id === challengeId ? null : item)}
                    className={`cursor-pointer rounded-term border px-2 py-1 ${
                      item.id === challengeId
                        ? 'border-purple text-bright'
                        : 'border-line-strong text-muted hover:text-bright'
                    }`}
                  >
                    {solved.has(item.id) && (
                      <span className="text-pass">
                        ✓<span className="sr-only"> solved: </span>{' '}
                      </span>
                    )}
                    {item.title}
                  </button>
                </li>
              ))}
            </ul>

            {challenge ? (
              <div className="grid gap-3 text-sm">
                <p className="font-prose text-text">{challenge.brief}</p>
                <p className="text-xs text-purple">the dashed outline marks the target</p>
                {passed ? (
                  <p role="status" className="text-pass">
                    ✓ challenge passed
                  </p>
                ) : (
                  <p className="text-xs text-muted">must use: {challenge.requires.join(', ')}</p>
                )}
                {showHint && <p className="font-prose text-muted">{challenge.hint}</p>}
                <div className="flex flex-wrap gap-2 text-xs">
                  {!showHint && !passed && (
                    <button
                      type="button"
                      onClick={() => setShowHint(true)}
                      className="cursor-pointer rounded-term border border-line-strong px-2 py-1 text-muted hover:text-bright"
                    >
                      show hint
                    </button>
                  )}
                  {passed && nextChallenge && (
                    <button
                      type="button"
                      onClick={() => startChallenge(nextChallenge)}
                      className="cursor-pointer rounded-term border border-line-strong px-2 py-1 text-pass hover:border-pass"
                    >
                      next challenge
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="font-prose text-sm text-muted">
                Pick a challenge to practise one technique at a time.
              </p>
            )}
          </div>
        </Panel>
      </div>

      <div className="min-w-0 xl:sticky xl:top-[calc(var(--header-h)+1rem)]">
        <Panel title="sample page">
          <iframe
            ref={frameRef}
            title="Sample page for trying locators"
            srcDoc={samplePage}
            // The page is our own static HTML. The sandbox stops its forms from navigating the frame;
            // allow-scripts is there only so accessibility tools can run inside it.
            sandbox="allow-same-origin allow-scripts"
            onLoad={attachFrame}
            className="block h-[34rem] w-full bg-surface"
          />
        </Panel>
      </div>
    </div>
  );
}
