#!/usr/bin/env sh
set -eu

get_required_azd_env_value() {
  name="$1"
  value="$(azd env get-value "$name" 2>/dev/null || true)"
  if [ -z "$value" ]; then
    echo "Missing required AZD environment value '$name'. Run 'azd provision' before deploying." >&2
    exit 1
  fi

  printf '%s' "$value"
}

get_container_app_principal_id() {
  name="$1"
  resource_group="$2"

  principal_id="$(az containerapp identity show \
    --name "$name" \
    --resource-group "$resource_group" \
    --query principalId \
    -o tsv 2>/dev/null || true)"

  if [ -z "$principal_id" ]; then
    principal_id="$(az containerapp identity show \
      --name "$name" \
      --resource-group "$resource_group" \
      --query "userAssignedIdentities.*.principalId | [0]" \
      -o tsv 2>/dev/null || true)"
  fi

  if [ -z "$principal_id" ]; then
    echo "Unable to resolve managed identity principal for Container App '$name'." >&2
    exit 1
  fi

  printf '%s' "$principal_id"
}

resource_group="$(get_required_azd_env_value AZURE_RESOURCE_GROUP)"
registry_endpoint="$(get_required_azd_env_value AZURE_CONTAINER_REGISTRY_ENDPOINT)"
web_container_app_name="$(get_required_azd_env_value AZURE_WEB_CONTAINER_APP_NAME)"
api_container_app_name="$(get_required_azd_env_value AZURE_API_CONTAINER_APP_NAME)"
registry_name="${registry_endpoint%%.*}"

registry_id="$(az acr show \
  --name "$registry_name" \
  --resource-group "$resource_group" \
  --query id \
  -o tsv)"

for container_app_name in "$api_container_app_name" "$web_container_app_name"; do
  principal_id="$(get_container_app_principal_id "$container_app_name" "$resource_group")"

  attempt=1
  while [ "$attempt" -le 10 ]; do
    role="$(az role assignment list \
      --scope "$registry_id" \
      --assignee-object-id "$principal_id" \
      --query "[?roleDefinitionName=='AcrPull'].roleDefinitionName" \
      -o tsv 2>/dev/null || true)"

    if [ "$role" = "AcrPull" ]; then
      echo "AcrPull confirmed for $container_app_name."
      break
    fi

    if [ "$attempt" -eq 10 ]; then
      echo "AcrPull role was not visible for '$container_app_name' after waiting." >&2
      exit 1
    fi

    echo "Waiting for AcrPull RBAC propagation for $container_app_name ($attempt/10)..."
    sleep 30
    attempt=$((attempt + 1))
  done
done
