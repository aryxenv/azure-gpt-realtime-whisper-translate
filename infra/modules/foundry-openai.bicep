targetScope = 'resourceGroup'

@description('Name of the Azure OpenAI account.')
param name string

@description('Azure region for the Azure OpenAI account and deployments.')
param location string = resourceGroup().location

@description('Tags applied to Azure resources.')
param tags object = {}

@description('Optional principal ID that should receive Cognitive Services OpenAI User access.')
param principalId string = ''

@description('Deployment name for gpt-realtime-whisper.')
param whisperDeploymentName string

@description('Model version for gpt-realtime-whisper.')
param whisperModelVersion string

@description('Deployment name for gpt-realtime-translate.')
param translateDeploymentName string

@description('Model version for gpt-realtime-translate.')
param translateModelVersion string

@description('Deployment SKU for realtime model deployments.')
param deploymentSkuName string

@minValue(1)
@description('Deployment capacity for each realtime model deployment.')
param deploymentCapacity int

var cognitiveServicesOpenAiUserRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
)

resource openAi 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: name
  location: location
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  identity: {
    type: 'SystemAssigned'
  }
  tags: tags
  properties: {
    customSubDomainName: name
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
  }
}

resource whisperDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAi
  name: whisperDeploymentName
  sku: {
    name: deploymentSkuName
    capacity: deploymentCapacity
  }
  tags: tags
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-realtime-whisper'
      version: whisperModelVersion
    }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
}

resource translateDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAi
  name: translateDeploymentName
  sku: {
    name: deploymentSkuName
    capacity: deploymentCapacity
  }
  tags: tags
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-realtime-translate'
      version: translateModelVersion
    }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
}

resource localDeveloperAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(principalId)) {
  name: guid(openAi.id, principalId, cognitiveServicesOpenAiUserRoleDefinitionId)
  scope: openAi
  properties: {
    roleDefinitionId: cognitiveServicesOpenAiUserRoleDefinitionId
    principalId: principalId
  }
}

output openAiResourceName string = openAi.name
output openAiEndpoint string = openAi.properties.endpoint
output whisperDeploymentName string = whisperDeployment.name
output translateDeploymentName string = translateDeployment.name
