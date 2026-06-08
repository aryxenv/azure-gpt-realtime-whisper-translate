$ErrorActionPreference = "Stop"

azd env set AZURE_LOCATION francecentral | Out-Null
Write-Host "Set AZURE_LOCATION to francecentral."

$principalId = az ad signed-in-user show --query id -o tsv
if (-not $principalId) {
    throw "Could not resolve the signed-in Azure user's object ID."
}

azd env set AZURE_PRINCIPAL_ID $principalId | Out-Null
Write-Host "Set AZURE_PRINCIPAL_ID for local Foundry access."
