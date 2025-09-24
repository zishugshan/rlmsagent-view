export function csvEscape(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

/** Build CSV from <rlmsinfo> → all <rlmsreginfo> with all values (children + attrs). */
export function buildCsvFromXml(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  const rlmsinfo = doc.getElementsByTagName('rlmsinfo')[0];
  if (!rlmsinfo) return `message\r\n${csvEscape('No <rlmsinfo> root found')}\r\n`;

  const regInfos = Array.from(rlmsinfo.getElementsByTagName('rlmsreginfo'));
  if (!regInfos.length) return `message\r\n${csvEscape('No <rlmsreginfo> entries found')}\r\n`;

  type Row = Record<string, string>;
  const rows: Row[] = [];
  const headerSet = new Set<string>();

  const hasElementChildren = (el: Element) =>
    Array.from(el.childNodes).some(n => n.nodeType === Node.ELEMENT_NODE);

  const addValue = (row: Row, key: string, value: string) => {
    if (!value) return;
    row[key] = row[key] ? `${row[key]} | ${value}` : value;
    headerSet.add(key);
  };

  const flatten = (el: Element, base: string, row: Row) => {
    for (const attr of Array.from(el.attributes)) addValue(row, `${base}.@${attr.name}`, attr.value);

    if (!hasElementChildren(el)) {
      addValue(row, base, (el.textContent || '').trim());
      return;
    }

    const byName = new Map<string, Element[]>();
    for (const child of Array.from(el.children)) {
      const k = child.tagName;
      (byName.get(k) ?? byName.set(k, []).get(k)!).push(child);
    }
    for (const [tag, children] of byName.entries()) {
      if (children.length === 1) flatten(children[0], `${base}.${tag}`, row);
      else children.forEach((c, i) => flatten(c, `${base}.${tag}[${i}]`, row));
    }
  };

  for (const el of regInfos) {
    const row: Row = {};
    flatten(el, 'rlmsreginfo', row);

    // convenience: numeric-only PrivateID
    if (row['rlmsreginfo.PrivateID']) {
      const onlyNum = row['rlmsreginfo.PrivateID'].split('@')[0];
      addValue(row, 'rlmsreginfo.PrivateIDNumeric', onlyNum);
    }
    rows.push(row);
  }

  const allHeaders = Array.from(headerSet);
  const preferred = ['rlmsreginfo.PrivateID', 'rlmsreginfo.PrivateIDNumeric', 'rlmsreginfo.hssName'];
  const preferredPresent = preferred.filter(h => headerSet.has(h));
  const others = allHeaders.filter(h => !preferredPresent.includes(h)).sort();
  const headers = [...preferredPresent, ...others];

  const head = headers.map(csvEscape).join(',');
  const body = rows.map(r => headers.map(h => csvEscape(r[h] ?? '')).join(',')).join('\r\n');
  return `${head}\r\n${body}\r\n`;
}

