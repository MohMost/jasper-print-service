# Jasper Print Service

Service NestJS multi-tenant pour demander la génération de rapports à JasperReports Server Community via l'API REST v2.

L'application ne génère pas les rapports elle-même : elle appelle uniquement JasperReports Server, récupère le fichier produit, puis le renvoie au client HTTP.

## Prérequis

Avant de lancer le projet, vérifiez que vous avez :

- Node.js installé.
- npm installé.
- Une instance JasperReports Server Community accessible en HTTP.
- Un utilisateur JasperReports Server ayant le droit d'exécuter les rapports ciblés.
- Des rapports déjà publiés dans JasperReports Server sous le chemin attendu pour chaque tenant.

> Exemple de chemin appelé par le service :
> `http://localhost:8080/jasperserver/rest_v2/reports/organizations/tenant-a/reports/facture_client.pdf`

## Installation du projet

### 1. Installer les dépendances

```bash
npm install
```

Cette commande installe NestJS, Axios, ConfigModule, class-validator, Jest, ts-jest et TypeScript.

### 2. Configurer les variables d'environnement

Copiez le fichier d'exemple :

```bash
cp .env.example .env
```

Puis adaptez les valeurs dans `.env` :

```env
JASPER_BASE_URL=http://localhost:8080/jasperserver
JASPER_USERNAME=jasperadmin
JASPER_PASSWORD=password
```

Description des variables :

| Variable | Description | Exemple |
| --- | --- | --- |
| `JASPER_BASE_URL` | URL racine de JasperReports Server, sans `/rest_v2` à la fin. | `http://localhost:8080/jasperserver` |
| `JASPER_USERNAME` | Nom d'utilisateur JasperReports Server utilisé pour l'authentification Basic. | `jasperadmin` |
| `JASPER_PASSWORD` | Mot de passe de l'utilisateur JasperReports Server. | `password` |

## Lancer l'application

### Mode développement

```bash
npm run start:dev
```

Le serveur NestJS démarre en mode watch. Par défaut, l'application écoute sur le port `3000` si la variable `PORT` n'est pas définie.

### Mode production local

Construire le projet :

```bash
npm run build
```

Démarrer le code compilé :

```bash
npm start
```

## Structure du projet

```text
src/
  ├─ print/
  │   ├─ dto/
  │   │   └─ print-report.dto.ts
  │   ├─ print.controller.ts
  │   ├─ print.module.ts
  │   ├─ print.service.ts
  │   └─ print.service.spec.ts
  ├─ app.module.ts
  └─ main.ts
```

Rôle des fichiers principaux :

- `src/print/dto/print-report.dto.ts` : définit le payload attendu pour demander un rapport.
- `src/print/print.service.ts` : construit l'appel JasperReports REST v2, nettoie les paramètres et gère les erreurs.
- `src/print/print.controller.ts` : expose les endpoints HTTP `/print/report` et `/print/report/download`.
- `src/print/print.module.ts` : regroupe le contrôleur, le service, `HttpModule` et `ConfigModule`.
- `src/app.module.ts` : charge la configuration globale et le module d'impression.
- `src/main.ts` : démarre NestJS et active la validation globale des DTO.

## Utiliser l'API

### Tenant multi-tenant

Le service récupère le tenant dans cet ordre :

1. `req.user.tenantId` : prévu pour une future intégration avec un guard d'authentification.
2. En-tête HTTP `X-Tenant-ID` : pratique pour les tests manuels ou automatisés.

Si aucun tenant n'est fourni, l'API retourne une erreur `400 Bad Request`.

### Payload attendu

```json
{
  "reportUri": "/reports/facture_client",
  "format": "pdf",
  "parameters": {
    "invoiceId": 123,
    "includeDetails": true
  }
}
```

Champs :

| Champ | Obligatoire | Description |
| --- | --- | --- |
| `reportUri` | Oui | Chemin du rapport dans JasperReports Server, sans le tenant. Il doit commencer par `/`. |
| `format` | Non | Format d'export JasperReports : `pdf`, `xlsx`, `docx` ou `html`. Valeur par défaut : `pdf`. |
| `parameters` | Non | Paramètres envoyés en query string à JasperReports Server. Les valeurs `null`, `undefined` et chaînes vides sont ignorées. |

### Afficher un rapport dans le navigateur

Endpoint : `POST /print/report`

```bash
curl -X POST http://localhost:3000/print/report \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-ID: tenant-a' \
  -d '{
    "reportUri": "/reports/facture_client",
    "format": "pdf",
    "parameters": {
      "invoiceId": 123
    }
  }' \
  --output facture_client.pdf
```

Cet endpoint renvoie un en-tête `Content-Disposition: inline`, ce qui permet au navigateur d'afficher le document quand le format est supporté.

### Télécharger un rapport

Endpoint : `POST /print/report/download`

```bash
curl -X POST http://localhost:3000/print/report/download \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-ID: tenant-a' \
  -d '{
    "reportUri": "/reports/facture_client",
    "format": "xlsx",
    "parameters": {
      "invoiceId": 123
    }
  }' \
  --output facture_client.xlsx
```

Cet endpoint renvoie un en-tête `Content-Disposition: attachment`, ce qui force le téléchargement côté navigateur.

## Tests unitaires

Les tests unitaires sont dans `src/print/print.service.spec.ts`.

Ils mockent :

- `HttpService` pour simuler les réponses de JasperReports Server.
- `ConfigService` pour simuler les variables d'environnement.

Cas couverts :

- Génération réussie d'un rapport.
- Tenant manquant.
- Rapport introuvable (`404`).
- Échec d'authentification JasperReports (`401`).
- Timeout JasperReports (`ECONNABORTED`).

### Lancer tous les tests

```bash
npm test
```

### Lancer uniquement les tests du service d'impression

```bash
npm test -- src/print/print.service.spec.ts
```

### Ajouter un nouveau test unitaire

1. Ouvrir `src/print/print.service.spec.ts`.
2. Ajouter un nouveau `it(...)` dans le bloc `describe('PrintService', ...)`.
3. Mocker le comportement attendu de `httpService.get` avec `of(...)` ou `throwError(...)`.
4. Vérifier le résultat avec `expect(...)`.
5. Relancer `npm test`.

Exemple de scénario à ajouter : vérifier qu'une réponse `403` est convertie en `InternalServerErrorException`.

## Validation et build

Avant d'ouvrir une pull request ou de livrer le code, exécutez :

```bash
npm run build
npm test
```

`npm run build` vérifie la compilation TypeScript stricte. `npm test` vérifie les tests unitaires Jest.

## Erreurs gérées

Le service convertit les erreurs JasperReports en exceptions NestJS :

| Erreur JasperReports / Axios | Exception NestJS | Signification |
| --- | --- | --- |
| `401` ou `403` | `InternalServerErrorException` | Mauvais identifiants ou droits JasperReports insuffisants. |
| `404` | `BadRequestException` | Rapport introuvable pour le tenant ou le chemin demandé. |
| Autres erreurs `4xx` / `5xx` | `InternalServerErrorException` | Erreur côté JasperReports Server. |
| `ECONNREFUSED` | `InternalServerErrorException` | JasperReports Server est inaccessible. |
| `ECONNABORTED` | `InternalServerErrorException` | Timeout après 120 secondes. |

## Notes multi-tenant

Le `reportUri` fourni dans le payload ne doit pas contenir le tenant. Le service construit automatiquement l'URL JasperReports avec cette forme :

```text
${JASPER_BASE_URL}/rest_v2/reports/organizations/${tenantId}${reportUri}.${format}
```

Exemple :

```text
http://localhost:8080/jasperserver/rest_v2/reports/organizations/tenant-a/reports/facture_client.pdf
```
