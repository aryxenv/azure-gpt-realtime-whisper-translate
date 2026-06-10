targetScope = 'resourceGroup'

@description('The azd environment name used for resource naming and tagging.')
param environmentName string

@description('Short deterministic suffix shared with other resources.')
param resourceSuffix string

@description('Azure region for the Container Apps resources.')
param containerAppLocation string = resourceGroup().location

@description('Tags applied to Azure resources.')
param tags object = {}

@description('Optional principal ID that should receive AcrPush access for azd container image publishing.')
param principalId string = ''

@description('Name of the Azure OpenAI resource used by the hosted backend.')
param openAiResourceName string

@description('Deployment name for gpt-realtime-whisper.')
param whisperDeploymentName string

@description('Deployment name for gpt-realtime-translate.')
param translateDeploymentName string

var cleanedEnvironmentName = take(replace(replace(replace(toLower(environmentName), '-', ''), '_', ''), ' ', ''), 18)
var serviceTags = union(tags, {
  hosting: 'webslides'
})
var webServiceTags = union(serviceTags, {
  'azd-service-name': 'web'
})
var apiServiceTags = union(serviceTags, {
  'azd-service-name': 'api'
})
var cognitiveServicesOpenAiUserRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
)
var acrPullRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '7f951dda-4ed3-4680-a7ca-43fe172d538d'
)
var acrPushRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '8311e382-0749-4cb8-b61a-304f252e45ec'
)
var containerAppNameBase = take(cleanedEnvironmentName, 14)
var webContainerAppName = 'ca-${containerAppNameBase}-${resourceSuffix}-web'
var apiContainerAppName = 'ca-${containerAppNameBase}-${resourceSuffix}-api'

resource openAi 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: openAiResourceName
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'acr${cleanedEnvironmentName}${resourceSuffix}'
  location: containerAppLocation
  tags: serviceTags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource webIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${cleanedEnvironmentName}-${resourceSuffix}-web'
  location: containerAppLocation
  tags: webServiceTags
}

resource apiIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${cleanedEnvironmentName}-${resourceSuffix}-api'
  location: containerAppLocation
  tags: apiServiceTags
}

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${cleanedEnvironmentName}-${resourceSuffix}'
  location: containerAppLocation
  tags: serviceTags
  properties: {
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource containerEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${cleanedEnvironmentName}-${resourceSuffix}'
  location: containerAppLocation
  tags: serviceTags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

var webHostname = '${webContainerAppName}.${containerEnvironment.properties.defaultDomain}'
var apiHostname = '${apiContainerAppName}.${containerEnvironment.properties.defaultDomain}'
var webUrl = 'https://${webHostname}'
var apiUrl = 'https://${apiHostname}'

resource web 'Microsoft.App/containerApps@2024-03-01' = {
  name: webContainerAppName
  location: containerAppLocation
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${webIdentity.id}': {}
    }
  }
  tags: webServiceTags
  dependsOn: [
    webRegistryPullAccess
  ]
  properties: {
    managedEnvironmentId: containerEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        allowInsecure: false
        targetPort: 80
        transport: 'auto'
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: webIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          env: [
            {
              name: 'VITE_SERVER_URL'
              value: apiUrl
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1.0Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: apiContainerAppName
  location: containerAppLocation
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${apiIdentity.id}': {}
    }
  }
  tags: apiServiceTags
  dependsOn: [
    apiRegistryPullAccess
  ]
  properties: {
    managedEnvironmentId: containerEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: registry.properties.loginServer
          identity: apiIdentity.id
        }
      ]
      ingress: {
        external: true
        allowInsecure: false
        targetPort: 8000
        transport: 'auto'
      }
    }
    template: {
      containers: [
        {
          name: 'api'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          env: [
            {
              name: 'AZURE_OPENAI_RESOURCE_NAME'
              value: openAiResourceName
            }
            {
              name: 'AZURE_OPENAI_REALTIME_DEPLOYMENT'
              value: whisperDeploymentName
            }
            {
              name: 'AZURE_OPENAI_REALTIME_TRANSLATION_MODEL'
              value: translateDeploymentName
            }
            {
              name: 'AZURE_OPENAI_REALTIME_TRANSLATION_INPUT_TRANSCRIPTION_MODEL'
              value: whisperDeploymentName
            }
            {
              name: 'AZURE_CLIENT_ID'
              value: apiIdentity.properties.clientId
            }
            {
              name: 'WEBSLIDES_EXPORT_ALLOWED_HOSTS'
              value: webHostname
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1.0Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

resource webRegistryPullAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, webIdentity.name, acrPullRoleDefinitionId)
  scope: registry
  properties: {
    roleDefinitionId: acrPullRoleDefinitionId
    principalId: webIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource apiOpenAiAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openAi.id, apiIdentity.name, cognitiveServicesOpenAiUserRoleDefinitionId)
  scope: openAi
  properties: {
    roleDefinitionId: cognitiveServicesOpenAiUserRoleDefinitionId
    principalId: apiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource apiRegistryPullAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, apiIdentity.name, acrPullRoleDefinitionId)
  scope: registry
  properties: {
    roleDefinitionId: acrPullRoleDefinitionId
    principalId: apiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource publisherRegistryPushAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(principalId)) {
  name: guid(registry.id, principalId, acrPushRoleDefinitionId)
  scope: registry
  properties: {
    roleDefinitionId: acrPushRoleDefinitionId
    principalId: principalId
  }
}

output apiUrl string = apiUrl
output webUrl string = webUrl
output apiHostname string = apiHostname
output webHostname string = webHostname
output containerRegistryEndpoint string = registry.properties.loginServer
output apiContainerAppName string = api.name
output webContainerAppName string = web.name
