
import { useState } from "react";
import axios from "axios";
import {
  Activity, BrainCircuit, ClipboardCheck, FileText, FlaskConical,
  AlertTriangle, CheckCircle2, Upload, Search, ShieldCheck,
  ChevronRight, Loader2, Plus, Save, Target, Layers, History, ArrowLeft
} from "lucide-react";
import "./App.css";

const API = "http://127.0.0.1:8000";

function App() {
  const [incident, setIncident] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API}/api/investigations`);
      setHistoryItems(res.data);
      setPage("history");
    } catch (e) {
      setError(e.response?.data?.detail || "Could not load investigation history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const openInvestigation = async (id) => {
    setHistoryLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API}/api/investigations/${id}`);
      setResult(res.data.analysis || res.data);
      setSelectedId(id);
      setSaved(true);
      setPage("dashboard");
    } catch (e) {
      setError(e.response?.data?.detail || "Could not open investigation.");
    } finally {
      setHistoryLoading(false);
    }
  };
  
  
  const analyze = async () => {
    if (!incident.trim() && !file) {
      setError("Enter incident details or upload a file.");
      return;
    }

    setLoading(true);
    setError("");
    setSaved(false);
    setSelectedId(null);

    try {
      const form = new FormData();
      form.append("incident_text", incident);
      if (file) form.append("file", file);

      const res = await axios.post(`${API}/api/analyze`, form);
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Analysis failed. Check backend.");
    } finally {
      setLoading(false);
    }
  };

  const saveInvestigation = async () => {
    if (!result) return;

    setSaving(true);
    setError("");

    try {
      if (selectedId) {
        await axios.put(`${API}/api/investigations/${selectedId}`, result);
      } else {
        const res = await axios.post(`${API}/api/investigations`, result);
        setSelectedId(res.data.id);
      }
      setSaved(true);
    } catch (e) {
      setError(e.response?.data?.detail || "Could not save investigation.");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key, value) => {
    if (!result) return;
    setResult(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };


  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><FlaskConical size={23}/></div>
          <div><h2>QualiCore<span> AI</span></h2><small>QUALITY INTELLIGENCE</small></div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <button className={`nav ${page === "dashboard" ? "active" : ""}`} onClick={() => setPage("dashboard")}><Activity size={18}/> RCA Dashboard</button>
        <button className={`nav ${page === "history" ? "active" : ""}`} onClick={loadHistory}><History size={18}/> Investigations</button>
        <div className="nav"><ShieldCheck size={18}/> CAPA Management</div>
        <div className="sidebar-bottom"><div className="avatar">QA</div><div><b>Quality Analyst</b><small>Manufacturing Team</small></div></div>
      </aside>

      <main className="main">
        {page === "history" ? (
          <>
            <header className="topbar">
              <div><span className="breadcrumb">Workspace <ChevronRight size={14}/> Investigations</span><h1>Investigation History</h1><p>Saved RCA investigations from PostgreSQL</p></div>
              <button className="primary" onClick={() => {setPage("dashboard");setResult(null);setIncident("");setFile(null);setSaved(false);setSelectedId(null);}}><Plus size={17}/> New Investigation</button>
            </header>
            {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
            <section className="panel">
              <div className="panel-heading"><History/><div><h2>Saved Investigations</h2><p>{historyItems.length} record(s) found</p></div><button className="save-btn" onClick={loadHistory}><Activity size={16}/> Refresh</button></div>
              {historyLoading ? <div className="loading-row"><Loader2 className="spin"/> Loading history...</div> :
                historyItems.length === 0 ? <div className="empty-state">No investigations saved yet. Generate an RCA and click Save Investigation.</div> :
                <div className="history-list">{historyItems.map(item => (
                  <button className="history-item" key={item.id} onClick={() => openInvestigation(item.id)}>
                    <div className="history-icon"><FileText size={20}/></div>
                    <div className="history-info"><b>{item.title || `Investigation #${item.id}`}</b><small>ID: {item.id} · {item.created_at ? new Date(item.created_at).toLocaleString() : "Date unavailable"}</small></div>
                    <span className={`severity ${String(item.severity || "medium").toLowerCase()}`}>{item.severity || "Unknown"} severity</span>
                    <span className="status-pill">{item.status || "Pending Review"}</span><ChevronRight size={18}/>
                  </button>
                ))}</div>}
            </section>
          </>
        ) : (
          <>
            <header className="topbar">
              <div><span className="breadcrumb">Workspace <ChevronRight size={14}/> RCA</span><h1>Root Cause Analysis</h1><p>AI-assisted investigation & quality intelligence</p></div>
              <div className="status"><span/> System Operational</div>
            </header>
            <section className="stats">
              <div className="stat"><div className="stat-icon blue"><Activity/></div><div><small>MODULE</small><b>AI RCA</b><span>Powered by LangGraph</span></div></div>
              <div className="stat"><div className="stat-icon purple"><BrainCircuit/></div><div><small>ANALYSIS ENGINE</small><b>Groq LLM</b><span>Intelligent reasoning</span></div></div>
              <div className="stat"><div className="stat-icon green"><ShieldCheck/></div><div><small>QUALITY CONTROL</small><b>Human Review</b><span>Required for approval</span></div></div>
            </section>
            <section className="panel input-panel">
              <div className="panel-heading"><div className="heading-icon"><FileText/></div><div><h2>Incident Intake</h2><p>Provide deviation details to initiate AI investigation</p></div><span className="step">STEP 01</span></div>
              <label className="field-label">Incident Description</label>
              <textarea value={incident} onChange={e => setIncident(e.target.value)} placeholder="Describe the incident, deviation, observations, equipment, batch details and any relevant information..."/>
              <label className="upload-box"><Upload size={21}/><div><b>{file ? file.name : "Upload incident document"}</b><small>PDF, TXT or incident report</small></div><span>Browse files</span><input type="file" accept=".pdf,.txt" onChange={e => setFile(e.target.files[0] || null)}/></label>
              <div className="input-footer"><span><ShieldCheck size={15}/> AI suggestions require qualified human review</span><button className="primary" onClick={analyze} disabled={loading}>{loading ? <><Loader2 className="spin"/> Analyzing...</> : <><BrainCircuit size={17}/> Generate RCA <ChevronRight size={17}/></>}</button></div>
            </section>
            {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
            {result && <>
              <div className="results-heading"><div><span className="step">STEP 02</span><h2>AI Investigation Results {selectedId ? `· #${selectedId}` : ""}</h2><p>Review, validate and edit AI-generated findings.</p></div><button className="save-btn" onClick={saveInvestigation} disabled={saving}>{saving ? <Loader2 className="spin"/> : saved ? <CheckCircle2/> : <Save/>}{saving ? "Saving..." : saved ? "Saved" : "Save Investigation"}</button></div>
              <section className="panel"><div className="panel-heading"><Target/><div><h2>Incident Overview</h2><p>AI-extracted investigation information</p></div></div>
                <label className="field-label">Incident Title</label><input value={result.incident_title || ""} onChange={e => updateField("incident_title",e.target.value)}/>
                <label className="field-label">Summary</label><textarea value={result.incident_summary || ""} onChange={e => updateField("incident_summary",e.target.value)}/>
                <div className="two-col"><div><label className="field-label">Severity</label><input value={result.severity || ""} onChange={e => updateField("severity",e.target.value)}/></div><div><label className="field-label">Department</label><input value={result.department || ""} onChange={e => updateField("department",e.target.value)}/></div></div>
                <label className="field-label">Problem Statement</label><textarea value={result.problem_statement || ""} onChange={e => updateField("problem_statement",e.target.value)}/>
              </section>
              <section className="panel"><div className="panel-heading"><Layers/><div><h2>Five Whys Analysis</h2><p>Progressive investigation of underlying causes</p></div></div>
                {(result.five_whys || []).map((w,i)=><div className="why-row" key={i}><div className="why-number">{w.why || i+1}</div><div className="why-content"><b>{w.question}</b><textarea value={w.answer || ""} onChange={e => {const arr=[...result.five_whys];arr[i]={...arr[i],answer:e.target.value};updateField("five_whys",arr);}}/></div></div>)}
              </section>
              <section className="panel"><div className="panel-heading"><Activity/><div><h2>Fishbone Analysis</h2><p>Potential contributing factors by category</p></div></div><div className="fish-grid">{Object.entries(result.fishbone || {}).map(([category,items])=><div className="fish-card" key={category}><b>{category}</b><ul>{(items || []).map((item,i)=><li key={i}>{item}</li>)}</ul></div>)}</div></section>
              <section className="panel"><div className="panel-heading"><Target/><div><h2>Potential Root Causes</h2><p>AI-generated hypotheses — not confirmed findings</p></div></div>{(result.potential_root_causes || []).map((cause,i)=><div className="cause" key={i}><div><b>{cause.cause}</b><p>{cause.evidence}</p></div><span className={`confidence ${String(cause.confidence).toLowerCase()}`}>{cause.confidence} confidence</span></div>)}</section>
              <section className="panel"><div className="panel-heading"><Search/><div><h2>Missing Evidence</h2><p>Information needed to validate the investigation</p></div></div><ul className="evidence">{(result.missing_evidence || []).map((e,i)=><li key={i}><AlertTriangle size={16}/>{e}</li>)}</ul></section>
              <section className="panel"><div className="panel-heading"><ClipboardCheck/><div><h2>CAPA Recommendations</h2><p>Suggested corrective & preventive actions</p></div></div>{(result.capa_recommendations || []).map((c,i)=><div className="capa" key={i}><div className="capa-top"><b>{c.type} Action</b><span className={`priority ${String(c.priority).toLowerCase()}`}>{c.priority}</span></div><p>{c.action}</p><small>Owner: {c.owner}</small></div>)}</section>
              <div className="review-banner"><ShieldCheck size={22}/><div><b>Human Review Required</b><p>AI findings are preliminary. A qualified investigator must validate evidence, confirm root causes and approve CAPA before implementation.</p></div></div>
            </>}
          </>
        )}
        <footer>QualiCore AI · RCA Intelligence Platform <span>AI-assisted · Human-approved</span></footer>
      </main>
    </div>
  );
}
export default App;
 
