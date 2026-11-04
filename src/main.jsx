import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import "./styles.css";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;
const SLUG = "main";
const BUCKET = "editable-qr-assets";

function App() {
  if (!supabase) return <main className="shell"><section className="panel"><h1>Supabase setup required</h1><p>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your deployment environment.</p></section></main>;
  return location.pathname.startsWith("/admin") ? <Admin /> : <PublicPage />;
}

function PublicPage() {
  const [record, setRecord] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    supabase.from("editable_qr_codes").select("title,content,updated_at").eq("slug", SLUG).eq("is_published", true).maybeSingle()
      .then(({data,error}) => { if (error) setError(error.message); else if (!data) setError("This QR page is unavailable."); else setRecord(data); });
  }, []);
  return <main className="shell">
    <header className="brand"><div className="brand-mark">QR</div><div><strong>RR CDO Editable QR</strong><small>Information portal</small></div></header>
    <section className="panel">
      {!record && !error && <p>Loading information…</p>}
      {error && <><h1>Page unavailable</h1><p>{error}</p></>}
      {record && <><div className="eyebrow">LATEST PUBLISHED INFORMATION</div><h1>{record.title}</h1>
        {(record.content || []).map((item,i) => <article className="content-item" key={item.id || i}>
          {item.heading && <h2>{item.heading}</h2>}
          {item.type === "text" && <p className="preserve">{item.value}</p>}
          {item.type === "number" && <div className="big-value">{item.value}</div>}
          {item.type === "link" && <a href={safeUrl(item.url)} target="_blank" rel="noreferrer">{item.label || item.url}</a>}
          {item.type === "image" && <img className="content-image" src={item.url} alt={item.alt || item.heading || "Information"} />}
        </article>)}
        <p className="updated">Last updated: {new Date(record.updated_at).toLocaleString()}</p>
      </>}
    </section><footer>Information may change without changing this QR code.</footer>
  </main>;
}

function safeUrl(value) {
  try { const u = new URL(value); return ["https:","http:"].includes(u.protocol) ? u.href : "#"; }
  catch { return "#"; }
}

function Admin() {
  const [session,setSession] = useState(null), [email,setEmail] = useState(""), [password,setPassword] = useState("");
  const [record,setRecord] = useState(null), [title,setTitle] = useState("RR CDO Information");
  const [content,setContent] = useState([]), [published,setPublished] = useState(true);
  const [status,setStatus] = useState(""), [busy,setBusy] = useState(false), [qr,setQr] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const {data:listener} = supabase.auth.onAuthStateChange((_e,s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session) load(); }, [session]);

  async function load() {
    setStatus("Loading QR content…");
    const {data,error} = await supabase.from("editable_qr_codes").select("*").eq("slug",SLUG).maybeSingle();
    if (error) return setStatus(error.message);
    if (!data) return setStatus("QR record missing. Run supabase/setup.sql.");
    setRecord(data); setTitle(data.title); setContent(data.content || []); setPublished(data.is_published);
    setQr(await QRCode.toDataURL(location.origin + "/q/" + SLUG,{width:420,errorCorrectionLevel:"H"}));
    setStatus("");
  }
  async function signIn(e) {
    e.preventDefault(); setBusy(true);
    const {error} = await supabase.auth.signInWithPassword({email,password});
    setBusy(false); if (error) setStatus(error.message);
  }
  async function save() {
    setBusy(true); setStatus("Saving…");
    const {data,error} = await supabase.from("editable_qr_codes").update({title,content,is_published:published,updated_at:new Date().toISOString()}).eq("id",record.id).select().single();
    setBusy(false); if (error) setStatus("Save failed: " + error.message); else {setRecord(data);setStatus("Saved. The permanent QR now shows the latest information.");}
  }
  function patch(id,values) { setContent(old => old.map(x => x.id === id ? {...x,...values} : x)); }
  function add(type) {
    const item = {id:crypto.randomUUID(),type,heading:""};
    if (type === "text" || type === "number") item.value = "";
    if (type === "link") Object.assign(item,{label:"Open link",url:"https://"});
    if (type === "image") Object.assign(item,{url:"",alt:""});
    setContent(old => [...old,item]);
  }
  async function upload(id,file) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5*1024*1024) return setStatus("Choose an image no larger than 5 MB.");
    setBusy(true); setStatus("Uploading image…");
    const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi,"");
    const path = SLUG + "/" + crypto.randomUUID() + "." + ext;
    const {error} = await supabase.storage.from(BUCKET).upload(path,file,{upsert:false,contentType:file.type});
    if (error) {setBusy(false);return setStatus(error.message);}
    const {data} = supabase.storage.from(BUCKET).getPublicUrl(path);
    patch(id,{url:data.publicUrl,alt:file.name}); setBusy(false); setStatus("Image uploaded. Save changes to publish.");
  }

  if (!session) return <main className="shell"><header className="brand"><div className="brand-mark">QR</div><div><strong>QR Manager</strong><small>Administrator access</small></div></header>
    <form className="panel login" onSubmit={signIn}><div className="eyebrow">SECURE ADMIN AREA</div><h1>Sign in</h1>
      <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      <button disabled={busy}>{busy ? "Please wait…" : "Sign in"}</button>{status && <p className="status">{status}</p>}
      <p className="hint">Admin accounts must be created in Supabase Auth and authorized in editable_qr_admins.</p>
    </form></main>;

  return <main className="shell admin-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark">QR</div><div><strong>QR Manager</strong><small>Permanent editable QR</small></div></div><button className="secondary" onClick={()=>supabase.auth.signOut()}>Sign out</button></header>
    <section className="panel"><div className="eyebrow">PERMANENT QR CODE</div><h1>Manage your information</h1><p className="muted">Edit and save. The QR address stays the same.</p>
      {qr && <div className="qr-area"><img src={qr} alt="Permanent QR code"/><div><strong>Scan destination</strong><p className="break">{location.origin}/q/{SLUG}</p><a href={qr} download="rr-cdo-permanent-qr.png">Download QR PNG</a></div></div>}
      <label>Page title<input value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <div className="section-heading"><h2>Information blocks</h2><span>{content.length} blocks</span></div>
      {content.map((item,i)=><div className="editor-card" key={item.id}>
        <div className="editor-head"><strong>Block {i+1} · {item.type}</strong><button type="button" className="danger" onClick={()=>setContent(old=>old.filter(x=>x.id!==item.id))}>Remove</button></div>
        <label>Heading<input value={item.heading||""} onChange={e=>patch(item.id,{heading:e.target.value})}/></label>
        {(item.type==="text" || item.type==="number") && <label>{item.type==="text"?"Text":"Number or value"}{item.type==="text" ? <textarea rows="4" value={item.value||""} onChange={e=>patch(item.id,{value:e.target.value})}/> : <input value={item.value||""} onChange={e=>patch(item.id,{value:e.target.value})}/>}</label>}
        {item.type==="link" && <><label>Link label<input value={item.label||""} onChange={e=>patch(item.id,{label:e.target.value})}/></label><label>URL<input value={item.url||""} onChange={e=>patch(item.id,{url:e.target.value})}/></label></>}
        {item.type==="image" && <><label>Image URL<input value={item.url||""} onChange={e=>patch(item.id,{url:e.target.value})}/></label><label>Alt text<input value={item.alt||""} onChange={e=>patch(item.id,{alt:e.target.value})}/></label><label>Upload image (max 5 MB)<input type="file" accept="image/*" onChange={e=>upload(item.id,e.target.files?.[0])}/></label>{item.url&&<img className="preview-image" src={item.url} alt="Preview"/>}</>}
      </div>)}
      <div className="add-buttons">{["text","number","link","image"].map(t=><button type="button" className="secondary" key={t} onClick={()=>add(t)}>+ {t[0].toUpperCase()+t.slice(1)}</button>)}</div>
      <label className="toggle"><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/> Publish this page</label>
      <button className="save" disabled={busy||!record} onClick={save}>{busy?"Please wait…":"Save and publish changes"}</button>
      {status&&<p className="status">{status}</p>}
    </section><footer>Signed in as {session.user.email}. Access is protected by Supabase Row Level Security.</footer>
  </main>;
}
createRoot(document.getElementById("root")).render(<App />);
