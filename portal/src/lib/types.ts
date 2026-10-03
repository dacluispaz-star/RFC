// Tipos de la copia en la nube que sube la app (tabla `user_backups.payload`).
// Copia reducida de los tipos de la app (../src/types, stores): solo lo que
// usa el portal. Si la app cambia el formato, actualizar aquí.

export type Gender = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced';
export type TrainingLocation = 'gym' | 'home' | 'outdoors' | 'mixed';

export interface Client {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  age?: number;
  gender?: Gender;
  phone?: string;
  height_cm?: number;
  weight_kg?: number;
  target_weight_kg?: number;
  body_fat_pct?: number;
  muscle_mass_kg?: number;
  visceral_fat_level?: number;
  bmr_kcal?: number;
  activity_level?: ActivityLevel;
  occupation?: string;
  goal?: string;
  medical_conditions?: string;
  injuries?: string;
  allergies?: string;
  medications?: string;
  surgery_history?: string;
  training_experience?: TrainingExperience;
  training_days_per_week?: number;
  training_location?: TrainingLocation;
  notes?: string;
  emergency_contact?: string;
  emergency_phone?: string;
}

export interface Measurement {
  id: string;
  client_id: string;
  measured_at: string;
  weight_kg?: number;
  body_fat_pct?: number;
  lean_mass_kg?: number;
  fat_mass_kg?: number;
  muscle_mass_kg?: number;
  visceral_fat_level?: number;
  bmr_kcal?: number;
  chest_cm?: number;
  waist_cm?: number;
  hips_cm?: number;
  notes?: string;
  [key: string]: unknown;
}

export interface SessionSummary {
  id: string;
  client_id: string;
  date: string;
  duration_minutes: number;
  total_sets: number;
  total_volume: number;
  avg_rpe: number;
  prs_achieved: number;
  exercises?: { id: string; name: string; muscle_group: string; sets: number; total_volume: number }[];
}

export interface FoodEntry {
  id: string;
  client_id: string;
  date: string;
  meal: string;
  food_name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealPlanItem {
  id: string;
  food_id: string;
  food_name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealPlanMeal {
  name: string;
  items: MealPlanItem[];
}

export interface MealPlanDay {
  name: string;
  meals: MealPlanMeal[];
}

/** Mismo formato que la app (src/stores/nutritionStore.ts). */
export interface MealPlan {
  id: string;
  name: string;
  client_id?: string;
  days: MealPlanDay[];
}

/** Marca usada en el PDF (tabla `portal_settings`). */
export interface Branding {
  logoUrl: string | null;
  contactInfo: string;
}

export interface CheckIn {
  id: string;
  client_id: string;
  date: string;
  mood_rating: number;
  energy_rating: number;
  sleep_rating: number;
  stress_rating: number;
  current_weight: number | null;
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  e1rm: number;
  date: string;
}

export interface ServicePeriod {
  id: string;
  client_id: string;
  plan_name: string;
  start_date: string;
  end_date: string;
  price?: number;
  paid: boolean;
  notes?: string;
  created_at: string;
}

export interface BackupPayload {
  version: number;
  clients?: Client[];
  measurements?: Measurement[];
  sessions?: SessionSummary[];
  nutrition?: {
    entries?: FoodEntry[];
    targetsByClient?: Record<string, NutritionTargets>;
    mealPlans?: MealPlan[];
    assignedPlanIds?: Record<string, string>;
  };
  checkins?: CheckIn[];
  prs?: Record<string, Record<string, PersonalRecord>>;
  periods?: ServicePeriod[];
  [key: string]: unknown;
}

export interface PortalChange {
  id: string;
  entity: 'client' | 'measurement' | 'meal_plan';
  op: 'upsert' | 'delete';
  record_id: string;
  record: Record<string, unknown> | null;
  created_at: string;
}

/** Datos ya normalizados que consume la interfaz. */
export interface PortalData {
  clients: Client[];
  measurements: Measurement[];
  sessions: SessionSummary[];
  foodEntries: FoodEntry[];
  targetsByClient: Record<string, NutritionTargets>;
  mealPlans: MealPlan[];
  assignedPlanIds: Record<string, string>;
  checkins: CheckIn[];
  prs: Record<string, Record<string, PersonalRecord>>;
  periods: ServicePeriod[];
  /** Fecha de la última copia subida por la app (null si nunca). */
  backupUpdatedAt: string | null;
  /** Cambios del portal que el teléfono aún no ha incorporado. */
  pendingCount: number;
}
