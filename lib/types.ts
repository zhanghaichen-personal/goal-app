export type Goal = {
  id: string;
  user_id?: string;
  title: string;
  description: string | null;
  target_date: string | null;
  is_long_term: boolean;
  is_completed: boolean;
  completed_at: string | null;
  created_at?: string;
};

export type Task = {
  id: string;
  user_id?: string;
  goal_id: string;
  title: string;
  notes: string | null;
  is_important: boolean;
  deadline: string | null;
  urgent_before_days: number;
  is_long_term: boolean;
  urgency_override: "auto" | "urgent" | "later";
  is_completed: boolean;
  completed_at: string | null;
  created_at?: string;
};
