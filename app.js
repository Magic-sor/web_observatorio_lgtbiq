import { filterRows, group, minimum } from './model.js';
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const palette = ['#5877a0','#dfb457','#879dba','#ab91b0','#83a879','#d18e77','#718d96','#c7b991'];
const levelNames = ['Vacío / Inequivalencia','Regresiva / Criminalizante','Equivalencia parcial','Equivalencia plena'];
const colors = [null,'#df8585','#e6c366','#83ad70'];
const treatyColors = {'Vigente':'#83ad70','No vigente':'#d18e77','Controvertida':'#df8585'};
const filters = {}; let data, geography, current = [], page = 0, treaty = 'Belém do Pará (SIDH)';
const project=([lon,lat])=>[(lon+119)*4.6,(34-lat)*4.6];
const geoPath=geometry=>{const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;return polygons.map(poly=>poly.map(ring=>ring.map((p,i)=>(i?'L':'M')+project(p).map(n=>n.toFixed(2)).join(',')).join('')+'Z').join('')).join('');};
function filteredCountries(){ return data.countries.filter(c => filters.Cod_Pais ? c.Cod_Pais === filters.Cod_Pais : filters.Subregion_ILGA && c.Subregion_ILGA === filters.Subregion_ILGA); }
function focusSvg(svg, selectedCodes){
  const selectedPaths = [...svg.querySelectorAll('[data-country]')].filter(p => selectedCodes.has(p.dataset.country));
  svg.querySelectorAll('path').forEach(p => {
    p.style.opacity = selectedCodes.size && !selectedCodes.has(p.dataset.country) ? '.25' : '1';
    p.setAttribute('vector-effect', 'non-scaling-stroke');
  });
  if (selectedPaths.length) {
    const bounds = selectedPaths.map(p => p.getBBox());
    const left = Math.min(...bounds.map(b => b.x)), top = Math.min(...bounds.map(b => b.y));
    const right = Math.max(...bounds.map(b => b.x + b.width)), bottom = Math.max(...bounds.map(b => b.y + b.height));
    const padding = Math.max(right - left, bottom - top) * .12;
    svg.setAttribute('viewBox', `${left-padding} ${top-padding} ${right-left+padding*2} ${bottom-top+padding*2}`);
  }
}
const fields = [['Cod_Pais','País'],['Subregion_ILGA','Subregión'],['Ambito_Derecho','Ámbito de derecho'],['Formante','Formantes'],['Nivel_Equivalencia','Nivel de equivalencia'],['Efecto_Normativo','Efecto normativo'],['Tipo_Instrumento','Tipo de instrumento'],['year','Año de vigencia']];
const empty = '<p class="empty">Sin evidencias para esta selección.</p>';
function setFilter(key,value) { if(value==='Sin especificar')value='__empty__'; filters[key] = filters[key] === value ? '' : value; page = 0; render(); }
function counted(rows) { return rows.filter(r => r.ID_Evidencia); }
function renderFilters() {
  $('filters').innerHTML = fields.map(([key,label]) => {
    const source = key === 'Subregion_ILGA' ? data.countries : data.evidence;
    const options = key === 'Cod_Pais' ? data.countries.map(c=>[c.Cod_Pais,c.Pais]) : [...new Set(source.map(r=>key==='year'?r.Fecha_Vigencia?.slice(0,4):r[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).map(v=>[v,v]);
    if(key!=='year'&&source.some(r=>!r[key]))options.push(['__empty__','Sin especificar']);
    return `<div><label for="filter-${key}">${label}</label><select id="filter-${key}" data-key="${key}"><option value="">Todos</option>${options.map(([v,l])=>`<option value="${esc(v)}" ${filters[key]===v?'selected':''}>${esc(l)}</option>`).join('')}</select></div>`;
  }).join('');
  $('filters').querySelectorAll('select').forEach(el => el.onchange = () => { filters[el.dataset.key]=el.value;page=0;render(); });
}
function bars(id, key, rows) {
  const entries = group(counted(rows),key), max = Math.max(...entries.map(x=>x[1]),1);
  $(id).innerHTML = entries.length ? entries.map(([label,n])=>`<button class="bar-row" data-value="${esc(label)}" title="Filtrar: ${esc(label)}"><span>${esc(label)}</span><span class="bar-track"><div class="bar-fill" style="width:${n/max*100}%"></div></span><b>${n}</b></button>`).join('') : empty;
  $(id).querySelectorAll('button').forEach(b=>b.onclick=()=>setFilter(key,b.dataset.value));
}
function donut(id,key,rows) {
  const entries=group(counted(rows),key), total=entries.reduce((s,x)=>s+x[1],0); let angle=0;
  const color = (label,i) => key==='Efecto_Normativo' ? (label.startsWith('Promotor')?'#458b77':label.startsWith('Obstaculizador')?'#dc7072':label==='Neutro'?'#e3b65b':'#bdc6c3') : palette[i%palette.length];
  const slices=entries.map(([label,n],i)=>{const start=angle;angle+=n/total*360;return `${color(label,i)} ${start}deg ${angle}deg`;});
  $(id).innerHTML = total ? `<div class="donut-wrap"><div class="donut" role="img" aria-label="${total} evidencias" style="background:conic-gradient(${slices.join(',')})"><div class="donut-center">${total}<small>evidencias</small></div></div><div class="legend">${entries.map(([label,n],i)=>`<button data-value="${esc(label)}"><span class="dot" style="background:${color(label,i)}"></span><span>${esc(label)}</span><b>${n}</b></button>`).join('')}</div></div>` : empty;
  $(id).querySelectorAll('button').forEach(b=>b.onclick=()=>setFilter(key,b.dataset.value));
}
function render() {
  current = filterRows(data.evidence,filters,$('search').value);
  const valid = counted(current), countries = data.countries.filter(c=>(!filters.Cod_Pais||c.Cod_Pais===filters.Cod_Pais)&&(!filters.Subregion_ILGA||c.Subregion_ILGA===filters.Subregion_ILGA));
  const cards = [['Países en el catálogo',countries.length,`${new Set(current.map(r=>r.Cod_Pais)).size} con registros en la selección`,'#163f3d'],['Evidencias normativas',valid.length,`${current.length} filas · ${current.length-valid.length} sin identificador`,'#458b77'],['Promotoras / protectoras',valid.filter(r=>r.Efecto_Normativo==='Promotor / Protector').length,'Efecto normativo favorable','#38b389'],['Neutras',valid.filter(r=>r.Efecto_Normativo==='Neutro').length,'Efecto normativo neutro','#e5b94c'],['Restrictivas',valid.filter(r=>r.Efecto_Normativo==='Obstaculizador / Restrictivo').length,'Obstaculizadoras / restrictivas','#dc7072']];
  $('metrics').innerHTML=cards.map(([label,n,note,color])=>`<article class="metric" style="--metric-color:${color}"><div class="metric-label">${label}</div><div class="metric-value">${n}</div><div class="metric-note">${note}</div></article>`).join('');
  $('status').textContent = `${current.length} registros en la selección · Los recuentos de evidencias consideran los ID no vacíos, como en el tablero.`;
  renderFilters();
  const rights=[...new Set(data.evidence.map(r=>r.Ambito_Derecho).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  $('matrix').innerHTML=`<table class="matrix"><thead><tr><th>País / Ámbito</th>${rights.map(r=>`<th>${esc(r)}</th>`).join('')}</tr></thead><tbody>${countries.map(c=>`<tr><th>${esc(c.Pais)}</th>${rights.map(right=>{const n=minimum(current.filter(r=>r.Cod_Pais===c.Cod_Pais&&r.Ambito_Derecho===right));return `<td><button data-country="${c.Cod_Pais}" data-right="${esc(right)}" class="${n===null?'no-data':'level-'+n}" aria-label="${esc(c.Pais)}, ${esc(right)}: ${n===null?'Sin datos':levelNames[n]}" title="${n===null?'Sin datos':levelNames[n]}">${n===null?'—':n}</button></td>`;}).join('')}</tr>`).join('')}</tbody></table>`;
  $('matrix').querySelectorAll('button').forEach(b=>b.onclick=()=>{filters.Cod_Pais=b.dataset.country;filters.Ambito_Derecho=b.dataset.right;page=0;render();});
  bars('rights','Ambito_Derecho',current);donut('instruments','Tipo_Instrumento',current);
  const levelCounts=[0,1,2,3].map(l=>valid.filter(r=>r.level===l).length), max=Math.max(...levelCounts,1);
  $('levels').innerHTML=valid.length?`<div class="columns">${[3,2,1].map(l=>`<button class="column" data-level="${l}" aria-label="${levelNames[l]}: ${levelCounts[l]}"><b>${levelCounts[l]}</b><div class="pillar" style="height:${levelCounts[l]/max*140}px;background:${colors[l]}"></div><span class="label">${['','Regresiva','Parcial','Plena'][l]}</span></button>`).join('')}</div>${valid.some(r=>r.level===null)?`<p class="hint">${valid.filter(r=>r.level===null).length} evidencia(s) sin nivel especificado.</p>`:''}`:empty;
  $('levels').querySelectorAll('button').forEach(b=>b.onclick=()=>{const value=data.evidence.find(r=>r.level===Number(b.dataset.level))?.Nivel_Equivalencia;if(value)setFilter('Nivel_Equivalencia',value);});
  renderMap();renderTreaties();renderTable();
}
function renderMap(){
  if(!geography){$('map').innerHTML='<p class="empty">Mapa no disponible.</p>';return;}
  const selectedCountries = filteredCountries();
  const selectedCodes = new Set(selectedCountries.map(c => c.Cod_Pais));
  const zoomLabel = filters.Cod_Pais ? selectedCountries[0]?.Pais : filters.Subregion_ILGA;
  $('map').innerHTML=`<svg viewBox="0 0 400 420" aria-label="Mapa de equivalencia normativa de América Latina">${geography.features.map(f=>{const code=f.properties['ISO3166-1-Alpha-3'],country=data.countries.find(c=>c.Cod_Pais===code),level=minimum(current.filter(r=>r.Cod_Pais===code));return `<path d="${geoPath(f.geometry)}" fill="${level===null?'#e0e7e2':colors[level]}" ${country?`tabindex="0" role="button" data-country="${code}" aria-label="Filtrar ${esc(country.Pais)}"`:''} opacity="${filters.Cod_Pais&&filters.Cod_Pais!==code?'.35':'1'}"><title>${esc(country?.Pais||f.properties.name)}: ${level===null?'Sin datos':levelNames[level]}</title></path>`;}).join('')}</svg><p class="hint">Selecciona un país para filtrar · Cartografía: Natural Earth</p>`;
  $('map').querySelectorAll('[data-country]').forEach(p=>{p.onclick=()=>setFilter('Cod_Pais',p.dataset.country);p.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();p.onclick();}};});
  const svg = $('map').querySelector('svg');
  focusSvg(svg, selectedCodes);
  svg.setAttribute('aria-label', `Mapa de equivalencia normativa: ${zoomLabel || 'América Latina y el Caribe'}`);
  const caption = document.createElement('div');
  caption.className = 'map-focus';
  caption.textContent = zoomLabel || 'América Latina y el Caribe';
  $('map').prepend(caption);
}
function renderTreaties(){
  const rows = (data.treaties||[]).filter(t=>t.Tratado===treaty), status = new Map(rows.map(t=>[t.Cod_Pais,t]));
  const names = [...new Set((data.treaties||[]).map(t=>t.Tratado))];
  if(names.length&&!names.includes(treaty))treaty=names[0];
  $('treaty').innerHTML = names.map(n=>`<option value="${esc(n)}" ${n===treaty?'selected':''}>${esc(n)}</option>`).join('');
  const selectedCountries = filteredCountries(), selectedCodes = new Set(selectedCountries.map(c=>c.Cod_Pais));
  if(!geography){$('treaty-map').innerHTML='<p class="empty">Mapa no disponible.</p>';}
  else{
    $('treaty-map').innerHTML=`<svg viewBox="0 0 400 420" aria-label="Mapa de vigencia del tratado ${esc(treaty)}">${geography.features.map(f=>{const code=f.properties['ISO3166-1-Alpha-3'],country=data.countries.find(c=>c.Cod_Pais===code),s=status.get(code);return `<path d="${geoPath(f.geometry)}" fill="${s?treatyColors[s.Vigencia_Nombre]||'#e0e7e2':'#e0e7e2'}" ${country?`tabindex="0" role="button" data-country="${code}" aria-label="Filtrar ${esc(country.Pais)}"`:''}><title>${esc(country?.Pais||f.properties.name)}: ${s?esc(s.Vigencia_Nombre):'Sin datos'}</title></path>`;}).join('')}</svg>`;
    $('treaty-map').querySelectorAll('[data-country]').forEach(p=>{p.onclick=()=>setFilter('Cod_Pais',p.dataset.country);p.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();p.onclick();}};});
    focusSvg($('treaty-map').querySelector('svg'), selectedCodes);
  }
}
function renderTable(){
  const pageSize=10;page=Math.min(page,Math.max(0,Math.ceil(current.length/pageSize)-1));
  $('total').textContent=current.length+' REGISTROS';
  $('table').innerHTML=current.length?`<table class="details"><thead><tr>${['ID','País','Ámbito de derecho','Norma / instrumento','Efecto normativo','Equivalencia','Vigencia'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${current.slice(page*pageSize,(page+1)*pageSize).map((r,i)=>`<tr><td>${esc(r.ID_Evidencia||'Sin ID')}</td><td>${esc(r.Pais)}</td><td>${esc(r.Ambito_Derecho)}</td><td class="norm"><button data-index="${page*pageSize+i}">${esc(r.Nombre_Norma||'Sin nombre registrado')} ↗</button><div class="hint" style="margin:4px 0 0">${esc(r.Tipo_Instrumento||'Sin instrumento')}</div></td><td>${esc(r.Efecto_Normativo||'Sin especificar')}</td><td><span class="badge ${r.level===null?'no-data':'level-'+r.level}">${r.level===null?'Sin datos':levelNames[r.level]}</span></td><td>${esc(r.Fecha_Vigencia||'—')}</td></tr>`).join('')}</tbody></table>`:empty;
  $('table').querySelectorAll('button').forEach(b=>b.onclick=()=>showDetail(current[Number(b.dataset.index)]));
  $('page-info').textContent=current.length?`${page*pageSize+1}–${Math.min((page+1)*pageSize,current.length)} de ${current.length} registros`:'0 registros';
  $('prev').disabled=page===0;$('next').disabled=(page+1)*pageSize>=current.length;
}
function showDetail(r){
  const links=(r.URL_Evidencia||'').match(/https?:\/\/[^\s]+/g)||[];
  $('detail-content').innerHTML=`<div class="eyebrow">${esc(r.Pais)} · ${esc(r.ID_Evidencia||'SIN IDENTIFICADOR')}</div><h2>${esc(r.Nombre_Norma||'Sin nombre registrado')}</h2><dl>${[['Ámbito de derecho',r.Ambito_Derecho],['Artículo / sección',r.Articulo_Seccion],['Población específica',r.Poblacion_Especifica],['Efecto normativo',r.Efecto_Normativo],['Nivel de equivalencia',r.Nivel_Equivalencia],['Extracto relevante',r.Extracto_Relevante],['Fecha de vigencia',r.Fecha_Vigencia],['Observaciones',r.OBSERVACIONES]].map(([label,v])=>`<dt>${label}</dt><dd>${esc(v||'Sin especificar')}</dd>`).join('')}</dl><h3>Fuentes</h3>${links.length?links.map((url,i)=>`<p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Consultar fuente ${i+1} ↗</a></p>`).join(''):'<p>No se registró un enlace de fuente.</p>'}`;
  $('detail').showModal();
}
$('reset').onclick=()=>{Object.keys(filters).forEach(k=>delete filters[k]);$('search').value='';page=0;render();};
$('search').oninput=()=>{page=0;render();};$('prev').onclick=()=>{page--;renderTable();};$('next').onclick=()=>{page++;renderTable();};
$('treaty').onchange=e=>{treaty=e.target.value;renderTreaties();};
$('close-dialog').onclick=()=>$('detail').close();
try{
  const response=await fetch('data.json');if(!response.ok)throw new Error('No se pudo cargar la fuente de datos');data=await response.json();
  try{const response=await fetch('region.json');if(response.ok)geography=await response.json();}catch{}
  render();
}catch(error){$('status').textContent='No se pudieron cargar los datos. Inicia la aplicación con npm start y abre http://localhost:3000.';$('status').classList.add('error');console.error(error);}
