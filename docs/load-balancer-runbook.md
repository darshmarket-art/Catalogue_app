# Wildcard subdomain load balancer runbook (Phase 0/5)

Goal: `https://<store>.antarixs.com` (wildcard only) -> Cloud Run `catalogue-app` (asia-south1) through a global external Application Load Balancer. **Scope decision (owner): `antarixs.com` and `www.antarixs.com` are the WordPress marketing site at Hostinger and are NOT pointed at this load balancer.** Only `*.antarixs.com` is. The app also answers 404 JSON for the bare domain and www if they ever reach it. Run this runbook as step 2 of `docs/golive-runbook.md` (see that file for ordering).

Legend: **[$]** = creates billable resources, [free] = no direct cost.

State inspected 2026-10-04: Compute Engine and Certificate Manager APIs NOT enabled (so no LBs, IPs or certs exist). Cloud Run ingress is currently `all`. gcloud account is darshan.parekh@lumiq.ai (confirm it has Owner/Editor on the project).

```sh
export P=gen-lang-client-0273003651 R=asia-south1 SVC=catalogue-app D=antarixs.com
gcloud config set project $P
```

## 0. Enable APIs [free]
```sh
gcloud services enable compute.googleapis.com certificatemanager.googleapis.com
```

## 1. Global static IP [$ ~free while attached to a forwarding rule; charged if reserved but unused]
```sh
gcloud compute addresses create antarixs-lb-ip --global --ip-version=IPV4
gcloud compute addresses describe antarixs-lb-ip --global --format="value(address)"   # -> LB_IP
```

## 2. Wildcard certificate via Certificate Manager (DNS authorization) [free for Google-managed certs; LB usage billed below]
Classic Google-managed certs (`compute ssl-certificates`) do NOT support wildcards; use Certificate Manager.
```sh
gcloud certificate-manager dns-authorizations create antarixs-dnsauth --domain=$D
gcloud certificate-manager dns-authorizations describe antarixs-dnsauth \
  --format="value(dnsResourceRecord.name,dnsResourceRecord.type,dnsResourceRecord.data)"
```
**OWNER: add that CNAME now (see DNS section), then:**
```sh
gcloud certificate-manager certificates create antarixs-wildcard \
  --domains="*.$D" --dns-authorizations=antarixs-dnsauth
gcloud certificate-manager maps create antarixs-certmap
gcloud certificate-manager maps entries create antarixs-wild \
  --map=antarixs-certmap --certificates=antarixs-wildcard --hostname="*.$D"
gcloud certificate-manager certificates describe antarixs-wildcard --format="value(managed.state)"  # wait for ACTIVE
```

## 3. Serverless NEG [free]
```sh
gcloud compute network-endpoint-groups create catalogue-neg \
  --region=$R --network-endpoint-type=serverless --cloud-run-service=$SVC
```

## 4. Cloud Armor basic rate limit [$ policy ~$5/mo + rule ~$1/mo + per-request]
```sh
gcloud compute security-policies create antarixs-armor --description="basic rate limit"
gcloud compute security-policies rules create 1000 --security-policy=antarixs-armor \
  --action=throttle --rate-limit-threshold-count=300 --rate-limit-threshold-interval-sec=60 \
  --conform-action=allow --exceed-action=deny-429 --enforce-on-key=IP \
  --src-ip-ranges="*"
```

## 5. Backend service [free]
```sh
gcloud compute backend-services create catalogue-backend --global \
  --load-balancing-scheme=EXTERNAL_MANAGED --protocol=HTTPS
gcloud compute backend-services add-backend catalogue-backend --global \
  --network-endpoint-group=catalogue-neg --network-endpoint-group-region=$R
gcloud compute backend-services update catalogue-backend --global --security-policy=antarixs-armor
```
(Serverless NEG backends take no health check. The Host header reaches Cloud Run as the store subdomain, so the app can resolve the tenant from it.)

## 6. URL map + HTTPS proxy [free]
```sh
gcloud compute url-maps create antarixs-urlmap --default-service=catalogue-backend
gcloud compute target-https-proxies create antarixs-https-proxy \
  --url-map=antarixs-urlmap --certificate-map=antarixs-certmap
```

## 7. HTTPS forwarding rule [$ ~$18/mo per rule + data processing]
```sh
gcloud compute forwarding-rules create antarixs-https-fr --global \
  --load-balancing-scheme=EXTERNAL_MANAGED --network-tier=PREMIUM \
  --address=antarixs-lb-ip --target-https-proxy=antarixs-https-proxy --ports=443
```

## 8. HTTP -> HTTPS redirect [$ second forwarding rule ~$18/mo; may share the same IP]
```sh
cat > redirect.yaml <<Y
kind: compute#urlMap
name: antarixs-redirect
defaultUrlRedirect:
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  httpsRedirect: true
Y
gcloud compute url-maps import antarixs-redirect --global --source=redirect.yaml
gcloud compute target-http-proxies create antarixs-http-proxy --url-map=antarixs-redirect
gcloud compute forwarding-rules create antarixs-http-fr --global \
  --load-balancing-scheme=EXTERNAL_MANAGED --network-tier=PREMIUM \
  --address=antarixs-lb-ip --target-http-proxy=antarixs-http-proxy --ports=80
```

## 9. Lock Cloud Run to LB only [free] -- do LAST, after step 10 verified
Breaks the direct `*.run.app` URL (and any app/webhook using it) the moment it is applied.
```sh
gcloud run services update $SVC --region=$R --ingress=internal-and-cloud-load-balancing
```

## 10. DNS records the owner must add (at the antarixs.com DNS host)
| Type | Name | Value | When |
|---|---|---|---|
| CNAME | `_acme-challenge.antarixs.com` (use exact name/data printed by step 2) | printed `data` value | before cert creation; keep forever (renewals) |
| A | `*` (i.e. `*.antarixs.com`) | LB_IP | after step 8 |
Lower TTL to 300 first. **Do not touch any other record**: the `@` A record and `www` (WordPress at Hostinger), MX, SPF/DKIM/DMARC TXT and any mail CNAMEs stay exactly as they are. Specific records always beat the wildcard. `console.antarixs.com` needs no record of its own (the wildcard covers it) but see the console note below. Verify: `curl -I https://test.antarixs.com` and `curl -I http://test.antarixs.com` (301).

### DNS zone changes (Hostinger) at a glance
| Action | Type | Name | Value | Touch? |
|---|---|---|---|---|
| ADD | CNAME | `_acme-challenge` | value printed in step 2 | yes, keep forever |
| ADD | A | `*` | LB_IP | yes, after step 8 |
| leave | A | `@` | Hostinger WordPress IP | no |
| leave | CNAME/A | `www` | WordPress | no |
| leave | MX, TXT (SPF/DKIM/DMARC), mail CNAMEs | various | Hostinger mail | no |

Hostinger quirk: if the panel appends the zone name automatically, enter `_acme-challenge` and `*`, not the full names. A wildcard certificate for `*.antarixs.com` does not cover the bare domain, which is fine because WordPress keeps its own certificate.

### Console host (`console.antarixs.com`)
The console is protected by Google IAP, verified in the app with `IAP_AUDIENCE` + `CONSOLE_ADMINS`. IAP is enabled per backend service, so add a second backend service on the same NEG (`catalogue-console-backend`, IAP on) and a host rule in `antarixs-urlmap` sending `console.antarixs.com` to it. Until IAP is configured, the app rejects every /api/console call in production (no token), so leaving console on the normal backend is safe but unusable.

## Rollback
1. Delete the `*` A record (traffic returns to the old destination; stores then stop resolving, the WordPress site is unaffected) (traffic returns to old destination; TTL 300).
2. `gcloud run services update $SVC --region=$R --ingress=all` (restores `run.app` URL).
3. Delete in this order to stop billing: forwarding rules (`antarixs-https-fr`, `antarixs-http-fr`) -> target proxies (`target-https-proxies`/`target-http-proxies delete`) -> url-maps (`antarixs-urlmap`, `antarixs-redirect`) -> backend service -> NEG -> security policy -> cert map entries, map, certificate, dns-authorization -> `gcloud compute addresses delete antarixs-lb-ip --global`.

## Cost estimate (approx monthly, USD, low traffic)
| Item | ~Cost |
|---|---|
| 2 forwarding rules (HTTPS + redirect) | $36 (use 1 rule / skip redirect: $18) |
| Cloud Armor policy + 1 rule + requests | $6-7 |
| LB data processing ($0.008-0.012/GB) + egress | $1-5 |
| Static IP (attached), NEG, URL maps, backend | $0 |
| Certificate Manager (first certs/ LB-attached) | ~$0 (verify current pricing) |
| **Total** | **~$45-50/mo** (~$25 minimal, no redirect/Armor) |
Prices are estimates from memory; confirm in the GCP pricing calculator.
