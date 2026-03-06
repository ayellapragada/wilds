# Pokemon Balance System

## Resources

| Resource | Role | How Earned | How Spent | Point Value |
|----------|------|------------|-----------|-------------|
| Distance | Primary score | Drawing Pokemon (base + bonus abilities) | N/A — banked on stop | 2 pts per point |
| Cost | Bust risk | Accumulated per draw (each Pokemon has a cost) | N/A — resets each route | 2 pts per point below 5 (low = premium) |
| Currency | Shop economy | floor(distance/3) per route + bonus_currency abilities | Buy Pokemon in hub (C2/U4/R7/L12) | 1 pt per +1 (secondary) |
| Bust Threshold | Safety margin | Set by route node (5-8), modified by abilities | N/A — if totalCost > threshold, bust | 2 pts per +1 (route duration) |

## Mechanics

| Mechanic | Description | Point Cost | Conditions |
|----------|-------------|------------|------------|
| bonus_distance (flat) | Add flat distance on draw | 2 pts per +1 | Unconditional or gated |
| bonus_distance_per (scaling) | +N distance per matching element drawn | 3 pts per +1 | Scales with deck composition |
| reduce_cost (self) | Reduce this Pokemon's cost contribution | 2 pts per -1 | Only affects drawn card |
| reduce_cost (all) | Reduce total accumulated cost | 5 pts per -1 | Affects entire run's cost |
| modify_threshold (route) | Increase bust threshold for this route | 2 pts per +1 | Lasts until route ends |
| modify_threshold (permanent) | Increase bust threshold permanently | 5 pts per +1 | Lasts rest of game |
| bonus_currency | Earn extra currency at end of round | 1 pt per +1 | Triggers on stop (not bust) |
| peek_deck | See top N cards of draw pile | 2 pts per card | Information advantage |
| negate_bust | Cancel a bust when it would occur | 10 pts flat | on_bust trigger only |

## Conditions (~50% discount when gated)

| Condition | Trigger | Design Intent |
|-----------|---------|---------------|
| null | Always fires | Full point cost |
| element_count | N+ Pokemon of type already drawn | Rewards deck-building synergy |
| min_cards_played | N+ total cards drawn this route | Rewards pushing deeper |
| position (first) | Must be first card drawn | High variance, narrow window |
| would_bust | This draw would exceed threshold | Defensive safety valve |
| neighbor_element | Previous card shares element | Rewards sequencing luck/planning |

## Power Budgets

| Rarity | Budget |
|--------|--------|
| Common | 12 |
| Uncommon | 18 |
| Rare | 28 |
| Legendary | 40 |

Formula: `distance_pts + cost_pts + ability_pts = total` (should be ≤ budget)
