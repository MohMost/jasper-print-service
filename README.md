# Jasper Print Service

Application NestJS légère pour générer des rapports multi-tenant via l'API REST de JasperReports IO (JRIO), sans génération locale ni dépendance système lourde.

## Endpoints

- `POST /print/report` : renvoie le rapport en affichage navigateur (`Content-Disposition: inline`).
- `POST /print/report/download` : force le téléchargement (`Content-Disposition: attachment`).

Le tenant est résolu depuis `req.user.tenantId`, puis depuis l'en-tête `X-Tenant-ID` pour les tests.

## Configuration

Copiez `.env.example` vers `.env` puis adaptez :

```env
JASPER_IO_URL=http://localhost:8080/jrio
JASPER_IO_API_KEY=votre_cle_api_securisee
```

## Scripts

```bash
npm run start
npm run start:dev
npm run build
npm test
```
