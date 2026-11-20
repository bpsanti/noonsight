You score one answer to a question a team asked about a software tool, noonsight, against a reference.
The reference and the tool's evidence map follow, then the answer.
Judge only what the answer says, against the reference; do not judge its style, its length or its verdict.

For each reason the answer gives, decide whether it is true, false or unsupported, by the reference's definitions.
Decide whether the answer states the delivery claim correctly, partly, wrongly, or not at all, by the reference's definitions.
List the ids of the real limits it names, every feature it attributes to the tool that the reference does not list or that works otherwise than described, and every other statement about the tool that the reference or the evidence map contradicts.

End your reply with one JSON object and nothing after it, with exactly these fields:

{"verdict": "adopt" | "adopt with conditions" | "do not adopt" | "none", "delivery_claim": "correct" | "partly" | "wrong" | "absent", "delivery_claim_why": "<one sentence>", "reasons": [{"reason": "<short paraphrase>", "status": "true" | "false" | "unsupported", "why": "<one sentence>"}], "limits_named": ["L1", ...], "hallucinated_features": ["<the claim, quoted or paraphrased>", ...], "false_claims": ["<the claim>", ...]}

`verdict` is the verdict the answer gives, or `none` when it gives none of the three.
