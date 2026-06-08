targetScope = 'subscription'

@minLength(1)
@description('The azd environment name used for resource naming and tagging.')
param environmentName string

@description('Azure region for the Azure OpenAI resource and deployments.')
param location string = 'francecentral'

@description('Optional principal ID that should receive Cognitive Services OpenAI User access for local DefaultAzureCredential usage.')
param principalId string = ''

@description('Deployment name for gpt-realtime-whisper.')
param whisperDeploymentName string = 'gpt-realtime-whisper'

@description('Model version for gpt-realtime-whisper.')
param whisperModelVersion string = '2026-05-06'

@description('Deployment name for gpt-realtime-translate.')
param translateDeploymentName string = 'gpt-realtime-translate'

@description('Model version for gpt-realtime-translate.')
param translateModelVersion string = '2026-05-06'

@description('Deployment SKU for realtime model deployments.')
param deploymentSkuName string = 'GlobalStandard'

@minValue(1)
@description('Deployment capacity for each realtime model deployment.')
param deploymentCapacity int = 5

@description('Azure region for Static Web Apps. Keep this separate because Static Web Apps has a smaller region list than Azure OpenAI.')
param staticWebAppLocation string = 'westeurope'

@description('Name of the Azure AI Foundry project.')
param foundryProjectName string = 'ai-project-${environmentName}'

var cleanedEnvironmentName = take(replace(replace(replace(toLower(environmentName), '-', ''), '_', ''), ' ', ''), 18)
var resourceSuffix = take(uniqueString(subscription().id, environmentName, location), 8)
var foundryAccountName = 'ai${cleanedEnvironmentName}${resourceSuffix}'
var tags = {
  'azd-env-name': environmentName
  workload: 'gpt-realtime-whisper-translate'
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-07-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module foundry './modules/foundry-openai.bicep' = {
  name: 'foundry-openai'
  scope: resourceGroup
  params: {
    name: foundryAccountName
    projectName: foundryProjectName
    location: location
    tags: tags
    principalId: principalId
    whisperDeploymentName: whisperDeploymentName
    whisperModelVersion: whisperModelVersion
    translateDeploymentName: translateDeploymentName
    translateModelVersion: translateModelVersion
    deploymentSkuName: deploymentSkuName
    deploymentCapacity: deploymentCapacity
  }
}

module hosting './modules/hosting.bicep' = {
  name: 'hosting'
  scope: resourceGroup
  params: {
    environmentName: environmentName
    resourceSuffix: resourceSuffix
    containerAppLocation: location
    staticWebAppLocation: staticWebAppLocation
    tags: tags
    principalId: principalId
    openAiResourceName: foundry.outputs.openAiResourceName
    whisperDeploymentName: whisperDeploymentName
    translateDeploymentName: translateDeploymentName
  }
}

output AZURE_RESOURCE_GROUP string = resourceGroup.name
output AZURE_OPENAI_RESOURCE_NAME string = foundry.outputs.openAiResourceName
output AZURE_AI_ACCOUNT_NAME string = foundry.outputs.foundryAccountName
output AZURE_AI_PROJECT_NAME string = foundry.outputs.foundryProjectName
output AZURE_AI_PROJECT_ENDPOINT string = foundry.outputs.foundryProjectEndpoint
output FOUNDRY_PROJECT_ENDPOINT string = foundry.outputs.foundryProjectEndpoint
output AZURE_OPENAI_REALTIME_DEPLOYMENT string = whisperDeploymentName
output AZURE_OPENAI_REALTIME_TRANSLATION_MODEL string = translateDeploymentName
output AZURE_OPENAI_REALTIME_TRANSLATION_INPUT_TRANSCRIPTION_MODEL string = whisperDeploymentName
output VITE_SERVER_URL string = hosting.outputs.apiUrl
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = hosting.outputs.containerRegistryEndpoint
output AZURE_STATIC_WEB_APP_NAME string = hosting.outputs.staticWebAppName
output AZURE_CONTAINER_APP_NAME string = hosting.outputs.containerAppName
