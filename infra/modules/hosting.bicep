targetScope = 'resourceGroup'

@description('The azd environment name used for resource naming and tagging.')
param environmentName string

@description('Short deterministic suffix shared with other resources.')
param resourceSuffix string

@description('Azure region for the Container Apps backend.')
param containerAppLocation string = resourceGroup().location

@description('Azure region for the Static Web Apps frontend.')
param staticWebAppLocation string = 'westeurope'

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
var apiServiceTags = union(serviceTags, {
  'azd-service-name': 'api'
})
var webServiceTags = union(serviceTags, {
  'azd-service-name': 'web'
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

resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-${cleanedEnvironmentName}-${resourceSuffix}'
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
              value: web.properties.defaultHostname
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

resource web 'Microsoft.Web/staticSites@2024-04-01' = {
  name: 'stapp-${cleanedEnvironmentName}-${resourceSuffix}'
  location: staticWebAppLocation
  tags: webServiceTags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    provider: 'None'
  }
}

output apiUrl string = 'https://${api.properties.configuration.ingress.fqdn}'
output containerRegistryEndpoint string = registry.properties.loginServer
output containerAppName string = api.name
output staticWebAppName string = web.name
output staticWebAppDefaultHostname string = web.properties.defaultHostname
