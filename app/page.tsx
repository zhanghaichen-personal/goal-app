"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Goal, Task } from "@/lib/types";
import { quadrant } from "@/lib/urgency";

const LOCAL_KEY = "goal-matrix-cache-v1";

type Cache = {
  goal: Goal | null;
  tasks: Task[];
  completedGoals: Goal[];
};

const starterGoal: Goal = {
  id: cryptoSafeId(),
  title: "完成我的主要目标",
  description: "把每天的任务和真正重要的目标连接起来。",
  target_date: null,
  is_long_term: true,
  is_completed: false,
  completed_at: null,
};

function cryptoSafeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function readCache(): Cache {
  if (typeof window === "undefined") return { goal: null, tasks: [], completedGoals: [] };
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return { goal: starterGoal, tasks: [], completedGoals: [] };
    return JSON.parse(raw);
  } catch {
    return { goal: starterGoal, tasks: [], completedGoals: [] };
  }
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [cache, setCache] = useState<Cache>({ goal: null, tasks: [], completedGoals: [] });
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [syncState, setSyncState] = useState("本地保存");
  const [showCompletedGoals, setShowCompletedGoals] = useState(false);
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [showTaskEditor, setShowTaskEditor] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    setCache(readCache());
    setLoaded(true);
    supabase.auth.getUser().then(({ data }) => {
      setSessionEmail(data.user?.email ?? null);
      if (data.user) syncFromCloud(data.user.id);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null);
      if (session?.user) syncFromCloud(session.user.id);
    });
    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(cache));
  }, [cache, loaded]);

  async function syncFromCloud(userId: string) {
    setSyncState("正在同步…");
    const [{ data: goals }, { data: tasks }, { data: doneGoals }] = await Promise.all([
      supabase.from("goals").select("*").eq("user_id", userId).eq("is_completed", false).order("created_at", { ascending: true }).limit(1),
      supabase.from("tasks").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
      supabase.from("goals").select("*").eq("user_id", userId).eq("is_completed", true).order("completed_at", { ascending: false }),
    ]);
    setCache({
      goal: (goals?.[0] as Goal | undefined) ?? starterGoal,
      tasks: (tasks as Task[] | null) ?? [],
      completedGoals: (doneGoals as Goal[] | null) ?? [],
    });
    setSyncState("已同步");
  }

  async function pushGoal(goal: Goal) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    setSyncState("正在同步…");
    await supabase.from("goals").upsert({ ...goal, user_id: data.user.id });
    setSyncState("已同步");
  }

  async function pushTask(task: Task) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    setSyncState("正在同步…");
    await supabase.from("tasks").upsert({ ...task, user_id: data.user.id });
    setSyncState("已同步");
  }

  async function sendMagicLink() {
    if (!email.trim()) return;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    alert(error ? error.message : "登录链接已经发到你的邮箱。");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSessionEmail(null);
    setSyncState("本地保存");
  }

  function saveGoal(next: Goal) {
    setCache((c) => ({ ...c, goal: next }));
    pushGoal(next);
    setShowGoalEditor(false);
  }

  function saveTask(next: Task) {
    setCache((c) => {
      const exists = c.tasks.some((t) => t.id === next.id);
      return { ...c, tasks: exists ? c.tasks.map((t) => (t.id === next.id ? next : t)) : [...c.tasks, next] };
    });
    pushTask(next);
    setShowTaskEditor(false);
    setEditingTask(null);
  }

  async function toggleTaskDone(task: Task) {
    const next = {
      ...task,
      is_completed: !task.is_completed,
      completed_at: !task.is_completed ? new Date().toISOString() : null,
    };
    saveTask(next);
  }

  async function completeGoal() {
    if (!cache.goal) return;
    const finished = { ...cache.goal, is_completed: true, completed_at: new Date().toISOString() };
    const nextGoal: Goal = {
      id: cryptoSafeId(),
      title: "新的目标",
      description: "",
      target_date: null,
      is_long_term: false,
      is_completed: false,
      completed_at: null,
    };
    setCache((c) => ({
      goal: nextGoal,
      tasks: c.tasks.filter((t) => t.goal_id !== finished.id),
      completedGoals: [finished, ...c.completedGoals],
    }));
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from("goals").upsert({ ...finished, user_id: data.user.id });
      await supabase.from("tasks").delete().eq("goal_id", finished.id).eq("user_id", data.user.id);
      await supabase.from("goals").upsert({ ...nextGoal, user_id: data.user.id });
    }
    setShowGoalEditor(false);
  }

  const active = cache.tasks.filter((t) => !t.is_completed);
  const completed = cache.tasks.filter((t) => t.is_completed && t.goal_id === cache.goal?.id);

  const groups = {
    "important-now": active.filter((t) => quadrant(t) === "important-now"),
    "important-later": active.filter((t) => quadrant(t) === "important-later"),
    "other-now": active.filter((t) => quadrant(t) === "other-now"),
    "other-later": active.filter((t) => quadrant(t) === "other-later"),
  };

  if (!loaded) return <main className="shell">Loading…</main>;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="brand">GOAL MATRIX</div>
          <div className="sync">{sessionEmail ? `${syncState} · ${sessionEmail}` : "仅保存在此设备"}</div>
        </div>
        <button className="round" onClick={() => setShowGoalEditor(true)}>•••</button>
      </header>

      {!sessionEmail && (
        <section className="loginCard">
          <div>
            <strong>开启云端同步</strong>
            <p>输入邮箱，收到登录链接后即可跨设备恢复数据。</p>
          </div>
          <div className="loginRow">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="你的邮箱" type="email" />
            <button onClick={sendMagicLink}>发送链接</button>
          </div>
        </section>
      )}

      {sessionEmail && <button className="signout" onClick={signOut}>退出登录</button>}

      <button className="completedGoalsButton" onClick={() => setShowCompletedGoals(true)}>✓ 已完成目标</button>

      <section className="goalCard">
        <div className="eyebrow">CURRENT GOAL</div>
        <h1>{cache.goal?.title ?? "未设置目标"}</h1>
        <p>{cache.goal?.is_long_term ? "长期目标" : cache.goal?.target_date ? `目标日期 ${cache.goal.target_date}` : "未设置日期"}</p>
        {cache.goal?.description && <p>{cache.goal.description}</p>}
      </section>

      <section className="matrix">
        <Quadrant title="重要 · 现在" sub="Important + Urgent" tasks={groups["important-now"]} onOpen={openTask} />
        <Quadrant title="重要 · 稍后" sub="Important + Later" tasks={groups["important-later"]} onOpen={openTask} />
        <Quadrant title="其他 · 现在" sub="Urgent" tasks={groups["other-now"]} onOpen={openTask} />
        <Quadrant title="其他 · 稍后" sub="Later" tasks={groups["other-later"]} onOpen={openTask} />
      </section>

      <section className="completedSection">
        <div className="sectionTitle">✓ 已完成任务 <span>{completed.length}</span></div>
        <p className="muted">你已经为这个目标完成了这些事情</p>
        {completed.length === 0 ? <div className="empty">完成任务后会出现在这里</div> :
          completed.map((task) => (
            <button key={task.id} className="doneTask" onClick={() => toggleTaskDone(task)}>
              <b>✓</b><span><s>{task.title}</s><small>{task.completed_at ? new Date(task.completed_at).toLocaleString("zh-CN") : ""}</small></span>
            </button>
          ))
        }
      </section>

      <button className="fab" onClick={() => { setEditingTask(null); setShowTaskEditor(true); }}>＋ 新建任务</button>

      {showTaskEditor && (
        <TaskEditor
          task={editingTask}
          goalId={cache.goal?.id ?? ""}
          onClose={() => setShowTaskEditor(false)}
          onSave={saveTask}
        />
      )}

      {showGoalEditor && cache.goal && (
        <GoalEditor goal={cache.goal} onClose={() => setShowGoalEditor(false)} onSave={saveGoal} onComplete={completeGoal} />
      )}

      {showCompletedGoals && (
        <Modal title="已完成目标" onClose={() => setShowCompletedGoals(false)}>
          {cache.completedGoals.length === 0 ? <div className="empty">还没有已完成目标</div> :
            cache.completedGoals.map((g) => (
              <div className="historyGoal" key={g.id}>
                <strong>{g.title}</strong>
                <small>{g.completed_at ? `完成于 ${new Date(g.completed_at).toLocaleString("zh-CN")}` : ""}</small>
                {g.description && <p>{g.description}</p>}
              </div>
            ))
          }
        </Modal>
      )}
    </main>
  );

  function openTask(task: Task) {
    setEditingTask(task);
    setShowTaskEditor(true);
  }
}

function Quadrant({ title, sub, tasks, onOpen }: { title: string; sub: string; tasks: Task[]; onOpen: (t: Task) => void }) {
  return (
    <div className="quad">
      <h3>{title}</h3><div className="sub">{sub}</div>
      {tasks.length === 0 ? <div className="empty">暂无任务</div> :
        tasks.map((t) => <button className="task" key={t.id} onClick={() => onOpen(t)}><strong>{t.title}</strong><small>{t.is_long_term ? "长期" : t.deadline ? new Date(t.deadline).toLocaleString("zh-CN") : "无 Deadline"}</small></button>)}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="backdrop" onMouseDown={(e) => e.currentTarget === e.target && onClose()}>
      <section className="sheet">
        <div className="grabber" />
        <div className="sheetHead"><h2>{title}</h2><button onClick={onClose}>关闭</button></div>
        {children}
      </section>
    </div>
  );
}

function GoalEditor({ goal, onSave, onClose, onComplete }: { goal: Goal; onSave: (g: Goal) => void; onClose: () => void; onComplete: () => void }) {
  const [draft, setDraft] = useState(goal);
  return (
    <Modal title="编辑目标" onClose={onClose}>
      <Field label="目标名称"><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
      <Field label="长期目标"><label className="switchLine"><span>开启后可以不设置截止日期</span><input type="checkbox" checked={draft.is_long_term} onChange={(e) => setDraft({ ...draft, is_long_term: e.target.checked, target_date: e.target.checked ? null : draft.target_date })} /></label></Field>
      {!draft.is_long_term && <Field label="目标日期"><input type="date" value={draft.target_date ?? ""} onChange={(e) => setDraft({ ...draft, target_date: e.target.value || null })} /></Field>}
      <Field label="目标说明"><textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
      <div className="actions"><button onClick={onClose}>取消</button><button className="primary" onClick={() => onSave(draft)}>保存</button></div>
      <button className="danger" onClick={onComplete}>标记目标已完成</button>
    </Modal>
  );
}

function TaskEditor({ task, goalId, onSave, onClose }: { task: Task | null; goalId: string; onSave: (t: Task) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Task>(task ?? {
    id: cryptoSafeId(),
    goal_id: goalId,
    title: "",
    notes: "",
    is_important: true,
    deadline: null,
    urgent_before_days: 7,
    is_long_term: false,
    urgency_override: "auto",
    is_completed: false,
    completed_at: null,
  });

  return (
    <Modal title={task ? "编辑任务" : "新建任务"} onClose={onClose}>
      <Field label="任务名称"><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
      <Field label="Important"><label className="switchLine"><span>由你决定这件事是否重要</span><input type="checkbox" checked={draft.is_important} onChange={(e) => setDraft({ ...draft, is_important: e.target.checked })} /></label></Field>
      <Field label="长期任务"><label className="switchLine"><span>长期任务不会自动进入紧急区</span><input type="checkbox" checked={draft.is_long_term} onChange={(e) => setDraft({ ...draft, is_long_term: e.target.checked, deadline: e.target.checked ? null : draft.deadline })} /></label></Field>
      {!draft.is_long_term && <>
        <Field label="Deadline"><input type="datetime-local" value={draft.deadline?.slice(0,16) ?? ""} onChange={(e) => setDraft({ ...draft, deadline: e.target.value || null })} /></Field>
        <Field label="提前多久进入紧急">
          <select value={draft.urgent_before_days} onChange={(e) => setDraft({ ...draft, urgent_before_days: Number(e.target.value) })}>
            {[1,3,7,14,30].map((d) => <option key={d} value={d}>{d} 天</option>)}
          </select>
        </Field>
      </>}
      <Field label="紧急状态">
        <select value={draft.urgency_override} onChange={(e) => setDraft({ ...draft, urgency_override: e.target.value as Task["urgency_override"] })}>
          <option value="auto">自动</option><option value="urgent">强制紧急</option><option value="later">强制不紧急</option>
        </select>
      </Field>
      <Field label="备注"><textarea value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
      <div className="actions"><button onClick={onClose}>取消</button><button className="primary" onClick={() => draft.title.trim() && onSave(draft)}>保存</button></div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
