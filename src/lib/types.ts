// Shared domain types — mirror the Supabase schema in supabase/schema.sql.

export type ContactStatus = 'da_valutare' | 'da_fare' | 'fatto' | 'non_fare';
export type GenderGuess = 'male' | 'female' | 'unknown';
// Stato della relazione (warm-up). L'utente lo avanza a mano.
// likato/commentato = fasi PRIMA dell'invito per scaldare il contatto.
export type RelStatus =
  | 'nessuno'
  | 'likato'
  | 'commentato'
  | 'invitato'
  | 'connesso'
  | 'messaggiato'
  | 'risposto'
  | 'in_conversazione'
  | 'freddo';

export interface Contact {
  id: string;
  linkedin_url: string;
  name: string | null;
  headline: string | null;
  company: string | null;
  location: string | null;
  photo_url: string | null;
  raw: Record<string, unknown> | null;
  score: number | null;
  gender_guess: GenderGuess | null;
  reason: string | null;
  badges: string[] | null;
  category: string | null;
  status: ContactStatus;
  message: string | null;
  rel_status: RelStatus;
  interacted_at: string | null;
  invited_at: string | null;
  connected_at: string | null;
  replied_at: string | null;
  last_touch_at: string | null;
  notes: string | null;
  prev_score: number | null;
  revalued_at: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  linkedin_url: string;
  title: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
  raw: Record<string, unknown> | null;
  score: number | null;
  reason: string | null;
  status: ContactStatus;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  created_at: string;
}

// Post LinkedIn recente su cui commentare (tab "Commenta"). Mirror di comment_posts.
export interface CommentPost {
  id: string;
  post_url: string;
  author_url: string | null;
  author_name: string | null;
  author_headline: string | null;
  author_photo: string | null;
  content: string | null;
  posted_at: string | null;
  likes: number | null;
  comments: number | null;
  raw: Record<string, unknown> | null;
  score: number | null;
  reason: string | null;
  draft_comment: string | null; // generato on-demand, poi in cache
  commented_at: string | null; // segnato quando si commenta a mano (tracker)
  created_at: string;
}

export interface UserPreferences {
  keywords: string[];
  cities: string[];
  exclusions: string[];
  // gender rule + answers to the 5 key questions live here too
  gender_rule: string;
  goal: string;
  ideal_contact: string;
  target_sectors: string;
  offer: string;
  notes?: string;
  // Fascia follower target. In modalità Full → filtro NUMERICO (taglia fuori dalla
  // fascia). In modalità Short (follower=null) → istruzione SEMANTICA a Gemini, che
  // preferisce profili con quel livello di visibilità. Funziona in entrambi i casi.
  // null/assente = nessun limite su quel lato.
  min_followers?: number | null;
  max_followers?: number | null;
  // preset scelto dall'utente (solo per la UI; min/max sopra sono la verità).
  reach_preset?: 'modesto' | 'bilanciato' | 'ambizioso' | 'custom';
  // Giorni di "scaldata" prima dell'invito: dopo aver likato/commentato, quanti
  // giorni aspettare prima che la card suggerisca "pronto per invitare". Default 2.
  warmup_days?: number;
  // stato interno paginazione: ultima pagina di ricerca profili usata.
  _lastProfilePage?: number;
}

export interface UserProfile {
  id: string;
  linkedin_url: string | null;
  raw_scrape: Record<string, unknown> | null;
  summary: string | null;
  preferences: UserPreferences | null;
  updated_at: string;
}

export interface OutreachLog {
  id: string;
  contact_id: string;
  sent_at: string;
}

// Shape returned by Gemini for each evaluated contact in a batch.
export interface ContactEvaluation {
  index: number;
  score: number;
  gender_guess: GenderGuess;
  reason: string;
  badges: string[];
  category: string;
}

export interface JobEvaluation {
  index: number;
  score: number;
  reason: string;
}

// Shape returned by Gemini for each evaluated post in a batch (tab "Commenta").
export interface PostEvaluation {
  index: number;
  score: number; // rilevanza vs profilo utente + qualità del post per farsi notare
  reason: string; // una riga: perché vale (o no) la pena commentarlo
}
