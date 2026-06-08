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
param deploymentCapacity int = 1

var cleanedEnvironmentName = take(replace(replace(replace(toLower(environmentName), '-', ''), '_', ''), ' ', ''), 18)
var resourceSuffix = take(uniqueString(subscription().id, environmentName, location), 8)
var openAiAccountName = 'oai${cleanedEnvironmentName}${resourceSuffix}'
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
    name: openAiAccountName
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

output AZURE_RESOURCE_GROUP string = resourceGroup.name
output AZURE_OPENAI_RESOURCE_NAME string = foundry.outputs.openAiResourceName
output AZURE_OPENAI_ENDPOINT string = foundry.outputs.openAiEndpoint
output AZURE_OPENAI_REALTIME_DEPLOYMENT string = whisperDeploymentName
output AZURE_OPENAI_REALTIME_TRANSLATION_MODEL string = translateDeploymentName
output AZURE_OPENAI_REALTIME_TRANSLATION_INPUT_TRANSCRIPTION_MODEL string = whisperDeploymentName
