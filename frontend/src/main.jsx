import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import './style.css'
import { api } from './api'

const fmtDate = (value) => new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
const fmtTime = (value) => new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const fmtNumber = (value) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(Number(value || 0))
const workSets = (exercise) => exercise.sets.filter((set) => set.kind === 'WORK')
const createExercise = () => ({ name: '', targetSets: 3, targetReps: 10, restSeconds: 90 })

function Icon({ name, size = 20 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    dumbbell: <><path d="m6.5 6.5 11 11M4 9l5-5M15 20l5-5M2.5 11.5l9-9M12.5 21.5l9-9"/></>,
    history: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    chart: <><path d="M3 19h18M5 16l5-5 4 3 5-8"/><path d="M16 6h3v3"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    back: <path d="M19 12H5m6 6-6-6 6-6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    edit: <><path d="m4 17 11-11 3 3L7 20H4v-3Z"/><path d="m13 8 3 3"/></>,
    trash: <><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v5M14 11v5"/></>,
    bolt: <path d="m13 2-9 11h7l-1 9 10-12h-7l0-8Z"/>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function App() {
  const [view, setView] = useState('home')
  const [plans, setPlans] = useState([])
  const [sessions, setSessions] = useState([])
  const [session, setSession] = useState(null)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const [nextPlans, nextSessions] = await Promise.all([api.plans(), api.sessions()])
    setPlans(nextPlans)
    setSessions(nextSessions)
    return nextSessions
  }
  useEffect(() => {
    refresh().then(async (nextSessions) => {
      const active = nextSessions.find((item) => !item.completedAt)
      if (active) setSession(await api.session(active.id))
    }).catch((e) => setError(`Não foi possível ligar à API. ${e.message}`)).finally(() => setLoading(false))
  }, [])

  async function run(action, success) {
    setError('')
    setBusy(true)
    try { await action(); if (success) success() }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  function navigate(next) { setError(''); setView(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  async function savePlan(payload) {
    await run(async () => { await (editing ? api.updatePlan(editing.id, payload) : api.createPlan(payload)); await refresh() }, () => { setEditing(null); navigate('plans') })
  }
  async function startPlan(plan) {
    await run(async () => { const next = await api.start(plan.id); setSession(next); await refresh() }, () => navigate('train'))
  }
  async function openSession(id) {
    await run(async () => setSession(await api.session(id)), () => navigate('session'))
  }
  async function deletePlan(plan) {
    if (!window.confirm(`Eliminar “${plan.name}”? O histórico de sessões fica guardado.`)) return
    await run(async () => { await api.deletePlan(plan.id); await refresh() })
  }
  async function addSet(exerciseId, body) {
    await run(async () => setSession(await api.addSet(session.id, exerciseId, body)))
  }
  async function removeSet(exerciseId, setId) {
    await run(async () => setSession(await api.removeSet(session.id, exerciseId, setId)))
  }
  async function complete(notes) {
    await run(async () => { setSession(await api.complete(session.id, notes)); await refresh() }, () => navigate('session'))
  }

  const completed = sessions.filter((item) => item.completedAt)
  const active = session && !session.completedAt ? session : null
  const totalVolume = completed.reduce((sum, item) => sum + Number(item.volumeKg), 0)

  return <div className="app-shell">
    <aside className="sidebar d-none d-lg-flex">
      <button className="brand" onClick={() => navigate('home')}><span className="brand-mark"><Icon name="dumbbell" size={23}/></span><span>my<span>Gym</span></span></button>
      <div className="nav-caption">MENU PRINCIPAL</div>
      <nav className="side-nav">
        <NavButton icon="grid" label="Visão geral" active={view === 'home'} onClick={() => navigate('home')}/>
        <NavButton icon="bolt" label="Modo Treino" active={view === 'train'} onClick={() => navigate('train')}/>
        <NavButton icon="history" label="Modo Histórico" active={view === 'history' || view === 'session'} onClick={() => navigate('history')}/>
        <NavButton icon="dumbbell" label="Os meus treinos" active={view === 'plans' || view === 'editor'} onClick={() => navigate('plans')}/>
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-quote">“O progresso constrói-se<br/>uma série de cada vez.”</div><div className="sidebar-footer">myGym · versão inicial</div></div>
    </aside>
    <div className="main-column">
      <header className="topbar"><button className="brand d-lg-none" onClick={() => navigate('home')}><span className="brand-mark"><Icon name="dumbbell" size={20}/></span><span>my<span>Gym</span></span></button><div className="topbar-right"><span className="topbar-date"><Icon name="calendar" size={16}/> {fmtDate(new Date())}</span><span className="avatar">MG</span></div></header>
      <main className="content container-fluid">
        {error && <div className="alert app-alert d-flex justify-content-between align-items-start" role="alert"><span>{error}</span><button className="icon-button" onClick={() => setError('')} aria-label="Fechar">×</button></div>}
        {loading ? <div className="loading">A preparar o teu espaço de treino…</div> : <>
          {view === 'home' && <Home plans={plans} completed={completed} totalVolume={totalVolume} active={active} onNavigate={navigate}/>}
          {view === 'plans' && <Plans plans={plans} busy={busy} onCreate={() => { setEditing(null); navigate('editor') }} onEdit={(plan) => { setEditing(plan); navigate('editor') }} onDelete={deletePlan} onStart={startPlan}/>}
          {view === 'editor' && <PlanEditor plan={editing} busy={busy} onSave={savePlan} onCancel={() => navigate('plans')}/>}
          {view === 'train' && (active ? <Training session={active} busy={busy} onAdd={addSet} onRemove={removeSet} onComplete={complete}/> : <StartTraining plans={plans} onStart={startPlan} onCreate={() => { setEditing(null); navigate('editor') }} busy={busy}/>)}
          {view === 'history' && <History sessions={sessions} onOpen={openSession} onTrain={() => navigate('train')}/>}
          {view === 'session' && session && <SessionDetail session={session} onBack={() => navigate('history')} onTrain={() => navigate('train')}/>}
        </>}
      </main>
    </div>
    <nav className="mobile-nav d-lg-none" aria-label="Navegação principal"><NavButton icon="grid" label="Início" active={view === 'home'} onClick={() => navigate('home')}/><NavButton icon="bolt" label="Treino" active={view === 'train'} onClick={() => navigate('train')}/><NavButton icon="history" label="Histórico" active={view === 'history' || view === 'session'} onClick={() => navigate('history')}/><NavButton icon="dumbbell" label="Planos" active={view === 'plans' || view === 'editor'} onClick={() => navigate('plans')}/></nav>
  </div>
}

function NavButton({ icon, label, active, onClick }) { return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}><Icon name={icon} size={19}/><span>{label}</span></button> }
function Eyebrow({ children }) { return <div className="eyebrow">{children}</div> }
function PageHeading({ eyebrow, title, subtitle, action }) { return <div className="page-heading"><div><Eyebrow>{eyebrow}</Eyebrow><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div> }
function Empty({ icon, title, text, action }) { return <div className="empty-state"><div className="empty-icon"><Icon name={icon} size={28}/></div><h3>{title}</h3><p>{text}</p>{action}</div> }

function Home({ plans, completed, totalVolume, active, onNavigate }) {
  const latest = completed[0]
  return <>
    <div className="welcome"><Eyebrow>O TEU ESPAÇO DE EVOLUÇÃO</Eyebrow><h1>Faz de hoje um<br/><em>dia mais forte.</em></h1><p>Planeia, regista e acompanha cada passo. O teu próximo treino começa aqui.</p><div className="welcome-actions"><button className="btn btn-accent" onClick={() => onNavigate('train')}><Icon name="bolt" size={18}/>{active ? 'Continuar treino' : 'Começar treino'}<Icon name="arrow" size={18}/></button><button className="btn btn-ghost" onClick={() => onNavigate('history')}>Ver histórico <Icon name="arrow" size={18}/></button></div><div className="welcome-art"><div className="art-ring ring-1"/><div className="art-ring ring-2"/><Icon name="dumbbell" size={92}/></div></div>
    <div className="section-label">O TEU PERCURSO <span>ATÉ AGORA</span></div>
    <div className="row g-3 stat-grid"><div className="col-6 col-xl-4"><Stat icon="check" number={completed.length} label="Treinos concluídos" color="lime"/></div><div className="col-6 col-xl-4"><Stat icon="dumbbell" number={plans.length} label="Planos criados" color="purple"/></div><div className="col-12 col-xl-4"><Stat icon="chart" number={`${fmtNumber(totalVolume)} kg`} label="Volume acumulado" color="orange"/></div></div>
    <div className="row g-4 home-lower"><div className="col-lg-7"><div className="panel h-100"><div className="panel-heading"><div><Eyebrow>ESCOLHE O TEU CAMINHO</Eyebrow><h2>Como queres continuar?</h2></div></div><button className="mode-card" onClick={() => onNavigate('train')}><span className="mode-icon lime"><Icon name="bolt" size={23}/></span><span><strong>Modo Treino</strong><small>Segue o plano, regista séries e supera o último treino.</small></span><Icon name="arrow" size={20}/></button><button className="mode-card" onClick={() => onNavigate('history')}><span className="mode-icon purple"><Icon name="history" size={23}/></span><span><strong>Modo Histórico</strong><small>Revê pesos, repetições e o teu progresso.</small></span><Icon name="arrow" size={20}/></button></div></div><div className="col-lg-5"><div className="panel h-100 last-panel"><Eyebrow>ÚLTIMA SESSÃO</Eyebrow>{latest ? <><h2>{latest.planName}</h2><p className="muted">{fmtDate(latest.completedAt)} · {fmtTime(latest.completedAt)}</p><div className="last-metrics"><span><strong>{latest.setCount}</strong> séries de trabalho</span><span><strong>{fmtNumber(latest.volumeKg)} kg</strong> de volume</span></div><button className="text-link" onClick={() => onNavigate('history')}>Explorar histórico <Icon name="arrow" size={17}/></button></> : <><h2>O primeiro registo espera por ti.</h2><p className="muted">Cria um plano e começa a construir o teu histórico.</p><button className="text-link" onClick={() => onNavigate('plans')}>Criar plano <Icon name="arrow" size={17}/></button></>}</div></div></div>
  </>
}
function Stat({ icon, number, label, color }) { return <div className="stat-card"><div className={`stat-icon ${color}`}><Icon name={icon} size={21}/></div><strong>{number}</strong><span>{label}</span></div> }

function Plans({ plans, busy, onCreate, onEdit, onDelete, onStart }) { return <><PageHeading eyebrow="A TUA ROTINA" title="Os meus treinos" subtitle="Cria os teus planos e decide o que treinar hoje." action={<button className="btn btn-accent" onClick={onCreate}><Icon name="plus" size={18}/> Criar treino</button>}/>{plans.length ? <div className="row g-3">{plans.map((plan) => <div className="col-md-6 col-xl-4" key={plan.id}><div className="plan-card"><div className="plan-top"><span className="plan-symbol"><Icon name="dumbbell" size={25}/></span><span className="plan-count">{plan.exercises.length} exercícios</span></div><h3>{plan.name}</h3><p>{plan.description || 'Um plano à tua medida.'}</p><div className="exercise-preview">{plan.exercises.slice(0, 3).map((e) => <div key={e.id}><span className="mini-dot"/>{e.name}<span>{e.targetSets} × {e.targetReps}</span></div>)}{plan.exercises.length > 3 && <small>+ {plan.exercises.length - 3} exercícios</small>}</div><div className="plan-actions"><button className="btn btn-accent btn-sm" disabled={busy} onClick={() => onStart(plan)}>Iniciar treino <Icon name="arrow" size={16}/></button><button className="icon-button" title="Editar" aria-label={`Editar ${plan.name}`} onClick={() => onEdit(plan)}><Icon name="edit" size={18}/></button><button className="icon-button" title="Eliminar" aria-label={`Eliminar ${plan.name}`} onClick={() => onDelete(plan)}><Icon name="trash" size={18}/></button></div></div></div>)}</div> : <Empty icon="dumbbell" title="Ainda não tens treinos criados" text="Começa por criar o teu primeiro plano com os exercícios, séries e repetições que queres fazer." action={<button className="btn btn-accent" onClick={onCreate}><Icon name="plus" size={18}/> Criar o primeiro treino</button>}/>}</> }

function PlanEditor({ plan, busy, onSave, onCancel }) {
  const [name, setName] = useState(plan?.name || '')
  const [description, setDescription] = useState(plan?.description || '')
  const [exercises, setExercises] = useState(plan?.exercises?.map(({ name, targetSets, targetReps, restSeconds }) => ({ name, targetSets, targetReps, restSeconds })) || [createExercise()])
  const [localError, setLocalError] = useState('')
  function update(index, field, value) { setExercises(exercises.map((item, i) => i === index ? { ...item, [field]: value } : item)) }
  function submit(event) {
    event.preventDefault()
    if (!name.trim() || exercises.some((e) => !e.name.trim())) { setLocalError('Dá um nome ao treino e a todos os exercícios.'); return }
    setLocalError('')
    onSave({ name: name.trim(), description: description.trim(), exercises: exercises.map((e) => ({ name: e.name.trim(), targetSets: Number(e.targetSets), targetReps: Number(e.targetReps), restSeconds: Number(e.restSeconds) })) })
  }
  return <><PageHeading eyebrow="CONSTRÓI A TUA ROTINA" title={plan ? 'Editar treino' : 'Novo treino'} subtitle="Define a ordem, o objetivo de séries e o descanso de cada exercício."/><form onSubmit={submit} className="editor-layout"><div className="panel form-panel"><div className="form-section-title"><span className="number-badge">01</span><div><h2>Dados do treino</h2><p>Começa com um nome que reconheças facilmente.</p></div></div><div className="row g-3"><div className="col-md-7"><label className="form-label">Nome do treino</label><input className="form-control" value={name} maxLength="100" onChange={(e) => setName(e.target.value)} placeholder="Ex.: Treino Peito" required/></div><div className="col-12"><label className="form-label">Descrição <span className="optional">opcional</span></label><textarea className="form-control" rows="2" maxLength="500" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Peito e tríceps · foco em força"/></div></div></div><div className="panel form-panel"><div className="form-section-title"><span className="number-badge">02</span><div><h2>Exercícios</h2><p>Arrasta mentalmente a sequência: o primeiro aparece primeiro no treino.</p></div></div><div className="exercise-form-list">{exercises.map((exercise, index) => <div className="exercise-form" key={index}><div className="exercise-form-header"><span>EXERCÍCIO {String(index + 1).padStart(2, '0')}</span><button type="button" className="icon-button" disabled={exercises.length === 1} onClick={() => setExercises(exercises.filter((_, i) => i !== index))} aria-label={`Remover exercício ${index + 1}`}><Icon name="trash" size={17}/></button></div><div className="row g-3"><div className="col-12"><label className="form-label">Nome do exercício</label><input className="form-control" value={exercise.name} maxLength="120" onChange={(e) => update(index, 'name', e.target.value)} placeholder="Ex.: Supino com barra" required/></div><div className="col-4"><label className="form-label">Séries</label><input className="form-control" type="number" min="1" max="20" value={exercise.targetSets} onChange={(e) => update(index, 'targetSets', e.target.value)} required/></div><div className="col-4"><label className="form-label">Reps</label><input className="form-control" type="number" min="1" max="100" value={exercise.targetReps} onChange={(e) => update(index, 'targetReps', e.target.value)} required/></div><div className="col-4"><label className="form-label">Descanso (s)</label><input className="form-control" type="number" min="0" max="600" value={exercise.restSeconds} onChange={(e) => update(index, 'restSeconds', e.target.value)} required/></div></div></div>)}</div><button type="button" className="add-exercise" onClick={() => setExercises([...exercises, createExercise()])}><Icon name="plus" size={18}/> Adicionar exercício</button></div>{localError && <div className="alert app-alert">{localError}</div>}<div className="editor-actions"><button className="btn btn-ghost" type="button" onClick={onCancel}>Cancelar</button><button className="btn btn-accent" disabled={busy} type="submit">{busy ? 'A guardar…' : 'Guardar treino'} <Icon name="check" size={18}/></button></div></form></>
}

function StartTraining({ plans, onStart, onCreate, busy }) { return <><PageHeading eyebrow="MODO TREINO" title="Vamos treinar." subtitle="Escolhe o plano que vais seguir hoje. Cada série fica guardada no teu histórico."/>{plans.length ? <div className="row g-3">{plans.map((plan) => <div className="col-md-6 col-xl-4" key={plan.id}><button className="start-card" disabled={busy} onClick={() => onStart(plan)}><span className="start-icon"><Icon name="dumbbell" size={29}/></span><span className="start-title">{plan.name}</span><span className="muted">{plan.exercises.length} exercícios · {plan.exercises.reduce((n, e) => n + e.targetSets, 0)} séries planeadas</span><span className="start-bottom">Começar agora <Icon name="arrow" size={18}/></span></button></div>)}</div> : <Empty icon="bolt" title="Começa com um plano" text="Cria um treino para receberes a sequência de exercícios e registares o progresso." action={<button className="btn btn-accent" onClick={onCreate}>Criar treino <Icon name="arrow" size={18}/></button>}/>}</> }

function Training({ session, busy, onAdd, onRemove, onComplete }) {
  const [selected, setSelected] = useState(0)
  const [notes, setNotes] = useState('')
  const [finishing, setFinishing] = useState(false)
  const exercise = session.exercises[Math.min(selected, session.exercises.length - 1)]
  const logged = session.exercises.reduce((n, e) => n + workSets(e).length, 0)
  const planned = session.exercises.reduce((n, e) => n + e.targetSets, 0)
  return <><PageHeading eyebrow="MODO TREINO · SESSÃO EM CURSO" title={session.planName} subtitle={`Iniciado em ${fmtDate(session.startedAt)} às ${fmtTime(session.startedAt)}`} action={<span className="live-badge"><span/> EM CURSO</span>}/><div className="progress-panel"><div className="progress-copy"><span>Progresso do treino</span><strong>{logged} / {planned} séries de trabalho</strong></div><div className="progress"><div className="progress-bar" style={{ width: `${Math.min(100, planned ? logged / planned * 100 : 0)}%` }}/></div></div><div className="training-grid"><div className="exercise-sidebar panel"><Eyebrow>SEQUÊNCIA DE HOJE</Eyebrow>{session.exercises.map((item, index) => <button className={`exercise-step ${index === selected ? 'selected' : ''}`} key={item.id} onClick={() => setSelected(index)}><span className="step-number">{workSets(item).length >= item.targetSets ? <Icon name="check" size={16}/> : String(index + 1).padStart(2, '0')}</span><span><strong>{item.name}</strong><small>{workSets(item).length}/{item.targetSets} séries · {item.targetReps} reps</small></span></button>)}<button className="btn btn-ghost w-100 mt-3" onClick={() => setFinishing(true)}>Terminar treino <Icon name="arrow" size={17}/></button></div><div className="training-main"><ExerciseTracker key={exercise.id} exercise={exercise} busy={busy} onAdd={(body) => onAdd(exercise.id, body)} onRemove={(setId) => onRemove(exercise.id, setId)}/><div className="exercise-navigation"><button className="btn btn-ghost" disabled={selected === 0} onClick={() => setSelected(selected - 1)}><Icon name="back" size={17}/> Anterior</button><button className="btn btn-accent" onClick={() => selected < session.exercises.length - 1 ? setSelected(selected + 1) : setFinishing(true)}>{selected < session.exercises.length - 1 ? 'Próximo exercício' : 'Terminar treino'} <Icon name="arrow" size={17}/></button></div></div></div>{finishing && <div className="modal-backdrop-custom" role="dialog" aria-modal="true" aria-label="Terminar treino"><div className="finish-modal panel"><div className="mode-icon lime"><Icon name="check" size={25}/></div><h2>Treino concluído?</h2><p>As tuas séries vão ficar disponíveis no histórico e serão usadas para sugerir a próxima carga.</p><label className="form-label">Notas da sessão <span className="optional">opcional</span></label><textarea className="form-control" rows="3" maxLength="1000" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Como te sentiste? Algo a ajustar para a próxima vez?"/><div className="d-flex gap-2 justify-content-end mt-4"><button className="btn btn-ghost" onClick={() => setFinishing(false)}>Continuar treino</button><button className="btn btn-accent" disabled={busy} onClick={() => onComplete(notes)}>Concluir sessão</button></div></div></div>}</>
}

function ExerciseTracker({ exercise, busy, onAdd, onRemove }) {
  const previousWork = exercise.previousSets.filter((set) => set.kind === 'WORK')
  const [kind, setKind] = useState('WORK')
  const [weight, setWeight] = useState(exercise.recommendation.workWeightKg ?? '')
  const [reps, setReps] = useState(exercise.targetReps)
  const [rpe, setRpe] = useState('')
  const [localError, setLocalError] = useState('')
  function chooseKind(next) { setKind(next); setWeight(next === 'WARMUP' ? (exercise.recommendation.warmupWeightKg ?? '') : (exercise.recommendation.workWeightKg ?? '')) }
  function submit(event) {
    event.preventDefault()
    if (weight === '' || Number(weight) < 0 || Number(reps) < 1) { setLocalError('Indica um peso e um número de repetições válidos.'); return }
    setLocalError('')
    onAdd({ kind, weightKg: Number(weight), reps: Number(reps), rpe: rpe === '' ? null : Number(rpe) })
  }
  return <><div className="panel exercise-hero"><div className="exercise-hero-top"><span className="pill">EXERCÍCIO {String(exercise.position + 1).padStart(2, '0')}</span><span className="muted">{exercise.restSeconds}s de descanso</span></div><h2>{exercise.name}</h2><div className="target-line"><span><Icon name="target" size={18}/> {exercise.targetSets} séries × {exercise.targetReps} reps</span><span>{workSets(exercise).length} séries feitas</span></div></div><div className="recommendation"><span className="rec-icon"><Icon name="bolt" size={20}/></span><div><span className="rec-label">SUGESTÃO PARA HOJE</span><strong>{exercise.recommendation.workWeightKg != null ? `${fmtNumber(exercise.recommendation.workWeightKg)} kg nas séries de trabalho` : 'Encontra a tua carga inicial'}</strong><p>{exercise.recommendation.reason}{exercise.recommendation.warmupWeightKg != null && ` Aquece primeiro com cerca de ${fmtNumber(exercise.recommendation.warmupWeightKg)} kg.`}</p></div></div><div className="panel sets-panel"><div className="panel-heading"><div><Eyebrow>REGISTO AO VIVO</Eyebrow><h2>Séries deste treino</h2></div></div>{exercise.sets.length ? <div className="table-responsive"><table className="table app-table"><thead><tr><th>SÉRIE</th><th>TIPO</th><th>PESO</th><th>REPS</th><th>RPE</th><th></th></tr></thead><tbody>{exercise.sets.map((set) => <tr key={set.id}><td>#{set.setNumber}</td><td><span className={`set-kind ${set.kind === 'WARMUP' ? 'warmup' : ''}`}>{set.kind === 'WARMUP' ? 'Aquecimento' : 'Trabalho'}</span></td><td><strong>{fmtNumber(set.weightKg)} kg</strong></td><td>{set.reps}</td><td>{set.rpe ?? '—'}</td><td><button className="icon-button" disabled={busy} onClick={() => onRemove(set.id)} title="Remover série" aria-label={`Remover série ${set.setNumber}`}><Icon name="trash" size={16}/></button></td></tr>)}</tbody></table></div> : <p className="muted mb-0">Ainda sem séries. Começa pelo aquecimento ou regista já uma série de trabalho.</p>}<form className="set-form" onSubmit={submit}><div className="set-toggle"><button type="button" className={kind === 'WARMUP' ? 'active' : ''} onClick={() => chooseKind('WARMUP')}>Aquecimento</button><button type="button" className={kind === 'WORK' ? 'active' : ''} onClick={() => chooseKind('WORK')}>Série de trabalho</button></div><div className="row g-2 align-items-end"><div className="col-6 col-md-3"><label className="form-label">Peso (kg)</label><input className="form-control" type="number" min="0" max="2000" step="0.25" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" required/></div><div className="col-6 col-md-3"><label className="form-label">Repetições</label><input className="form-control" type="number" min="1" max="100" value={reps} onChange={(e) => setReps(e.target.value)} required/></div><div className="col-6 col-md-2"><label className="form-label">RPE <span className="optional">opcional</span></label><input className="form-control" type="number" min="1" max="10" step="0.5" value={rpe} onChange={(e) => setRpe(e.target.value)} placeholder="—"/></div><div className="col-6 col-md-4"><button className="btn btn-accent w-100" type="submit" disabled={busy}><Icon name="plus" size={17}/> Guardar série</button></div></div>{localError && <p className="field-error">{localError}</p>}</form></div><div className="panel previous-panel"><div className="panel-heading"><div><Eyebrow>COMPARAÇÃO</Eyebrow><h2>Último treino deste exercício</h2></div><Icon name="history" size={22}/></div>{previousWork.length ? <div className="table-responsive"><table className="table app-table"><thead><tr><th>SÉRIE</th><th>PESO USADO</th><th>REPETIÇÕES</th><th>RPE</th></tr></thead><tbody>{previousWork.map((set) => <tr key={set.id}><td>#{set.setNumber}</td><td><strong>{fmtNumber(set.weightKg)} kg</strong></td><td>{set.reps} reps</td><td>{set.rpe ?? '—'}</td></tr>)}</tbody></table></div> : <p className="muted mb-0">Ainda não há um treino anterior concluído deste exercício neste plano.</p>}</div></>
}

function History({ sessions, onOpen, onTrain }) { const completed = sessions.filter((s) => s.completedAt); return <><PageHeading eyebrow="MODO HISTÓRICO" title="Cada treino conta." subtitle="Consulta as tuas sessões e vê como o trabalho se transforma em progresso."/><div className="history-summary"><div><span>SESSÕES CONCLUÍDAS</span><strong>{completed.length}</strong></div><div><span>SÉRIES DE TRABALHO</span><strong>{completed.reduce((n, s) => n + s.setCount, 0)}</strong></div><div><span>VOLUME TOTAL</span><strong>{fmtNumber(completed.reduce((n, s) => n + Number(s.volumeKg), 0))} <small>kg</small></strong></div></div>{sessions.length ? <div className="panel history-panel"><div className="panel-heading"><div><Eyebrow>DIÁRIO DE TREINO</Eyebrow><h2>Todas as sessões</h2></div></div><div className="history-list">{sessions.map((item) => <button className="history-row" onClick={() => onOpen(item.id)} key={item.id}><span className="history-date"><strong>{new Date(item.startedAt).getDate()}</strong><small>{new Intl.DateTimeFormat('pt-PT', { month: 'short' }).format(new Date(item.startedAt))}</small></span><span className="history-name"><strong>{item.planName}</strong><small>{item.completedAt ? `${fmtTime(item.startedAt)} · ${item.setCount} séries de trabalho` : 'Sessão em curso'}</small></span><span className="history-volume">{fmtNumber(item.volumeKg)} kg</span><Icon name="arrow" size={18}/></button>)}</div></div> : <Empty icon="history" title="A tua história começa no primeiro treino" text="Quando terminares uma sessão, os pesos e as repetições aparecem aqui." action={<button className="btn btn-accent" onClick={onTrain}>Ir para Modo Treino <Icon name="arrow" size={18}/></button>}/>}</> }

function SessionDetail({ session, onBack, onTrain }) { const volume = session.exercises.flatMap((e) => workSets(e)).reduce((n, s) => n + Number(s.weightKg) * s.reps, 0); return <><button className="back-link" onClick={onBack}><Icon name="back" size={18}/> Voltar ao histórico</button><PageHeading eyebrow={session.completedAt ? 'SESSÃO CONCLUÍDA' : 'SESSÃO EM CURSO'} title={session.planName} subtitle={`${fmtDate(session.startedAt)} · ${fmtTime(session.startedAt)}${session.completedAt ? ` — ${fmtTime(session.completedAt)}` : ''}`} action={!session.completedAt && <button className="btn btn-accent" onClick={onTrain}>Continuar treino <Icon name="arrow" size={17}/></button>}/><div className="detail-stats"><Stat icon="dumbbell" number={session.exercises.length} label="Exercícios" color="lime"/><Stat icon="check" number={session.exercises.reduce((n, e) => n + workSets(e).length, 0)} label="Séries de trabalho" color="purple"/><Stat icon="chart" number={`${fmtNumber(volume)} kg`} label="Volume" color="orange"/></div>{session.notes && <div className="panel notes-panel"><Eyebrow>NOTAS DA SESSÃO</Eyebrow><p>{session.notes}</p></div>}{session.exercises.map((exercise) => <div className="panel detail-exercise" key={exercise.id}><div className="panel-heading"><div><Eyebrow>EXERCÍCIO {String(exercise.position + 1).padStart(2, '0')}</Eyebrow><h2>{exercise.name}</h2></div><span className="muted">Objetivo: {exercise.targetSets} × {exercise.targetReps}</span></div>{exercise.sets.length ? <div className="table-responsive"><table className="table app-table"><thead><tr><th>SÉRIE</th><th>TIPO</th><th>PESO</th><th>REPS</th><th>RPE</th></tr></thead><tbody>{exercise.sets.map((set) => <tr key={set.id}><td>#{set.setNumber}</td><td>{set.kind === 'WARMUP' ? 'Aquecimento' : 'Trabalho'}</td><td><strong>{fmtNumber(set.weightKg)} kg</strong></td><td>{set.reps}</td><td>{set.rpe ?? '—'}</td></tr>)}</tbody></table></div> : <p className="muted mb-0">Nenhuma série registada.</p>}</div>)}</> }

createRoot(document.getElementById('root')).render(<App />)
