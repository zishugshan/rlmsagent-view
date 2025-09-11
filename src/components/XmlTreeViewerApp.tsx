'use client'
import React, { useMemo, useState } from "react";

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

const XmlTreeNode: React.FC<{ node: XmlNode; depth?: number }>= ({ node, depth = 0 }) => {
  const [open, setOpen] = useState(depth < 1); // expand first level by default
  const hasChildren = node.children && node.children.length > 0;
  const grouped = useGrouped(node.children || []);
  const hasAttrs = node.attributes && Object.keys(node.attributes).length > 0;

  return (
    <div>
      <NodeRow
        label={
          <span>
            <span className="text-gray-800">{node.name}</span>
            {hasChildren ? (
              <span className="text-gray-400"> {"{"}{"}"}</span>
            ) : node.text ? (
              <span className="text-blue-700">: {'"'}{node.text}{'"'}</span>
            ) : (
              <span className="text-gray-400">: null</span>
            )}
            {hasAttrs && (
              <span className="ml-2">{Object.entries(node.attributes!).map(([k,v]) => <AttrPill key={k} k={k} v={v} />)}</span>
            )}
          </span>
        }
        depth={depth}
        open={open}
        setOpen={setOpen}
        showChevron={hasChildren}
      />

      {open && hasChildren && (
        <div>
          {grouped.map(([tag, items]) => {
            if (items.length > 1) {
              return <ArrayGroup key={tag} tag={tag} items={items} depth={depth + 1} />;
            }
            return <XmlTreeNode key={tag + Math.random()} node={items[0]} depth={depth + 1} />;
          })}
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

const sampleXml = `<?xml version="1.0"?>\n<rlmsinfo>\n  <rlmsreginfo>\n    <PrivateID>404535130000840</PrivateID>\n    <hssName>NA</hssName>\n  </rlmsreginfo>\n  <rlmsreginfo>\n    <PrivateID>404535130000841</PrivateID>\n    <hssName>NA</hssName>\n  </rlmsreginfo>\n</rlmsinfo>`;

function Controls({ onLoad }: { onLoad: (xml: string) => void }) {
  const [text, setText] = useState("");

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      onLoad(String(reader.result || ""));
    };
    reader.readAsText(f);
  };

  return (
    <div className="flex items-center gap-2 p-3 border-b bg-white sticky top-0 z-10">
      <button className="px-3 py-1.5 rounded bg-black text-white text-sm" onClick={() => onLoad(text || sampleXml)}>Parse XML</button>
      <input type="file" accept=".xml,.txt" onChange={onPickFile} className="text-sm" />
      <button className="px-3 py-1.5 rounded border text-sm" onClick={() => onLoad(sampleXml)}>Load demo</button>
      <textarea
        placeholder="Paste XML here…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="ml-2 flex-1 h-20 p-2 border rounded font-mono text-xs"
      />
    </div>
  );
}

export default function XmlTreeViewerApp() {
  const [xmlTree, setXmlTree] = useState<XmlNode | { error: string } | null>(null);

  return (
    <div className="w-full h-full bg-gray-100 text-gray-900">
      {/* Header */}
      <div className="bg-teal-500 text-white px-4 py-3 font-semibold tracking-wide shadow">XML Tree</div>

      <Controls onLoad={(xml) => setXmlTree(parseXmlToTree(xml))} />

      <div className="p-2">
        {!xmlTree && (
          <div className="m-4 text-gray-600">Paste XML, load a file, or click <em>Load demo</em> to see the tree.</div>
        )}
        {xmlTree && "error" in xmlTree && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{xmlTree.error}</div>
        )}
        {xmlTree && !("error" in xmlTree) && (
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <XmlTreeNode node={xmlTree as XmlNode} />
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="p-3 text-xs text-gray-500">Tip: repeated tags are grouped as arrays, e.g., <code>rlmsreginfo [198]</code>. Click to expand.</div>
    </div>
  );
}

