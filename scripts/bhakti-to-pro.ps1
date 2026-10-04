# Moves the live bhakti store from "founder" to "pro" (one field in Firestore). Run once: .\scripts\bhakti-to-pro.ps1
# Pro has no end date, so features stay the same; the Console can then change bhakti's plan like any other store.
$p = 'gen-lang-client-0273003651'
$t = gcloud auth print-access-token
$url = "https://firestore.googleapis.com/v1/projects/$p/databases/(default)/documents/stores/bhakti?updateMask.fieldPaths=plan"
Invoke-RestMethod -Method Patch -Uri $url -Headers @{ Authorization = "Bearer $t" } -ContentType 'application/json' -Body '{"fields":{"plan":{"stringValue":"pro"}}}' | Select-Object -ExpandProperty fields | Select-Object -ExpandProperty plan
