export interface AddressLike {
  flatNo?: string;
  buildingName?: string;
  line?: string;
  area?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  fullAddress?: string;
}

export function formatAddress(a: AddressLike): string {
  const head = [a.flatNo?.trim(), a.buildingName?.trim(), a.line?.trim(), a.area?.trim()].filter(Boolean).join(", ");
  const cityState = [a.city?.trim(), a.state?.trim()].filter(Boolean).join(", ");
  const locality = a.pincode?.trim() ? `${cityState} - ${a.pincode.trim()}` : cityState;
  const body = [head, locality].filter(Boolean).join(", ");
  const landmark = a.landmark?.trim();
  return landmark ? `${body}, Near ${landmark}` : body;
}