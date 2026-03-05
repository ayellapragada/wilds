import type { Creature } from "../types";
import type { AbilityData } from "../abilities/types";
import creaturesData from "./creatures.json";

// Type for a single entry in creatures.json
interface CreatureTemplate {
  name: string;
  element: Creature["type"];
  distance: number;
  cost: number;
  rarity: Creature["rarity"];
  description: string;
  ability: AbilityData | null;
}

const templates = creaturesData as Record<string, CreatureTemplate>;

let creatureIdCounter = 0;

export function resetCreatureIdCounter() {
  creatureIdCounter = 0;
}

export function createCreature(templateId: string): Creature {
  const template = templates[templateId];
  if (!template) throw new Error(`Unknown creature template: ${templateId}`);
  return {
    id: `creature_${creatureIdCounter++}`,
    templateId,
    name: template.name,
    type: template.element,
    distance: template.distance,
    cost: template.cost,
    rarity: template.rarity,
    description: template.description,
    ability: template.ability,
  };
}

export function getTemplate(templateId: string): CreatureTemplate {
  const template = templates[templateId];
  if (!template) throw new Error(`Unknown creature template: ${templateId}`);
  return template;
}

export function createStarterTeam(): Creature[] {
  return [
    ...Array.from({ length: 3 }, () => createCreature("scout")),
    ...Array.from({ length: 3 }, () => createCreature("wanderer")),
    createCreature("spark"),
    createCreature("ripple"),
    createCreature("gust"),
  ];
}

export function getAllTemplateIds(): string[] {
  return Object.keys(templates);
}
