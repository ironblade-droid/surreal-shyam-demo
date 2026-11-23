// Surreal Shyam — facts from the builder's brochure (Surreal Shyam Final Brochure.pdf)
export type Room = [code: string, name: string, size: string];
export interface Wing {
  id: number; name: string; sbu: number; builtUp: number; carpet: number; balcony: number;
  plan: string; faces: string; rooms: Room[]; tour: boolean;
}
export const PROJECT = {
  name: "Surreal Shyam",
  tagline: "Premium 3 BHK Homes",
  address: "Plot 1, RK Circle – Bhopalpura 80' link road, Udaipur",
  approvals: ["UDA approved", "RERA registered"],
  floors: 7,               // residential floors above the retail + entrance ground floor (counted from the brochure render)
  wingsPerFloor: 4,
  contacts: [["Gagan Porwal", "+91 96109 72223"], ["Vikram Choudhary", "+91 90010 55580"]] as [string, string][],
  maps: "https://www.google.com/maps/search/?api=1&query=RK+Circle+Bhopalpura+Link+Road+Udaipur",
};
export const WINGS: Wing[] = [
  { id: 1, name: "1st Wing", sbu: 2454, builtUp: 1636, carpet: 117.84, balcony: 9.84, plan: "img/plan-wing1.webp", tour: true,
    faces: "Front corner on the 80' main road · living balcony on the open side",
    rooms: [["A", "Vestibule", "4'-0\" wide"], ["B", "Bedroom 1", "13'-0\" × 12'-0\""], ["C", "Toilet", "5'-0\" × 7'-6\""],
      ["D", "Living", "18'-5\" × 12'-6\""], ["E", "Balcony", "6'-11\" × 16'-9\""], ["F", "Kitchen / Dining", "21'-7\" × 9'-6\""],
      ["G", "Utility", "6'-11\" × 6'-3\""], ["H", "Store", "4'-0\" × 6'-3\""], ["I", "Common toilet", "5'-0\" × 6'-3\""],
      ["J", "Bedroom 2", "16'-0\" × 11'-0\""], ["K", "Balcony", "2'-3\" wide"], ["L", "Bedroom 3", "14'-0\" × 13'-1\""],
      ["M", "Dress / Toilet", "6'-6\" × 10'-0\""], ["N", "Balcony", "7'-3\" × 5'-0\""]] },
  { id: 2, name: "2nd Wing", sbu: 2505, builtUp: 1672, carpet: 120.35, balcony: 11.15, plan: "img/plan-wing2.webp", tour: false,
    faces: "Front corner on the 80' main road and the 30' entry road",
    rooms: [["A", "Vestibule", "4'-0\" wide"], ["B", "Bedroom 1", "13'-0\" × 12'-0\""], ["C", "Toilet", "5'-0\" × 7'-6\""],
      ["D", "Living", "18'-0\" × 12'-6\""], ["E", "Balcony", "6'-3\" × 16'-9\""], ["F", "Kitchen / Dining", "22'-8\" × 9'-6\""],
      ["G", "Utility", "8'-3\" × 6'-3\""], ["H", "Store", "4'-0\" × 6'-3\""], ["I", "Common toilet", "5'-0\" × 6'-3\""],
      ["J", "Bedroom 2", "17'-3\" × 11'-0\""], ["K", "Balcony", "2'-3\" wide"], ["L", "Bedroom 3", "14'-0\" × 13'-1\""],
      ["M", "Dress / Toilet", "6'-7\" × 10'-0\""], ["N", "Balcony", "7'-3\" × 5'-0\""]] },
  { id: 3, name: "3rd Wing", sbu: 2524.5, builtUp: 1683, carpet: 118.58, balcony: 10.59, plan: "img/plan-wing3.webp", tour: false,
    faces: "Rear corner on the 30' entry road",
    rooms: [["A", "Vestibule", "4'-0\" wide"], ["B", "Bedroom 1", "13'-0\" × 12'-0\""], ["C", "Toilet", "5'-0\" × 7'-6\""],
      ["D", "Living", "18'-0\" × 12'-6\""], ["E", "Balcony", "6'-3\" × 16'-9\""], ["F", "Kitchen / Dining", "22'-8\" × 9'-6\""],
      ["G", "Utility", "8'-3\" × 6'-3\""], ["H", "Store", "4'-0\" × 6'-3\""], ["I", "Common toilet", "5'-0\" × 6'-3\""],
      ["J", "Bedroom 2", "17'-3\" × 11'-0\""], ["K", "Balcony", "2'-3\" wide"], ["L", "Bedroom 3", "15'-2\" × 12'-0\""],
      ["M", "Dress", "7'-2\" × 5'-9\""], ["N", "Toilet", "7'-2\" × 6'-3\""], ["O", "Balcony", "7'-7\" × 6'-4\""]] },
  { id: 4, name: "4th Wing", sbu: 2517, builtUp: 1678, carpet: 117.19, balcony: 13.82, plan: "img/plan-wing4.webp", tour: false,
    faces: "Rear corner, three balconies on the open side",
    rooms: [["A", "Vestibule", "4'-3\" wide"], ["B", "Bedroom 1", "14'-0\" × 11'-0\""], ["C", "Balcony", "7'-3\" × 5'-0\""],
      ["D", "Common toilet", "7'-6\" × 5'-8\""], ["E", "Living", "21'-5\" × 12'-0\""], ["F", "Balcony", "5'-10\" × 11'-7\""],
      ["G", "Kitchen / Dining", "22'-7\" × 9'-0\""], ["H", "Utility", "7'-3\" × 9'-0\""], ["I", "Store", "6'-6\" × 3'-6\""],
      ["J", "Bedroom 2", "11'-9\" × 14'-0\""], ["K", "Toilet", "7'-6\" × 6'-5\""], ["L", "Balcony", "7'-11\" × 5'-5\""],
      ["M", "Bedroom 3", "16'-0\" × 12'-0\""], ["N", "Dress", "6'-6\" × 5'-6\""], ["O", "Toilet", "9'-0\" × 5'-6\""],
      ["P", "Balcony", "2'-3\" wide"]] },
];
export const unitNo = (floor: number, wing: number) => `${floor}0${wing}`;
export const sqft = (m2: number) => Math.round(m2 * 10.7639);
