# Skill: Shopping Agent

Use for LLM orchestration, prompts, tool schemas, intent handling, context building.

## Agent responsibilities
Interpret intent, choose tools, request missing info, explain normalized results.

## Never
- invent products or IDs
- invent price/stock/attributes
- claim YouCam output before completion
- silently drop hard constraints
- overwrite deterministic state
- expose hidden chain-of-thought

## Intent taxonomy
start_search, refine_search, switch_category, select_product, shortlist_product, reject_product, save_product, request_vto, compare_products, request_alternatives, request_similar, request_cheaper, request_more_premium, create_cross_product_search, ask_product_question, reset_constraint, start_new_session.

## Context budget
Send current state, relevant recent messages, selected/rejected items, visual summary, and tool definitions. Do not use unbounded chat history as state.

## Clarification
Ask one focused clarification only when a necessary field is truly ambiguous. If enough information exists to search, search first and let the user refine.
