# Vassalage and imperial succession — planned scope

Status: added to the next scope on 2026-11-08. Not implemented. Continue the user's preference for simple first versions, with complexity added after playtesting.

## Aim

Allow kingdoms to unite under one sovereign while retaining local rulers and identities. Such a realm should be able to survive a succession, but weak authority and disputed inheritance should also allow it to fragment. This extends existing rulers, war, peace and rebellion systems.

## First version

| Part | Included |
|---|---|
| Vassal relationship | A subject has one sovereign. Keep a single level of direct subjects; no nested hierarchy. Subjects retain ownership of their cells, their ruler, culture, population, reserve and armies. |
| Protection and obligations | Use military support and protection through existing war/army mechanics. Define how sovereign authority limits separate subject wars and alliances so subjects cannot contradict their allegiance. Avoid a new economy or tribute currency. |
| Submission peace | An eligible defeated realm can submit instead of being annexed. Use existing peace negotiation and controller decisions; submission must leave a valid diplomatic state and settle the relevant war. |
| Succession | When the sovereign's ruler changes, subjects normally recognize the successor. A disputed transition can produce an independence war; success releases the subject, defeat preserves its allegiance. Reuse existing opinion, stability and relative strength where practical. |
| Presentation | Show who serves whom, distinguish direct territory from the land under one banner, and log submission, succession recognition/disputes and independence. |

Ordinary ruler succession and pretender civil wars already exist. This extension concerns inheritance of authority over subjects, rather than replacing those systems. A subject's normal local succession should not automatically dissolve its allegiance.

## Implementation order and checks

1. Establish the relationship and its rules, including military obligations, diplomatic restrictions, and cleanup when a realm falls. Prevent self-vassalage, cycles and subjects with multiple sovereigns. Do not count the same soldiers twice or transfer subject population into the sovereign's directly governed territory.
2. Add submission peace, controller choices and the corresponding player-facing orders/policies. Check existing allies, joined wars and other subjects before changing allegiance; do not silently erase unrelated wars or obligations.
3. Extend the existing succession step with recognition and disputed independence. Keep this distinct from pretenders splitting directly owned land, so the same subject cannot be broken away twice by two crisis systems.
4. Verify save/load, deterministic replay and AI/player parity. Older saves begin with independent realms. Measure both growth under one banner and fragmentation across separate tuning and validation seeds.

The exact negotiation thresholds, support obligations, crisis chances and save format are implementation decisions, not settled parameters in this scope document. Add only the parameters the first version needs and document them in PARAMS.md with the code.

## Later extensions

Nested vassals, negotiated autonomy levels, tribute economies, marriages and family trees, inheritance of independent crowns, competing imperial claimants, and detailed feudal contracts remain later work. Voluntary peacetime submission can follow once submission peace and the relationship rules work reliably.
