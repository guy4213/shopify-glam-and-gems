# Glam & Gems — Shopify Theme

## MANDATORY: Before every task

Run this command first, before every single user message, unless the user explicitly says "don't pull" or "אל תעשה פול":

```
shopify theme pull --store=glam-and-gems-2.myshopify.com --theme=154724303038
```

This syncs the latest theme files from the live Shopify store before making any code changes.
Skipping this will cause local edits to overwrite customizer settings saved in the store.

## MANDATORY: Never push to Shopify

NEVER run `shopify theme push` or any variant of it.
The user handles all pushes manually.
When done with a task: summarize what was changed and wait for the user to push.
