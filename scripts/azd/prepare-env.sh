#!/usr/bin/env sh
set -eu

azd env set AZURE_LOCATION francecentral >/dev/null
echo "Set AZURE_LOCATION to francecentral."

principal_id="$(az ad signed-in-user show --query id -o tsv)"
if [ -z "$principal_id" ]; then
  echo "Could not resolve the signed-in Azure user's object ID." >&2
  exit 1
fi

azd env set AZURE_PRINCIPAL_ID "$principal_id" >/dev/null
echo "Set AZURE_PRINCIPAL_ID for local Foundry access."
