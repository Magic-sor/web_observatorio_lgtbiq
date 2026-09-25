export function filterRows(rows, filters, search = '') {
  const term = search.trim().toLocaleLowerCase('es');
  return rows.filter(row => Object.entries(filters).every(([key,value]) => !value || (value === '__empty__' ? !row[key] : String(key === 'year' ? row.Fecha_Vigencia?.slice(0,4) : row[key]) === value)) && (!term || [row.ID_Evidencia,row.Pais,row.Nombre_Norma,row.Ambito_Derecho].some(v => v?.toLocaleLowerCase('es').includes(term))));
}
export function group(rows, key) {
  const counts = new Map();
  for (const row of rows) { const value = row[key] || 'Sin especificar'; counts.set(value, (counts.get(value) || 0) + 1); }
  return [...counts].sort((a,b) => b[1]-a[1]);
}
export function minimum(rows) {
  const values = rows.map(r => r.level).filter(v => Number.isInteger(v));
  return values.length ? Math.min(...values) : null;
}
export function csv(rows) {
  const columns = ['ID_Evidencia','Pais','Ambito_Derecho','Nombre_Norma','Tipo_Instrumento','Efecto_Normativo','Nivel_Equivalencia','Fecha_Vigencia','URL_Evidencia'];
  const escape = value => '"' + String(value ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"','""') + '"';
  return '\uFEFF' + [columns,...rows.map(r => columns.map(c => r[c]))].map(row => row.map(escape).join(',')).join('\r\n');
}
