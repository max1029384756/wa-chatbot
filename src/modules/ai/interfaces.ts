export interface Business {
  name: string;
  phone: string;
}

export interface BusinessContext {
  accommodation: Business;
  sports_club: Business;
  surf_school: Business;
}

export enum HumanRequest {
  YES = 'yes',
  NO = 'no',
}
