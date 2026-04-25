# Referencia de Nodos n8n 2.12.x — Para Generación de Workflows JSON

## FORMATO DE WORKFLOW JSON (n8n 2.x)

```json
{
  "name": "workflow_name",
  "nodes": [ ... ],
  "connections": { ... },
  "settings": {
    "executionOrder": "v1"
  },
  "pinData": {}
}
```

## FORMATO DE NODO

```json
{
  "parameters": { ... },
  "type": "n8n-nodes-base.TIPO",
  "typeVersion": X.X,
  "position": [X, Y],
  "id": "uuid-único",
  "name": "Nombre Descriptivo"
}
```

## FORMATO DE CONEXIONES

```json
{
  "connections": {
    "Nombre Nodo Origen": {
      "main": [
        [
          {
            "node": "Nombre Nodo Destino",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

Para nodos con múltiples salidas (If, Switch, HTTP Request con error output):
```json
{
  "Nombre If Node": {
    "main": [
      [{"node": "Nodo True", "type": "main", "index": 0}],
      [{"node": "Nodo False", "type": "main", "index": 0}]
    ]
  }
}
```

---

## NODOS PRINCIPALES USADOS EN ESTE PROYECTO

### Execute Sub-workflow Trigger (entrada de sub-workflows)
```json
{
  "type": "n8n-nodes-base.executeWorkflowTrigger",
  "typeVersion": 1.1,
  "name": "Receive Input",
  "parameters": {
    "inputSource": "passthrough"
  }
}
```

Con campos definidos:
```json
{
  "type": "n8n-nodes-base.executeWorkflowTrigger",
  "typeVersion": 1.1,
  "name": "Receive Input",
  "parameters": {
    "inputSource": "defineBelow",
    "workflowInputs": {
      "values": [
        {"name": "project_id", "type": "string"},
        {"name": "action", "type": "string"}
      ]
    }
  }
}
```

### Execute Sub-workflow (llamar a otro workflow)
```json
{
  "type": "n8n-nodes-base.executeWorkflow",
  "typeVersion": 1.2,
  "name": "Call Agent Briefing",
  "parameters": {
    "source": "database",
    "workflowId": "={{ $json.workflow_id }}",
    "options": {
      "waitForSubWorkflow": true
    }
  }
}
```

Nota: `workflowId` se rellena manualmente en n8n tras importar (cada instancia tiene IDs diferentes). Usar un placeholder descriptivo.

### HTTP Request (para llamadas al LLM)
```json
{
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "name": "Call LLM API",
  "parameters": {
    "method": "POST",
    "url": "https://api.anthropic.com/v1/messages",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {"name": "content-type", "value": "application/json"},
        {"name": "anthropic-version", "value": "2023-06-01"}
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({model: $json.model, max_tokens: 4096, temperature: $json.temperature, system: $json.prompt_system, messages: [{role: 'user', content: $json.prompt_user}]}) }}",
    "options": {
      "timeout": 120000
    }
  },
  "credentials": {
    "httpHeaderAuth": {
      "id": "PLACEHOLDER",
      "name": "Anthropic API Key"
    }
  },
  "onError": "continueErrorOutput",
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

### Postgres (queries a Supabase)
```json
{
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "name": "Load Project",
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT * FROM projects WHERE id = $1",
    "options": {
      "queryReplacement": "={{ $json.project_id }}"
    }
  },
  "credentials": {
    "postgres": {
      "id": "PLACEHOLDER",
      "name": "Supabase Postgres"
    }
  }
}
```

Para INSERT con múltiples parámetros:
```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "INSERT INTO activity_log (project_id, agent_name, action, status) VALUES ($1::uuid, $2, $3, $4)",
    "options": {
      "queryReplacement": "={{ [$json.project_id, $json.agent_name, $json.action, $json.status].join(',') }}"
    }
  }
}
```

Nota sobre queryReplacement en n8n 2.x: los parámetros se pasan como string separados por comas. $1, $2, $3 se reemplazan en orden.

### Code (JavaScript en Task Runner aislado)
```json
{
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "name": "Parse Response",
  "parameters": {
    "jsCode": "const input = $input.first().json;\n// Tu código aquí\nreturn [{json: {resultado: 'ok'}}];",
    "mode": "runOnceForAllItems"
  }
}
```

Restricciones del Code node en n8n 2.x:
- NO puede hacer fetch/HTTP requests
- NO puede acceder a env vars
- NO puede acceder al filesystem
- SÍ puede hacer JSON.parse, JSON.stringify, manipulación de datos
- SÍ puede acceder a datos de otros nodos con $('Nombre Nodo').first().json

### Edit Fields (Set)
```json
{
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "name": "Set Defaults",
  "parameters": {
    "mode": "manual",
    "duplicateItem": false,
    "assignments": {
      "assignments": [
        {
          "id": "uuid",
          "name": "model",
          "value": "={{ $json.model || 'claude-sonnet-4-20250514' }}",
          "type": "string"
        },
        {
          "id": "uuid",
          "name": "temperature",
          "value": "={{ $json.temperature ?? 0.3 }}",
          "type": "number"
        }
      ]
    },
    "includeOtherFields": false
  }
}
```

### If (condicional binario)
```json
{
  "type": "n8n-nodes-base.if",
  "typeVersion": 2,
  "name": "Is Success?",
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "strict"
      },
      "conditions": [
        {
          "id": "uuid",
          "leftValue": "={{ $json.status }}",
          "rightValue": "success",
          "operator": {
            "type": "string",
            "operation": "equals"
          }
        }
      ],
      "combinator": "and"
    }
  }
}
```

Salidas: main[0] = true, main[1] = false

### Switch (condicional múltiple)
```json
{
  "type": "n8n-nodes-base.switch",
  "typeVersion": 3,
  "name": "Route by Phase",
  "parameters": {
    "rules": {
      "values": [
        {
          "outputIndex": 0,
          "conditions": {
            "conditions": [
              {
                "leftValue": "={{ $json.current_phase }}",
                "rightValue": "intake",
                "operator": {"type": "string", "operation": "equals"}
              }
            ]
          }
        },
        {
          "outputIndex": 1,
          "conditions": {
            "conditions": [
              {
                "leftValue": "={{ $json.current_phase }}",
                "rightValue": "briefing_done",
                "operator": {"type": "string", "operation": "equals"}
              }
            ]
          }
        }
      ]
    },
    "options": {
      "fallbackOutput": "extra"
    }
  }
}
```

### Wait (para aprobaciones humanas)
```json
{
  "type": "n8n-nodes-base.wait",
  "typeVersion": 1.1,
  "name": "Wait for Approval",
  "parameters": {
    "resume": "webhook",
    "httpMethod": "POST",
    "responseMode": "lastNode",
    "limitWaitTime": true,
    "resumeAmount": 72,
    "resumeUnit": "hours",
    "options": {}
  }
}
```

Con formulario:
```json
{
  "parameters": {
    "resume": "form",
    "formTitle": "Revisión de Briefing",
    "formDescription": "Revise el briefing generado y decida si aprobarlo.",
    "formFields": {
      "values": [
        {
          "fieldLabel": "Decisión",
          "fieldType": "dropdown",
          "fieldOptions": {
            "values": [
              {"option": "Aprobar"},
              {"option": "Pedir revisión"},
              {"option": "Rechazar"}
            ]
          },
          "requiredField": true
        },
        {
          "fieldLabel": "Notas",
          "fieldType": "textarea",
          "requiredField": false
        }
      ]
    },
    "limitWaitTime": true,
    "resumeAmount": 72,
    "resumeUnit": "hours"
  }
}
```

### Merge
```json
{
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3,
  "name": "Merge Results",
  "parameters": {
    "mode": "append",
    "options": {}
  }
}
```

### Webhook (trigger para workflows principales)
```json
{
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2,
  "name": "Orchestrator Entry",
  "parameters": {
    "httpMethod": "POST",
    "path": "orchestrator",
    "responseMode": "responseNode",
    "options": {}
  },
  "webhookId": "uuid-único"
}
```

### Schedule Trigger (cron)
```json
{
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1.2,
  "name": "Every 8 Hours",
  "parameters": {
    "rule": {
      "interval": [
        {"field": "hours", "hoursInterval": 8}
      ]
    }
  }
}
```

### Error Trigger
```json
{
  "type": "n8n-nodes-base.errorTrigger",
  "typeVersion": 1,
  "name": "On Workflow Error",
  "parameters": {}
}
```

### Gmail
```json
{
  "type": "n8n-nodes-base.gmail",
  "typeVersion": 2.1,
  "name": "Send Notification",
  "parameters": {
    "sendTo": "botelladesdeel98@gmail.com",
    "subject": "={{ '[Studio AI] ' + $json.subject }}",
    "emailType": "html",
    "message": "={{ $json.html_body }}",
    "options": {}
  },
  "credentials": {
    "gmailOAuth2": {
      "id": "PLACEHOLDER",
      "name": "Gmail Notifications"
    }
  }
}
```

### Google Drive
```json
{
  "type": "n8n-nodes-base.googleDrive",
  "typeVersion": 3,
  "name": "Create Folder",
  "parameters": {
    "operation": "createFolder",
    "folderName": "={{ $json.folder_name }}",
    "driveId": "myDrive",
    "folderId": "={{ $json.parent_folder_id }}",
    "options": {}
  },
  "credentials": {
    "googleDriveOAuth2Api": {
      "id": "PLACEHOLDER",
      "name": "Google Drive"
    }
  }
}
```

---

## POSICIONAMIENTO DE NODOS

Para que el workflow sea legible, posicionar nodos con separación horizontal de ~250px y vertical de ~150px para ramas:

```
Nodo 1: [250, 300]
Nodo 2: [500, 300]
Nodo 3: [750, 300]
  ├── Rama true:  [1000, 200]
  └── Rama false: [1000, 400]
Nodo siguiente: [1250, 300]
```

## IDs DE NODOS

Generar UUIDs válidos para cada nodo. Formato: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
