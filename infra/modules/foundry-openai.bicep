targetScope = 'resourceGroup'

@description('Name of the Azure AI Foundry resource.')
param name string

@description('Name of the Azure AI Foundry project.')
param projectName string

@description('Azure region for the Azure AI Foundry resource, project, and deployments.')
param location string = resourceGroup().location

@description('Tags applied to Azure resources.')
param tags object = {}

@description('Optional principal ID that should receive Foundry project and model access.')
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
var azureAiUserRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '53ca6127-db72-4b80-b1b0-d745d6d5456d'
)

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: name
  location: location
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  identity: {
    type: 'SystemAssigned'
  }
  tags: tags
  properties: {
    allowProjectManagement: true
    customSubDomainName: name
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
  }
}

resource whisperDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: foundryAccount
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
  }
}

resource translateDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: foundryAccount
  name: translateDeploymentName
  dependsOn: [
    whisperDeployment
  ]
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
  }
}

resource project 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = {
  parent: foundryAccount
  name: projectName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    description: 'Realtime speech demo project'
    displayName: projectName
  }
  dependsOn: [
    translateDeployment
  ]
}

resource localDeveloperAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(principalId)) {
  name: guid(foundryAccount.id, principalId, cognitiveServicesOpenAiUserRoleDefinitionId)
  scope: foundryAccount
  properties: {
    roleDefinitionId: cognitiveServicesOpenAiUserRoleDefinitionId
    principalId: principalId
  }
}

resource localDeveloperProjectAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(principalId)) {
  name: guid(project.id, principalId, azureAiUserRoleDefinitionId)
  scope: project
  properties: {
    roleDefinitionId: azureAiUserRoleDefinitionId
    principalId: principalId
  }
}

output openAiResourceName string = foundryAccount.name
output openAiEndpoint string = foundryAccount.properties.endpoints['OpenAI Language Model Instance API']
output foundryAccountName string = foundryAccount.name
output foundryProjectName string = project.name
output foundryProjectEndpoint string = project.properties.endpoints['AI Foundry API']
output whisperDeploymentName string = whisperDeployment.name
output translateDeploymentName string = translateDeployment.name
