export type DisplayScope =
  | 'clients'
  | 'appointments'
  | 'services'
  | 'business'
  | 'businessConfig'
  | 'statuses'
  | 'logs'
  | 'usage';

export interface DisplayField {
  key: string;
  label: string;
  defaultVisible: boolean;
  dir?: 'ltr';
}

export interface ScopePreferences {
  visibleFields?: string[];
}

export interface UiPreferences {
  clients?: ScopePreferences;
  appointments?: ScopePreferences;
  services?: ScopePreferences;
  business?: ScopePreferences;
  businessConfig?: ScopePreferences;
  statuses?: ScopePreferences;
  logs?: ScopePreferences;
  usage?: ScopePreferences;
}

export interface DetailRow {
  key: string;
  label: string;
  value: string;
  dir?: 'ltr';
  audioUrl?: string;
}
