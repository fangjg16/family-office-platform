# Handoff Schema · v2.91

Prefer JSON handoffs when a workflow produces KB-ready findings.

```json
{
  "fromSkill": "public-info-search",
  "targetSlots": ["target-overview", "industry-market"],
  "updateMode": "merge",
  "versionBump": "minor",
  "findings": {
    "target-overview": [],
    "industry-market": []
  },
  "newSources": [
    {
      "id": "A-1",
      "type": "AI-generated | user-uploaded | public-source",
      "authoringParty": "",
      "title": "",
      "url": "",
      "excerpt": "",
      "affectedSlots": ["industry-market"]
    }
  ],
  "newTerms": [],
  "dataDictionary": [],
  "timelineCandidates": [
    {
      "date": "",
      "item": "",
      "scope": "project | target | counterparty | asset | regulator | market | industry | internal | data",
      "timelineEligible": false,
      "reason": ""
    }
  ]
}
```

`targetSlots` must use v2.91 canonical slot keys:

`snapshot`, `target-overview`, `resource-network`, `industry-market`, `business-operations`, `legal-ownership`, `regulatory-compliance`, `comps-benchmark`, `valuation-returns`, `diligence-gaps`, `risks-mitigation`, `timeline-milestones`, `decision-framework`.

Appendices are updated through the fields `newSources`, `newTerms`, `dataDictionary`, and version metadata.
