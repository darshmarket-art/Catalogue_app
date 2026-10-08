# Connects the live catalogue to WiseSender for WhatsApp sign-in codes. Run once from the repo root: .\scripts\set-wisesender.ps1
# You are asked for the values; the token is typed hidden and goes straight to Google Secret Manager (never to git or a file you keep).
# Where to find them: WiseSender > Settings > API Access (Vendor UID, "Generate New Token"), and the name of your approved Authentication template.
$p = 'gen-lang-client-0273003651'; $r = 'asia-south1'; $svc = 'catalogue-app'
$uid = Read-Host 'WiseSender Vendor UID'
$tpl = Read-Host 'Approved Authentication template name (e.g. catalogue_login_otp)'
$lang = Read-Host 'Template language code (press Enter for en_US)'
if (-not $lang) { $lang = 'en_US' }
$sec = Read-Host 'WiseSender API access token' -AsSecureString
$tok = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
if (-not $uid -or -not $tpl -or -not $tok) { throw 'All three values are needed.' }

gcloud secrets create wisesender-token --project $p --replication-policy=automatic 2>$null
$tmp = New-TemporaryFile
[System.IO.File]::WriteAllText($tmp.FullName, $tok)   # no trailing newline
gcloud secrets versions add wisesender-token --project $p --data-file=$($tmp.FullName)
Remove-Item $tmp.FullName
$tok = $null

$sa = gcloud run services describe $svc --project $p --region $r --format='value(spec.template.spec.serviceAccountName)'
if (-not $sa) { $sa = '456376852191-compute@developer.gserviceaccount.com' }
gcloud secrets add-iam-policy-binding wisesender-token --project $p --member "serviceAccount:$sa" --role roles/secretmanager.secretAccessor

# Setting these makes WiseSender the sign-in code provider automatically (it replaces the static code).
gcloud run services update $svc --project $p --region $r --update-env-vars "WISESENDER_VENDOR_UID=$uid,WISESENDER_OTP_TEMPLATE=$tpl,WISESENDER_OTP_LANGUAGE=$lang" --update-secrets WISESENDER_TOKEN=wisesender-token:latest
Write-Host 'Done. Wait for the new revision, then sign in on a store with a real number. Remove OTP_STATIC_CODE once a real code arrives.'
