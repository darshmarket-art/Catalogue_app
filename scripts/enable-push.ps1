# Turns on owner order alerts (Web Push) for production. Run once from the repo root: .\scripts\enable-push.ps1
# Makes a VAPID key pair, keeps the private key in Secret Manager, sets the public key on Cloud Run.
$p = 'gen-lang-client-0273003651'; $r = 'asia-south1'; $svc = 'catalogue-app'
$k = node -e "const k=require('web-push').generateVAPIDKeys();console.log(k.publicKey+' '+k.privateKey)"
$pub, $priv = $k.Trim().Split(' ')
gcloud secrets create vapid-private --project $p --replication-policy=automatic 2>$null
# The secret must hold the key with no trailing newline.
$tmp = New-TemporaryFile
[System.IO.File]::WriteAllText($tmp.FullName, $priv)
gcloud secrets versions add vapid-private --project $p --data-file=$($tmp.FullName)
Remove-Item $tmp.FullName
$sa = gcloud run services describe $svc --project $p --region $r --format='value(spec.template.spec.serviceAccountName)'
if (-not $sa) { $sa = '456376852191-compute@developer.gserviceaccount.com' }
gcloud secrets add-iam-policy-binding vapid-private --project $p --member "serviceAccount:$sa" --role roles/secretmanager.secretAccessor
gcloud run services update $svc --project $p --region $r --update-env-vars "VAPID_PUBLIC_KEY=$pub,VAPID_SUBJECT=mailto:admin@antarixs.com" --update-secrets VAPID_PRIVATE_KEY=vapid-private:latest
