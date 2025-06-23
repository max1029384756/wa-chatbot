export interface WhatsAppBusinessObject {
  entry: Entry[];
  gs_app_id: string;
  object: string;
}

export interface Entry {
  changes: Change[];
  id: string;
}

export interface Change {
  field: string;
  value: MessagesValue;
}

export interface MessagesValue {
  contacts: Contact[];
  messages: Message[];
  messaging_product: string;
  metadata: Metadata;
}

export interface Contact {
  profile: Profile;
  wa_id: string;
}

export interface Profile {
  name: string;
}

export interface Message {
  from: string;
  id: string;
  text: Text;
  timestamp: string;
  type: string;
}

export interface Text {
  body: string;
}

export interface Metadata {
  display_phone_number: string;
  phone_number_id: string;
}
