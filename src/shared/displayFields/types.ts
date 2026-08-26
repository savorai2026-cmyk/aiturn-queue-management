export type DisplayScope =
  | 'clients'
  | 'appointments'
  | 'services'
  | 'business'
  | 'statuses';

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
  statuses?: ScopePreferences;
}

export interface DetailRow {
  key: string;
  label: string;
  value: string;
  dir?: 'ltr';
}
