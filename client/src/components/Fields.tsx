import {useEffect, useId, useState} from 'react';
import type {ResourceSchema, Field, DataRecord} from '../lib/types';
import {api} from '../lib/api';

const references: Record<string,string> = {framework_ids:'frameworks',framework_id:'frameworks',control_ids:'controls',control_id:'controls',policy_ids:'policies',acknowledged_policy_ids:'policies',evidence_ids:'evidence',vendor_id:'vendors',audit_id:'audits',source_ids:'policies'};
export const humanize = (value: string) => String(value || '').replaceAll('_',' ').replace(/^./,s=>s.toUpperCase());

export function LinkedSelect({resource, label, value, onChange, multiple = true, required = false}: {resource:string;label:string;value:any;onChange:(value:any)=>void;multiple?:boolean;required?:boolean}) {
 const [items,setItems] = useState<DataRecord[]>([]);
 const [error,setError] = useState('');
 const [loading,setLoading] = useState(true);
 const [search,setSearch] = useState('');
 const [retry,setRetry] = useState(0);
 const id=useId();
 useEffect(()=>{let live=true;setLoading(true);setError('');api.get(`/${resource}`).then(result=>{if(live)setItems(result.items || []);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return ()=>{live=false;};},[resource,retry]);
 if(error) return <div className="field field-full"><span className="field-label">{label}</span><div className="inline-error" role="alert">Could not load {label.toLowerCase()}: {error} <button className="link-button" type="button" onClick={()=>setRetry(r=>r+1)}>Retry</button></div></div>;
 if(!multiple) return <label className="field">{label}{required && ' *'}<select value={value || ''} onChange={e=>onChange(e.target.value || null)} required={required} disabled={loading}><option value="">{loading?'Loading…':'None selected'}</option>{items.map(item=><option key={item.id} value={item.id}>{item.code?`${item.code} · `:''}{item.title}</option>)}</select></label>;
 const selected: string[] = Array.isArray(value)?value:[];
 return <fieldset className="field field-full linked-select"><legend>{label} <span className="muted">{selected.length} selected</span></legend>
  {items.length > 7 && <input aria-label={`Find ${label.toLowerCase()}`} placeholder={`Find ${label.toLowerCase()}…`} value={search} onChange={e=>setSearch(e.target.value)}/>}
  <div className="linked-options">{loading?<p className="muted">Loading {label.toLowerCase()}…</p>:!items.length?<p className="muted">No {label.toLowerCase()} yet. Create a record first, then link it here.</p>:items.filter(item=>`${item.title} ${item.code||''}`.toLowerCase().includes(search.toLowerCase())).map(item=><label className="check-option" key={item.id} htmlFor={`${id}-${item.id}`}><input type="checkbox" id={`${id}-${item.id}`} checked={selected.includes(item.id)} onChange={e=>onChange(e.target.checked?[...selected,item.id]:selected.filter(i=>i!==item.id))}/><span>{item.code && <small className="mono">{item.code} · </small>}{item.title}</span></label>)}</div>
 </fieldset>;
}

export function Fields({schema, value, onChange, omit=[]}: {schema:ResourceSchema; value:Record<string,any>; onChange:(key:string,value:any)=>void; omit?:string[]}) {
 const render = (field:Field) => {
  const key=field.key, current=value[key];
  if(field.readonly || omit.includes(key))return null;
  const label=field.label || humanize(key);
  const reference=references[key] || (key==='related_id' && value.related_type ? value.related_type : undefined);
  if(reference)return <LinkedSelect key={key} resource={reference} label={label} value={current} onChange={v=>onChange(key,v)} multiple={key.endsWith('_ids')} required={field.required}/>;
  if(key==='tags') return <label key={key} className="field field-full">{label}<input value={Array.isArray(current)?current.join(', '):current||''} onChange={e=>onChange(key,e.target.value.split(',').map(t=>t.trimStart()))} placeholder="Separate tags with commas"/></label>;
  const properties={required:field.required, 'aria-label':label, value:current??'', onChange:(e:any)=>onChange(key,e.target.value)};
  let input;
  if(field.type==='textarea') input=<textarea {...properties} rows={key==='description'?3:5}/>;
  else if(field.type==='boolean') input=<select {...properties} value={current===true?'true':current===false?'false':''} onChange={e=>onChange(key,e.target.value===''?null:e.target.value==='true')}><option value="">Not assessed</option><option value="true">Yes</option><option value="false">No</option></select>;
  else if(field.type==='select' || key==='status') {
   const options=field.options?.length?field.options:key==='status'?schema.statuses:[];
   input=<select {...properties}>{!field.required && <option value="">Select…</option>}{options.map(option=>typeof option==='string'?<option key={option} value={option}>{humanize(option)}</option>:<option key={option.value} value={option.value}>{option.label}</option>)}</select>;
  } else if(field.type==='number') input=<input {...properties} type="number" min={/likelihood|impact/.test(key)?1:undefined} max={/likelihood|impact/.test(key)?5:undefined} step="1" onChange={e=>onChange(key,e.target.value===''?null:Number(e.target.value))}/>;
  else if(field.type==='multiselect') input=<select aria-label={label} multiple value={current || []} onChange={e=>onChange(key,[...e.target.selectedOptions].map(o=>o.value))}>{(field.options||[]).map(o=>{const v=typeof o==='string'?o:o.value;return <option key={v} value={v}>{typeof o==='string'?humanize(o):o.label}</option>;})}</select>;
  else if(field.type==='json') return null; // Structured collections have purpose-built editors.
  else input=<input {...properties} type={['date','email','url'].includes(field.type)?field.type:'text'} maxLength={key==='title'?240:undefined}/>;
  return <label key={key} className={`field ${field.type==='textarea' || key==='title'?'field-full':''}`}><span>{label}{field.required && <span className="required"> *</span>}</span>{input}</label>;
 };
 return <div className="field-grid">{schema.fields.map(render)}</div>;
}
