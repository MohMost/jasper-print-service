# Jasper Print Service

Service NestJS multi-tenant pour demander la génération de rapports à JasperReports Server Community via l'API REST v2.

## Configuration

Copiez `.env.example` vers `.env` puis adaptez les valeurs :

```env
JASPER_BASE_URL=http://localhost:8080/jasperserver
JASPER_USERNAME=jasperadmin
JASPER_PASSWORD=password
```

## Commandes

```bash
npm install
npm run build
npm test
npm run start:dev
```

## Endpoints

- `POST /print/report` : retourne le rapport avec `Content-Disposition: inline`.
- `POST /print/report/download` : retourne le rapport avec `Content-Disposition: attachment`.

Le tenant est lu en priorité depuis `req.user.tenantId`, puis depuis l'en-tête `X-Tenant-ID` pour les tests.
