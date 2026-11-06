# Provision Athens NGO Desk API on Render using the public API (v1).
# Usage (PowerShell, from repo root or any cwd):
#   $env:RENDER_API_KEY = "<from https://dashboard.render.com/u/settings#api-keys on the TARGET account>"
#   .\scripts\render_provision_api.ps1
#
# Prerequisites:
# - API key for the Render account that should own the resources (e.g. bognboa@gmail.com workspace).
# - GitHub repo https://github.com/JadissEL/Athens-NGO-Desk connected to Render for that account
#   (Dashboard → connect GitHub / install Render GitHub app for this workspace).
#
# Creates: Postgres (Frankfurt, basic_256mb) + Web service (Node, server/) with DATABASE_URL + CORS.
# Does not print secrets to stdout (only IDs and URLs).

$ErrorActionPreference = "Stop"
$base = "https://api.render.com/v1"

function Invoke-Render {
  param(
    [string]$Method,
    [string]$Uri,
    $Body = $null
  )
  $headers = @{
    Authorization = "Bearer $($env:RENDER_API_KEY)"
    Accept        = "application/json"
  }
  if ($Body) {
    $json = $Body | ConvertTo-Json -Depth 20 -Compress
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -ContentType "application/json" -Body $json
  }
  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
}

if (-not $env:RENDER_API_KEY) {
  Write-Error "Set RENDER_API_KEY to a Render API key for the target workspace (Account Settings → API Keys)."
}

$ownerEmail = "bognboa@gmail.com"
$dbName = "athens-ngo-desk-db-bognboa"
$serviceName = "athens-ngo-desk-api-bognboa"
$repo = "https://github.com/JadissEL/Athens-NGO-Desk"
$branch = "main"
$cors = "https://greece-ngo-desk.vercel.app"

Write-Host "Listing workspace for email $ownerEmail ..."
$owners = @(Invoke-Render -Method GET -Uri "$base/owners?limit=100")
$ownerId = $null
foreach ($row in $owners) {
  $o = $row.owner
  if ($o.email -eq $ownerEmail) {
    $ownerId = $o.id
    break
  }
}
if (-not $ownerId) {
  Write-Error "No workspace found for $ownerEmail. Create/join a workspace on that Render account, then retry."
}
Write-Host "ownerId=$ownerId"

Write-Host "Creating Postgres $dbName ..."
$pgBody = @{
  name    = $dbName
  ownerId = $ownerId
  plan    = "basic_256mb"
  region  = "frankfurt"
  version = 16
}
$pg = Invoke-Render -Method POST -Uri "$base/postgres" -Body $pgBody
$pgId = $pg.postgres.id
if (-not $pgId) {
  Write-Error "Unexpected create-postgres response (missing postgres.id)."
}
Write-Host "postgresId=$pgId"

Write-Host "Waiting for connection info..."
$internalUrl = $null
for ($i = 0; $i -lt 36; $i++) {
  try {
    $info = Invoke-Render -Method GET -Uri "$base/postgres/$pgId/connection-info"
    if ($info.internalConnectionString) {
      $internalUrl = $info.internalConnectionString
      break
    }
  } catch {
    Start-Sleep -Seconds 10
  }
}
if (-not $internalUrl) {
  Write-Error "Postgres not ready or connection-info unavailable. Check dashboard for $dbName."
}

$buildCmd = "npm ci && npx prisma migrate deploy && npm run build && npx tsx scripts/seed_from_json.ts --if-empty"
$startCmd = "npm start"

$serviceBody = @{
  type            = "web_service"
  name            = $serviceName
  ownerId         = $ownerId
  repo            = $repo
  branch          = $branch
  rootDir         = "server"
  autoDeployTrigger = "commit"
  envVars         = @(
    @{ key = "DATABASE_URL"; value = $internalUrl }
    @{ key = "NODE_VERSION"; value = "20" }
    @{ key = "HOST"; value = "0.0.0.0" }
    @{ key = "CORS_ORIGIN"; value = $cors }
  )
  serviceDetails  = @{
    runtime          = "node"
    region           = "frankfurt"
    plan             = "starter"
    healthCheckPath  = "/api/health"
    envSpecificDetails = @{
      buildCommand = $buildCmd
      startCommand = $startCmd
    }
  }
}

Write-Host "Creating web service $serviceName ..."
$created = Invoke-Render -Method POST -Uri "$base/services" -Body $serviceBody
$srv = $created.service
if (-not $srv.id) {
  Write-Error "Unexpected create-service response (missing service.id)."
}
Write-Host "serviceId=$($srv.id) deployId=$($created.deployId)"
Write-Host "dashboard=$($srv.dashboardUrl)"
if ($srv.serviceDetails.url) {
  Write-Host "serviceUrl=$($srv.serviceDetails.url)"
}

Write-Host "Done. After deploy succeeds: set static-site NGO_DATA_API_BASE to the service URL and redeploy Vercel."
