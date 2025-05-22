// Interfaces para la API de clientes de Siigo
export interface SiigoCustomerFilterType {
  page?: number;
  pageSize?: number;
  identification?: string;
  branchOffice?: number;
  name?: string;
  active?: boolean;
  query?: string;
}

export interface SiigoIdType {
  code: string;
  name: string;
}

export interface SiigoFiscalResponsibilityType {
  code: string;
  name: string;
}

export interface SiigoCityType {
  country_code: string;
  country_name: string;
  state_code: string;
  state_name: string;
  city_code: string;
  city_name: string;
}

export interface SiigoAddressType {
  address: string;
  city: SiigoCityType;
  postal_code: string;
}

export interface SiigoPhoneType {
  indicative: string;
  number: string;
  extension?: string;
}

export interface SiigoContactType {
  first_name: string;
  last_name: string;
  email: string;
  phone: SiigoPhoneType;
}

export interface SiigoRelatedUsersType {
  seller_id: number;
  collector_id: number;
}

export interface SiigoMetadataType {
  created: string;
  last_updated: string | null;
}

export interface SiigoCustomerType {
  id: string;
  type: string;
  person_type: string;
  id_type: SiigoIdType;
  identification: string;
  check_digit?: string;
  name: string[];
  commercial_name: string;
  branch_office: number;
  active: boolean;
  vat_responsible: boolean;
  fiscal_responsibilities: SiigoFiscalResponsibilityType[];
  address: SiigoAddressType;
  phones: SiigoPhoneType[];
  contacts: SiigoContactType[];
  comments?: string;
  related_users?: SiigoRelatedUsersType;
  metadata?: SiigoMetadataType;
}

export interface SiigoCustomerPaginationType {
  page: number;
  page_size: number;
  total_results: number;
}

export interface SiigoLinkType {
  href: string;
}

export interface SiigoLinksType {
  previous?: { href: string };
  self: { href: string };
  next?: { href: string };
}

export interface SiigoCustomersResponseType {
  pagination: SiigoCustomerPaginationType;
  results: SiigoCustomerType[];
  _links: SiigoLinksType;
}
