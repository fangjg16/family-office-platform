# Handoff Schema

Prefer this JSON form for v2.8.

```json
{
  "fromSkill": "risk-matrix",
  "targetSlots": ["risks", "open-questions"],
  "updateMode": "merge",
  "versionBump": "minor",
  "findings": {
    "risks": {
      "state": "populated",
      "html": "",
      "items": []
    }
  },
  "newSources": [
    {
      "id": "A-1",
      "type": "AI生成",
      "title": "Risk matrix synthesis",
      "url": "",
      "excerpt": ""
    }
  ],
  "newTerms": []
}
```

Validation rules:

- `fromSkill` must be a known workflow name.
- `targetSlots` must be canonical slot keys.
- `updateMode` is `merge` or `replace`.
- `findings` keys must be included in `targetSlots`.
- Sources must have unique IDs.
