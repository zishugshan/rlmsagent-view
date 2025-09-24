'use client'
import React, { useMemo, useState, useEffect} from "react";
import RlmsDownloadCsvButton from '@/components/RlmsDownloadCsvButton';

// ---- Tiny XML → JS tree helpers -------------------------------------------

type XmlNode = {
  name: string;
  attributes?: Record<string, string>;
  text?: string | null;
  children: XmlNode[];
};

function parseXmlToTree(xml: string): XmlNode | { error: string } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");
    const err = doc.querySelector("parsererror");
    if (err) {
      return { error: err.textContent || "Invalid XML" };
    }
    const rootEl = doc.documentElement; // first element node
    const convert = (el: Element): XmlNode => {
      // attributes
      const attrs: Record<string, string> = {};
      for (const a of Array.from(el.attributes)) attrs[a.name] = a.value;

      // element children
      const children: XmlNode[] = [];
      let text: string | null = null;
      for (const n of Array.from(el.childNodes)) {
        if (n.nodeType === Node.ELEMENT_NODE) {
          children.push(convert(n as Element));
        } else if (n.nodeType === Node.TEXT_NODE) {
          const t = (n.textContent || "").trim();
          if (t) text = t; // simple text nodes only
        }
      }
      return { name: el.tagName, attributes: Object.keys(attrs).length ? attrs : undefined, text, children };
    };

    return { name: "object", children: [convert(rootEl)] } as XmlNode;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

// ---- UI components ----------------------------------------------------------

const Caret: React.FC<{ open: boolean; visible?: boolean } > = ({ open, visible = true }) => (
  <span className="inline-block w-4 select-none text-gray-500">{visible ? (open ? "▾" : "▸") : ""}</span>
);

function useGrouped(children: XmlNode[]) {
  return useMemo(() => {
    const map = new Map<string, XmlNode[]>();
    for (const c of children) {
      const key = c.name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries());
  }, [children]);
}

const NodeRow: React.FC<{
  label: React.ReactNode;
  depth: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  showChevron?: boolean;
  rightBadge?: React.ReactNode;
}> = ({ label, depth, open, setOpen, showChevron = true, rightBadge }) => (
  <div
    className="flex items-center py-1 px-2 rounded hover:bg-gray-50 cursor-default"
    style={{ paddingLeft: depth * 14 + 8 }}
    onClick={() => showChevron && setOpen(!open)}
  >
    <Caret open={open} visible={showChevron} />
    <div className="flex-1 font-mono text-sm">
      {label}
    </div>
    {rightBadge ? <div className="ml-2 text-xs text-gray-500">{rightBadge}</div> : null}
  </div>
);

const AttrPill: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 mr-1">
    @{k}=&quot;{v}&quot;
  </span>
);

const XmlTreeNode: React.FC<{ node: XmlNode; depth?: number }> = ({ node, depth = 0 }) => {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = !!(node.children && node.children.length);
  const grouped = useGrouped(node.children || []);
  const hasAttrs = node.attributes && Object.keys(node.attributes).length > 0;

  const isRlmsReginfo = node.name.toLowerCase() === 'rlmsreginfo';
  const privateIdText =
    node.children?.find(c => c.name.toLowerCase() === 'privateid')?.text ?? null;

  // take only the part before '@' (fallback to full text if no '@')
  const displayId = privateIdText ? privateIdText.split('@')[0] : null;

  const attrsPills = hasAttrs ? (
    <span className="ml-2">
      {Object.entries(node.attributes!).map(([k, v]) => (
        <span key={k} className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 mr-1">
          @{k}=&quot;{v}&quot;
        </span>
      ))}
    </span>
  ) : null;

  const defaultLabel = (
    <span>
      <span className="text-gray-800">{node.name}</span>
      {hasChildren ? (
        <span className="text-gray-400"> {'{'}{'}'} </span>
      ) : node.text ? (
        <span className="text-blue-700">: {'"'}{node.text}{'"'}</span>
      ) : (
        <span className="text-gray-400">: null</span>
      )}
      {attrsPills}
    </span>
  );

  // rlmsreginfo {PrivateID: "404345130000011"}
  const specialLabel =
    isRlmsReginfo && displayId ? (
      <span>
        <span className="text-gray-800">{node.name}</span>{' '}
        <span className="text-gray-400">{'{'}</span>
        <span className="text-blue-700">{displayId}</span>
        <span className="text-gray-400">{'}'}</span>
        {attrsPills}
      </span>
    ) : null;

  return (
    <div>
      <NodeRow
        label={specialLabel ?? defaultLabel}
        depth={depth}
        open={open}
        setOpen={setOpen}
        showChevron={hasChildren}
      />
      {open && hasChildren && (
        <div>
          {grouped.map(([tag, items]) =>
            items.length > 1
              ? <ArrayGroup key={tag} tag={tag} items={items} depth={depth + 1} />
              : <XmlTreeNode key={tag + Math.random()} node={items[0]} depth={depth + 1} />
          )}
        </div>
      )}
    </div>
  );
};


const ArrayGroup: React.FC<{ tag: string; items: XmlNode[]; depth: number }> = ({ tag, items, depth }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <NodeRow
        label={<span><span className="text-gray-800">{tag}</span> <span className="text-gray-500">[</span><span className="text-gray-800">{items.length}</span><span className="text-gray-500">]</span></span>}
        depth={depth}
        open={open}
        setOpen={setOpen}
        showChevron={true}
        rightBadge={<span className="text-gray-400">[{items.length}]</span>}
      />
      {open && (
        <div>
          {items.map((n, i) => (
            <XmlTreeNode key={i} node={n} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const XML_URL = '/api/xml';
const COUNT_URL = '/api/rlmsreginfo-count';

export default function XmlTreeViewerApp() {
  const [xmlTree, setXmlTree] = useState<XmlNode | { error: string } | null>(null);
  const [xmlRaw, setXmlRaw] = useState<string | null>(null);
  const [reginfoCount, setReginfoCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let xml: string | null = null;

      // 1) fetch full XML (for the tree)
      try {
        const res = await fetch(XML_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        xml = await res.text();
        if (!cancelled) {
          setXmlTree(parseXmlToTree(xml));
          setXmlRaw(xml);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setXmlTree({ error: `Failed to load XML: ${msg}` });
      }

      // 2) get server-side count (fast), fallback to client count if needed
      try {
        const r = await fetch(COUNT_URL, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const { count } = await r.json();
        if (!cancelled) setReginfoCount(typeof count === 'number' ? count : 0);
      } catch {
        if (xml) {
          const m = xml.match(/<\s*rlmsreginfo\b/gi);
          if (!cancelled) setReginfoCount(m ? m.length : 0);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="w-full h-full bg-gray-100 text-gray-900">

      <div className="bg-teal-500 text-white px-4 py-3 font-semibold tracking-wide shadow">
        <span>XML Tree</span>
        <RlmsDownloadCsvButton xml={xmlRaw} />
      </div>

      <div className="p-2">
        {!xmlTree && <div className="m-4 text-gray-600">Loading XML…</div>}
        {xmlTree && 'error' in xmlTree && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{xmlTree.error}</div>
        )}
        {xmlTree && !('error' in xmlTree) && (
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <XmlTreeNode node={xmlTree as XmlNode} />
          </div>
        )}
      </div>

      {/* Footer hint with real count */}
      <div className="p-3 text-xs text-gray-500">
        {reginfoCount === null
          ? 'Counting rlmsreginfo…'
          : <>rlmsreginfo count: <code>{reginfoCount}</code></>}
      </div>
    </div>
  );
}